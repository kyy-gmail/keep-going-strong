// ============= Full file contents =============

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AyroGmail — Dashboard" },
      { name: "description", content: "Dashboard AyroGmail: jual password Gmail, pantau status, dan tarik dana." },
      { property: "og:title", content: "AyroGmail — Dashboard" },
      { property: "og:description", content: "Dashboard AyroGmail: jual password Gmail, pantau status, dan tarik dana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Submission = { id: string; status: "menunggu" | "disetujui" | "ditolak"; rate: number; created_at: string };
type Withdrawal = { id: string; amount: number; status: string };

type Settings = { rate: number; min_withdraw: number; admin_fee: number; daily_submission_limit: number; submissions_open: boolean; member_password: string };

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function Dashboard() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    rate: 4000,
    min_withdraw: 10000,
    admin_fee: 0,
    daily_submission_limit: 0,
    submissions_open: true,
    member_password: "",
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const load = async () => {
    if (!session) return;
    const uid = session.user.id;
    const [p, s, w, st] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      supabase.from("gmail_submissions").select("id, status, rate, created_at").eq("user_id", uid),
      supabase.from("withdrawals").select("id, amount, status").eq("user_id", uid),
      supabase
        .from("app_settings")
        .select("rate, min_withdraw, admin_fee, daily_submission_limit, submissions_open, member_password")
        .eq("id", "global")
        .maybeSingle(),
    ]);
    if (st.data) setSettings(st.data as Settings);
    setDisplayName(p.data?.display_name ?? session.user.email?.split("@")[0] ?? "");
    setSubmissions((s.data as Submission[]) ?? []);
    setWithdrawals((w.data as Withdrawal[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const stats = useMemo(() => {
    const menunggu = submissions.filter((s) => s.status === "menunggu").length;
    const disetujui = submissions.filter((s) => s.status === "disetujui").length;
    const ditolak = submissions.filter((s) => s.status === "ditolak").length;
    const earned = submissions
      .filter((s) => s.status === "disetujui")
      .reduce((sum, s) => sum + s.rate, 0);
    const withdrawn = withdrawals
      .filter((w) => w.status !== "ditolak")
      .reduce((sum, w) => sum + w.amount, 0);
    const today = new Date().toDateString();
    const hariIni = submissions.filter((s) => new Date(s.created_at).toDateString() === today).length;
    return { menunggu, disetujui, ditolak, hariIni, saldo: Math.max(0, earned - withdrawn) };
  }, [submissions, withdrawals]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading || !session) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-app-bg">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="dark text-slate-100 antialiased flex justify-center min-h-screen bg-app-bg">
      <div className="w-full max-w-md md:max-w-5xl bg-app-bg min-h-screen sm:shadow-2xl sm:shadow-black/40 relative flex flex-col">
        {/* Header */}
        <header className="bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-5 md:px-8 py-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="bg-admin-primary text-primary-foreground p-2 rounded-xl flex items-center justify-center shadow-lg shadow-admin-primary/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
              </svg>
            </div>
            <h1 className="font-bold text-lg text-foreground tracking-tight">AyroGmail</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className={settings.submissions_open ? "text-admin-success" : "text-admin-danger"}>
              {settings.submissions_open ? "Setoran dibuka" : "Setoran ditutup"}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Keluar
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 pb-24 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 md:items-start">
          <div className="md:col-span-7 lg:col-span-8 space-y-4 md:space-y-6">
          {/* Balance card */}
          <div className="bg-card border border-border rounded-[1.5rem] md:rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-admin-primary/10 blur-2xl pointer-events-none" />
            <p className="text-sm text-muted-foreground mb-1 truncate">Halo, {displayName}</p>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
              </svg>
              Saldo Anda
            </div>
            <h2 className="text-[2.5rem] md:text-5xl font-bold leading-none mb-6 md:mb-8 text-foreground">{formatRupiah(stats.saldo)}</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowWithdraw(true)}
                className="bg-admin-primary text-primary-foreground px-5 md:px-6 py-2.5 rounded-full font-medium text-sm md:text-base flex items-center gap-2 shadow-lg shadow-admin-primary/25 hover:bg-admin-primary/90 transition-colors active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
                Tarik dana
              </button>
              <Link
                to="/riwayat"
                className="bg-transparent border border-border text-foreground px-5 md:px-6 py-2.5 rounded-full font-medium text-sm md:text-base flex items-center gap-2 hover:bg-muted transition-colors active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M12 7v5l4 2"></path>
                </svg>
                Riwayat
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="bg-card border border-border rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-admin-warning-soft rounded-full flex items-center justify-center mb-2">
                <div className="w-2 h-2 bg-admin-warning rounded-full"></div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.menunggu}</p>
              <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase mt-0.5">Menunggu</p>
            </div>
            <div className="bg-card border border-border rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-admin-success-soft rounded-full flex items-center justify-center mb-2">
                <div className="w-2 h-2 bg-admin-success rounded-full"></div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.disetujui}</p>
              <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase mt-0.5">Disetujui</p>
            </div>
            <div className="bg-card border border-border rounded-2xl md:rounded-3xl p-4 md:p-5 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-admin-danger-soft rounded-full flex items-center justify-center mb-2">
                <div className="w-2 h-2 bg-admin-danger rounded-full"></div>
              </div>
              <p className="text-2xl font-bold text-admin-danger">{stats.ditolak}</p>
              <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase mt-0.5">Ditolak</p>
            </div>
          </div>
          </div>

          <div className="md:col-span-5 lg:col-span-4 space-y-4 md:space-y-6">
          {/* Pilih password */}
          <div className="bg-card border border-border rounded-[1.5rem] p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-admin-primary">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
                Pilih password
              </h3>
              <span className="text-xs font-medium text-muted-foreground">Rate {settings.rate.toLocaleString("id-ID")}/Gmail</span>
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              disabled={!settings.submissions_open}
              className="w-full bg-admin-primary text-primary-foreground font-medium py-3 rounded-xl mb-3 shadow-lg shadow-admin-primary/25 hover:bg-admin-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {settings.submissions_open ? "Pilih password" : "Setoran ditutup"}
            </button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {settings.submissions_open
                ? "Password wajib huruf kecil semua. Huruf besar otomatis ditolak."
                : "Setoran sedang ditutup admin. Coba lagi nanti."}
            </p>
          </div>

          {/* WhatsApp */}
          <a
            href="https://whatsapp.com/channel/0029Vb99e0GEquiX1HOVse3o"
            target="_blank"
            rel="noreferrer"
            className="block text-center w-full bg-transparent border border-border text-foreground font-medium py-3 rounded-full hover:bg-muted transition-colors active:scale-[0.98]"
          >
            Saluran WhatsApp
          </a>
          </div>
          </div>
        </main>

        {/* Bottom nav */}
        <nav className="bg-card/95 backdrop-blur border-t border-border p-4 absolute bottom-0 w-full flex justify-center z-20">
          <Link
            to="/menu"
            className="flex items-center gap-2 text-foreground font-medium hover:text-admin-primary transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
            Semua menu
          </Link>
        </nav>

        {showWithdraw && (
          <WithdrawModal
            saldo={stats.saldo}
            minWithdraw={settings.min_withdraw}
            adminFee={settings.admin_fee}
            onClose={() => setShowWithdraw(false)}
            onDone={() => {
              setShowWithdraw(false);
              load();
            }}
          />
        )}
        {showSubmit && (
          <SubmitModal
            rate={settings.rate}
            dailyLimit={settings.daily_submission_limit}
            todayCount={stats.hariIni}
            memberPassword={settings.member_password}
            onClose={() => setShowSubmit(false)}
            onDone={() => {
              setShowSubmit(false);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function WithdrawModal({ saldo, minWithdraw, adminFee, onClose, onDone }: { saldo: number; minWithdraw: number; adminFee: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("DANA");
  const [account, setAccount] = useState("");
  const [accName, setAccName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(amount.replace(/\D/g, ""), 10);
    if (!value || value <= 0) { toast.error("Masukkan jumlah yang valid"); return; }
    if (value < minWithdraw) { toast.error(`Minimal penarikan ${formatRupiah(minWithdraw)}`); return; }
    if (value > saldo) { toast.error("Jumlah melebihi saldo Anda"); return; }
    if (adminFee > 0 && value <= adminFee) { toast.error(`Jumlah harus lebih besar dari biaya admin ${formatRupiah(adminFee)}`); return; }
    if (!account.trim()) { toast.error("Isi nomor tujuan"); return; }
    if (!accName.trim()) { toast.error("Isi nama pemilik rekening"); return; }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("withdrawals").insert({
      user_id: userData.user!.id,
      amount: value,
      method,
      account_info: `${account.trim()} (a.n. ${accName.trim()})`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Permintaan penarikan dikirim");
    onDone();
  };

  return (
    <ModalShell title="Tarik dana" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">
        Saldo tersedia: <span className="font-semibold text-foreground">{formatRupiah(saldo)}</span> · Minimal penarikan{" "}
        <span className="font-semibold text-foreground">{formatRupiah(minWithdraw)}</span>
        {adminFee > 0 && (
          <>
            {" "}· Biaya admin <span className="font-semibold text-foreground">{formatRupiah(adminFee)}</span>
          </>
        )}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Jumlah (Rp)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-admin-primary/40"
        >
          <option>DANA</option>
          <option>GoPay</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Nomor / rekening tujuan"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
        />
        <input
          type="text"
          placeholder="Nama pemilik rekening"
          value={accName}
          onChange={(e) => setAccName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-admin-primary text-primary-foreground font-medium py-3 rounded-xl shadow-lg shadow-admin-primary/25 hover:bg-admin-primary/90 transition-colors disabled:opacity-60"
        >
          {busy ? "Memproses..." : "Kirim permintaan"}
        </button>
      </form>
    </ModalShell>
  );
}

function parseGmailList(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function SubmitModal({ rate, dailyLimit, todayCount, memberPassword, onClose, onDone }: { rate: number; dailyLimit: number; todayCount: number; memberPassword: string; onClose: () => void; onDone: () => void }) {
  const [pasteText, setPasteText] = useState("");
  const [password, setPassword] = useState(memberPassword);
  const [busy, setBusy] = useState(false);
  const gmails = Array.from(new Set(parseGmailList(pasteText)));

  const remaining = dailyLimit > 0 ? Math.max(0, dailyLimit - todayCount) : Infinity;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gmails.length === 0) {
      toast.error("Belum ada Gmail. Masukkan alamat Gmail dulu.");
      return;
    }
    if (!password) {
      toast.error("Password masih kosong");
      return;
    }
    if (password !== password.toLowerCase()) {
      toast.error("Password wajib huruf kecil semua");
      return;
    }
    if (dailyLimit > 0 && todayCount >= dailyLimit) {
      toast.error(`Batas setoran hari ini tercapai (${dailyLimit} Gmail)`);
      return;
    }
    if (dailyLimit > 0 && gmails.length > remaining) {
      toast.error(`Melebihi sisa jatah hari ini (${remaining} Gmail)`);
      return;
    }
    for (const addr of gmails) {
      if (!/^[^\s@]+@gmail\.com$/.test(addr)) {
        toast.error(`Alamat tidak valid: ${addr}`);
        return;
      }
    }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user!.id;
    const { error } = await supabase.from("gmail_submissions").insert(
      gmails.map((gmail_address) => ({ user_id: uid, gmail_address, password, rate })),
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${gmails.length} Gmail terkirim, menunggu persetujuan`);
    onDone();
  };

  return (
    <ModalShell title="Pilih password" onClose={onClose}>
      <p className="text-sm text-muted-foreground mb-4">
        Kirim akun Gmail Anda. Rate <span className="font-semibold text-foreground">{formatRupiah(rate)}</span> per Gmail yang disetujui.
        {dailyLimit > 0 && (
          <> · Sisa hari ini <span className="font-semibold text-foreground">{remaining}</span></>
        )}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">
            Alamat Gmail (1 baris 1 Gmail)
          </label>
          <textarea
            placeholder={"alamat1@gmail.com\nalamat2@gmail.com\nalamat3@gmail.com"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full px-3 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40 resize-y font-mono"
          />
          {gmails.length > 0 && (
            <p className="text-xs text-admin-primary px-1">{gmails.length} Gmail terdeteksi</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">Password (satu untuk semua Gmail)</label>
          <input
            type="text"
            placeholder="Password (huruf kecil semua)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-admin-primary/40"
          />
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {memberPassword
            ? "Password sudah diisi otomatis oleh admin. Langsung kirim saja, tidak perlu diubah."
            : "Password wajib huruf kecil semua. Huruf besar otomatis ditolak. Password dipakai untuk semua Gmail di daftar."}
        </p>
        <button
          type="submit"
          disabled={busy || gmails.length === 0}
          className="w-full bg-admin-primary text-primary-foreground font-medium py-3 rounded-xl shadow-lg shadow-admin-primary/25 hover:bg-admin-primary/90 transition-colors disabled:opacity-60 disabled:shadow-none"
        >
          {busy ? "Mengirim..." : `Kirim ${gmails.length} Gmail`}
        </button>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-[1.5rem] p-6 pb-8 animate-in slide-in-from-bottom-8 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-lg">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Tutup">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
