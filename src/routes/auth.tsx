import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — AyroGmail" },
      { name: "description", content: "Masuk atau daftar untuk mulai menggunakan AyroGmail." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Akun dibuat! Cek email untuk konfirmasi.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Berhasil masuk");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error((err as Error).message || "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error(res.error.message || "Gagal masuk dengan Google");
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-app-bg px-4 text-slate-100 antialiased">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-admin-primary text-primary-foreground p-2.5 rounded-xl shadow-lg shadow-admin-primary/25">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-xl text-foreground tracking-tight">AyroGmail</h1>
            <p className="text-xs text-muted-foreground">Jual Gmail, tarik dana</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-1">
          {mode === "signin" ? "Masuk ke akun" : "Buat akun baru"}
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          {mode === "signin" ? "Selamat datang kembali." : "Cukup beberapa detik saja."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-admin-primary text-primary-foreground font-medium py-3 rounded-xl shadow-lg shadow-admin-primary/25 hover:bg-admin-primary/90 transition-colors disabled:opacity-60"
          >
            {submitting ? "Memproses..." : mode === "signin" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">atau</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={google}
          className="w-full border border-border py-3 rounded-xl font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.4-4.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"/><path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 36 26.9 37 24 37c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.7 41.2 16.3 45.5 24 45.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4.3 5.9l6.5 5.5C41.8 36.6 45 31.3 45 25c0-1.5-.2-3-.4-4.5z"/></svg>
          Lanjutkan dengan Google
        </button>

        <p className="text-center text-sm text-muted-foreground mt-5">
          {mode === "signin" ? "Belum punya akun? " : "Sudah punya akun? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-admin-primary hover:underline"
          >
            {mode === "signin" ? "Daftar" : "Masuk"}
          </button>
        </p>
      </div>
    </div>
  );
}
