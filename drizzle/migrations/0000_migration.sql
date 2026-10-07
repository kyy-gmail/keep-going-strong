CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.gmail_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak')),
  rate INTEGER NOT NULL DEFAULT 4000,
  hidden_from_admin boolean NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gmail_submissions TO authenticated;
GRANT ALL ON public.gmail_submissions TO service_role;
ALTER TABLE public.gmail_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own submissions" ON public.gmail_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own submissions" ON public.gmail_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  account_info TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','diproses','selesai','ditolak')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own withdrawals" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  rate integer NOT NULL DEFAULT 4000,
  min_withdraw integer NOT NULL DEFAULT 10000,
  admin_fee integer NOT NULL DEFAULT 0,
  daily_submission_limit integer NOT NULL DEFAULT 10,
  submissions_open boolean NOT NULL DEFAULT true,
  member_password text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id, rate, min_withdraw) VALUES ('global', 4000, 10000);

CREATE POLICY "Admins read all submissions" ON public.gmail_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update submissions" ON public.gmail_submissions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update withdrawals" ON public.withdrawals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete withdrawals" ON public.withdrawals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.grant_admin_for_owner_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND lower(new.email) = 'masbebek2008@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created_grant_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_owner_email();
CREATE TRIGGER on_auth_user_confirmed_grant_admin AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_owner_email();

CREATE OR REPLACE FUNCTION public.enforce_submissions_open()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE is_open boolean;
BEGIN
  SELECT submissions_open INTO is_open FROM public.app_settings WHERE id = 'global';
  IF is_open IS NOT NULL AND is_open = false AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Setoran Gmail sedang ditutup';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_submissions_open BEFORE INSERT ON public.gmail_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_submissions_open();