import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { addAdminByEmail, listAdmins, removeAdmin } from "@/lib/admin-users.functions";
import { listMembers, type MemberRow } from "@/lib/members.functions";
import { rejectWithGuide } from "@/lib/reject-guide.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  Download,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "AyroGmail — Panel Admin" },
      { name: "description", content: "Panel admin AyroGmail: atur tarif per Gmail, saldo minimal penarikan, dan status pengiriman pengguna." },
      { property: "og:title", content: "AyroGmail — Panel Admin" },
      { property: "og:description", content: "Panel admin AyroGmail: atur tarif per Gmail, saldo minimal penarikan, dan status pengiriman pengguna." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Submission = {
  id: string;
  user_id: string;
  gmail_address: string;
  password: string;
  status: string;
  rate: number;
  created_at: string;
  rejection_reason?: string | null;
  fix_guide?: string | null;
};
type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  account_info: string;
  status: string;
  created_at: string;
};

const STATUSES = ["menunggu", "disetujui", "ditolak"];
const W_STATUSES = ["menunggu", "selesai", "ditolak"];

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function AdminPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rate, setRate] = useState("");
  const [minWithdraw, setMinWithdraw] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [admins, setAdmins] = useState<{ user_id: string; email: string }[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tab, setTab] = useState<"setoran" | "penarikan">("setoran");
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [section, setSection] = useState<"transaksi" | "member" | "pengaturan" | "admin">("transaksi");

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");
    const admin = !!roles && roles.length > 0;
    setIsAdmin(admin);
    if (!admin) return;
    const [s, w, st, m] = await Promise.all([
      supabase
        .from("gmail_submissions")
        .select("id, user_id, gmail_address, password, status, rate, created_at, rejection_reason, fix_guide")
        .eq("hidden_from_admin", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("withdrawals")
        .select("id, amount, method, account_info, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("rate, min_withdraw, admin_fee, daily_submission_limit, submissions_open, member_password")
        .eq("id", "global")
        .maybeSingle(),
      listMembers().catch<MemberRow[]>((err) => {
        toast.error(err instanceof Error ? err.message : "Gagal memuat daftar member");
        return [];
      }),
    ]);
    setSubs((s.data as unknown as Submission[]) ?? []);
    setWds((w.data as Withdrawal[]) ?? []);
    setMembers(m);
    if (st.data) {
      setRate(String(st.data.rate));
      setMinWithdraw(String(st.data.min_withdraw));
      setAdminFee(String(st.data.admin_fee));
      setDailyLimit(String(st.data.daily_submission_limit));
      setSubmissionsOpen(st.data.submissions_open);
      setMemberPassword(st.data.member_password ?? "");
    }
    try {
      setAdmins(await listAdmins());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat daftar admin");
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseInt(rate.replace(/\D/g, ""), 10);
    const m = parseInt(minWithdraw.replace(/\D/g, ""), 10);
    if (!r || r <= 0) { toast.error("Tarif harus lebih dari 0"); return; }
    if (Number.isNaN(m) || m < 0) { toast.error("Saldo minimal tidak valid"); return; }
    const fee = parseInt(adminFee.replace(/\D/g, ""), 10);
    const limit = parseInt(dailyLimit.replace(/\D/g, ""), 10);
    if (Number.isNaN(fee) || fee < 0) { toast.error("Biaya admin tidak valid"); return; }
    if (Number.isNaN(limit) || limit < 0) { toast.error("Batas setoran harian tidak valid"); return; }
    setSavingSettings(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        rate: r,
        min_withdraw: m,
        admin_fee: fee,
        daily_submission_limit: limit,
        member_password: memberPassword.trim().toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengaturan disimpan");
  };

  const toggleOpen = async () => {
    const next = !submissionsOpen;
    setSubmissionsOpen(next);
    const { error } = await supabase
      .from("app_settings")
      .update({ submissions_open: next, updated_at: new Date().toISOString() })
      .eq("id", "global");
    if (error) {
      setSubmissionsOpen(!next);
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Setoran dibuka" : "Setoran ditutup");
  };


  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) { toast.error("Masukkan email"); return; }
    setSavingAdmin(true);
    try {
      setAdmins(await addAdminByEmail({ data: { email: newAdminEmail } }));
      setNewAdminEmail("");
      toast.success("Admin ditambahkan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah admin");
    }
    setSavingAdmin(false);
  };

  const deleteAdmin = async (userId: string) => {
    if (!window.confirm("Cabut akses admin untuk akun ini?")) return;
    try {
      setAdmins(await removeAdmin({ data: { userId } }));
      toast.success("Akses admin dicabut");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencabut akses admin");
    }
  };

  const setSubStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("gmail_submissions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    toast.success("Status diperbarui");
  };

  const rejectSub = async (id: string) => {
    const reason = window.prompt("Alasan penolakan (jangan tulis password/email/data rahasia):");
    if (!reason || !reason.trim()) return;
    const t = toast.loading("AI sedang menyusun panduan perbaikan...");
    try {
      const r = await rejectWithGuide({ data: { id, reason } });
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status: "ditolak", rejection_reason: r.reason, fix_guide: r.guide } : s)));
      toast.success("Ditolak + panduan dikirim ke member", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menolak", { id: t });
    }
  };

  const copyAllSubs = async () => {
    if (filteredSubs.length === 0) { toast.error("Tidak ada setoran untuk disalin"); return; }
    const text = filteredSubs.map((s) => `${s.gmail_address}:${s.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${filteredSubs.length} setoran disalin`);
    } catch {
      toast.error("Gagal menyalin ke papan klip");
    }
  };

  const downloadAllSubs = () => {
    if (filteredSubs.length === 0) { toast.error("Tidak ada setoran untuk diunduh"); return; }
    const text = filteredSubs.map((s) => `${s.gmail_address}:${s.password}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const stamp = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
    a.href = url;
    a.download = `setoran-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredSubs.length} setoran diunduh sebagai file teks`);
  };

  const deleteSub = async (id: string) => {
    if (!window.confirm("Sembunyikan Gmail ini dari panel admin? Riwayat member tetap tersimpan.")) return;
    const { error } = await supabase.from("gmail_submissions").update({ hidden_from_admin: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSubs((prev) => prev.filter((s) => s.id !== id));
    toast.success("Gmail disembunyikan dari panel admin");
  };

  const deleteWd = async (id: string) => {
    if (!window.confirm("Hapus riwayat penarikan ini secara permanen?")) return;
    const { error } = await supabase.from("withdrawals").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWds((prev) => prev.filter((w) => w.id !== id));
    toast.success("Riwayat penarikan dihapus");
  };

  const setWdStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWds((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    toast.success("Status diperbarui");
  };

  if (loading || !session || isAdmin === null) return <div className="min-h-screen grid place-items-center bg-muted"><div className="size-9 animate-spin rounded-full border-2 border-border border-t-admin-primary" /></div>;

  if (!isAdmin) return (
    <div className="min-h-screen grid place-items-center bg-muted px-6 text-center font-admin-body">
      <div><ShieldCheck className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-4 font-admin-heading text-xl text-foreground">Halaman khusus admin</h1><p className="mt-2 text-sm text-muted-foreground">Akun Anda tidak punya akses ke panel admin.</p><Button asChild className="mt-5 bg-admin-primary text-primary-foreground hover:bg-admin-primary/90"><Link to="/">Kembali ke dashboard</Link></Button></div>
    </div>
  );

  const searchTerms = search.trim().toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const query = searchTerms.length > 0 ? searchTerms[0] : "";
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const memberLabel = (userId: string) => {
    const m = memberById.get(userId);
    return m ? `${m.display_name} (${m.email})` : "Member";
  };
  const jakartaDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  const rangeFilteredSubs = subs.filter((s) => {
    const day = jakartaDay(s.created_at);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });
  const rangeHasFilter = !!dateFrom || !!dateTo;
  const rangeApproved = rangeFilteredSubs.filter((s) => s.status === "disetujui");
  const rangeTotalRp = rangeApproved.reduce((sum, s) => sum + s.rate, 0);
  const memberRangeAgg = new Map<string, { total: number; approved: number; earned: number }>();
  for (const s of rangeFilteredSubs) {
    const agg = memberRangeAgg.get(s.user_id) ?? { total: 0, approved: 0, earned: 0 };
    agg.total += 1;
    if (s.status === "disetujui") {
      agg.approved += 1;
      agg.earned += s.rate;
    }
    memberRangeAgg.set(s.user_id, agg);
  }
  const memberRangeList = [...memberRangeAgg.entries()].sort((a, b) => b[1].total - a[1].total || b[1].earned - a[1].earned);
  const fmtFilterDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const rangeLabel = dateFrom && dateTo
    ? `${fmtFilterDate(dateFrom)} – ${fmtFilterDate(dateTo)}`
    : dateFrom
      ? `Sejak ${fmtFilterDate(dateFrom)}`
      : `Sampai ${fmtFilterDate(dateTo)}`;
  const filteredSubs = searchTerms.length
    ? rangeFilteredSubs.filter((s) => {
        const m = memberById.get(s.user_id);
        return searchTerms.some((term) =>
          s.gmail_address.toLowerCase().includes(term) ||
          (m && (m.display_name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)))
        );
      })
    : rangeFilteredSubs;
  const filteredWds = searchTerms.length
    ? wds.filter((w) => searchTerms.some((term) => w.account_info.toLowerCase().includes(term) || w.method.toLowerCase().includes(term)))
    : wds;
  const pendingSubs = subs.filter((item) => item.status === "menunggu").length;
  const pendingWds = wds.filter((item) => item.status === "menunggu" || item.status === "diproses").length;
  const memberQuery = memberSearch.trim().toLowerCase();
  const filteredMembers = memberQuery
    ? members.filter((m) => m.email.toLowerCase().includes(memberQuery) || m.display_name.toLowerCase().includes(memberQuery))
    : members;
  const navItems = [
    { id: "transaksi" as const, label: "Transaksi", icon: WalletCards },
    { id: "member" as const, label: "Member", icon: Users },
    { id: "pengaturan" as const, label: "Pengaturan", icon: Settings },
    { id: "admin" as const, label: "Admin", icon: UserCog },
  ];
  const inputClass = "mt-2 h-12 w-full rounded-2xl border border-border bg-muted px-4 text-sm text-foreground outline-none transition focus:border-admin-primary focus:ring-2 focus:ring-admin-primary-soft";

  return (
    <div className="dark min-h-screen bg-app-bg px-0 py-0 text-foreground antialiased font-admin-body sm:px-4 sm:py-8">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-hidden bg-background sm:min-h-0 sm:rounded-[2rem] sm:border sm:border-border sm:shadow-2xl sm:shadow-black/40">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Button asChild variant="ghost" size="icon" className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground" title="Kembali ke dashboard"><Link to="/"><ArrowLeft className="size-4" /></Link></Button>
              <div className="min-w-0"><h1 className="font-admin-heading text-lg font-bold tracking-tight">Panel Admin</h1><p className="text-[11px] text-muted-foreground">Kelola setoran & penarikan</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2" title={submissionsOpen ? "Storan sedang dibuka — klik untuk menutup" : "Storan sedang ditutup — klik untuk membuka"}>
              <span className="max-sm:hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Storan</span>
              <button type="button" role="switch" aria-checked={submissionsOpen} aria-label={submissionsOpen ? "Tutup storan untuk member" : "Buka storan untuk member"} onClick={toggleOpen} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${submissionsOpen ? "bg-admin-success" : "bg-admin-danger"}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${submissionsOpen ? "right-0.5" : "left-0.5"}`} />
              </button>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${submissionsOpen ? "bg-admin-success-soft text-admin-success" : "bg-admin-danger-soft text-admin-danger"}`}>{submissionsOpen ? "Dibuka" : "Ditutup"}</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{submissionsOpen ? "Member bisa mengirim Gmail sekarang." : "Pengiriman Gmail sedang ditutup untuk member."}</p>
        </header>

        <main className="space-y-5 px-5 py-5 sm:px-6">
          <section className="grid grid-cols-2 gap-3" aria-label="Ringkasan">
            <button type="button" onClick={() => { setSection("transaksi"); setTab("setoran"); }} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition active:scale-[.98]"><p className="font-admin-heading text-2xl">{pendingSubs}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Setoran menunggu</p></button>
            <button type="button" onClick={() => { setSection("transaksi"); setTab("penarikan"); }} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition active:scale-[.98]"><p className="font-admin-heading text-2xl">{pendingWds}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Penarikan aktif</p></button>
          </section>

          <nav className="flex gap-1 rounded-2xl border border-border bg-card p-1" aria-label="Menu admin">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setSection(id)} className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-[11px] font-bold transition ${section === id ? "bg-admin-primary text-primary-foreground shadow-lg shadow-admin-primary/25" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="size-4 shrink-0" /><span className="truncate">{label}</span>
              </button>
            ))}
          </nav>

          {section === "member" && <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div><h2 className="font-admin-heading text-base">Daftar member</h2><p className="mt-1 text-xs text-muted-foreground">Semua akun yang terdaftar di AyroGmail.</p></div>
              <span className="shrink-0 rounded-full bg-admin-primary-soft px-3 py-1 text-[10px] font-bold uppercase text-admin-primary">{members.length} member</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Cari nama / Gmail member..."
                className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-11 text-sm text-foreground outline-none transition focus:border-admin-primary focus:ring-2 focus:ring-admin-primary-soft"
              />
              {memberSearch && <button type="button" onClick={() => setMemberSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Bersihkan pencarian member"><X className="size-4" /></button>}
            </div>
            {filteredMembers.length === 0 ? <EmptyState text={memberSearch ? "Tidak ada member yang cocok dengan pencarian." : "Belum ada member terdaftar."} /> : filteredMembers.map((m) => <article key={m.user_id} className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-admin-heading text-base">{m.display_name}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{m.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Bergabung {new Date(m.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                {m.user_id === session.user.id && <span className="shrink-0 rounded-full bg-admin-primary-soft px-3 py-1 text-[10px] font-bold uppercase text-admin-primary">Anda</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-muted p-3"><p className="font-admin-heading text-lg">{m.total_subs}</p><p className="text-[10px] font-semibold text-muted-foreground">Setoran</p></div>
                <div className="rounded-2xl bg-muted p-3"><p className="font-admin-heading text-lg">{m.approved_subs}</p><p className="text-[10px] font-semibold text-muted-foreground">Disetujui</p></div>
                <div className="rounded-2xl bg-admin-success-soft p-3"><p className="font-admin-heading text-lg text-admin-success">{formatRupiah(m.earned)}</p><p className="text-[10px] font-semibold text-admin-success">Didapat</p></div>
              </div>
            </article>)}
          </section>}

          {section === "transaksi" && <section className="space-y-4">
            <div className="grid grid-cols-2 rounded-xl border border-border bg-card p-1">
              <Button type="button" variant="ghost" onClick={() => setTab("setoran")} className={`rounded-lg ${tab === "setoran" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Clipboard className="size-4" />Setoran</Button>
              <Button type="button" variant="ghost" onClick={() => setTab("penarikan")} className={`rounded-lg ${tab === "penarikan" ? "bg-muted text-foreground" : "text-muted-foreground"}`}><WalletCards className="size-4" />Penarikan</Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Gmail / nomor tujuan... (bisa banyak, pisahkan dengan spasi)"
                className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-11 text-sm text-foreground outline-none transition focus:border-admin-primary focus:ring-2 focus:ring-admin-primary-soft"
              />
              {search && <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Bersihkan pencarian"><X className="size-4" /></button>}
            </div>
            {tab === "setoran" && <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" onClick={copyAllSubs} variant="outline" className="h-11 rounded-xl border-border bg-muted text-foreground hover:bg-muted/70 hover:text-foreground"><Copy className="size-4" />Salin{filteredSubs.length > 0 ? ` (${filteredSubs.length})` : ""}</Button>
                <Button type="button" onClick={downloadAllSubs} variant="outline" className="h-11 rounded-xl border-border bg-muted text-foreground hover:bg-muted/70 hover:text-foreground"><Download className="size-4" />Unduh file</Button>
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rentang tanggal</p>
                  {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground">Reset</button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-muted-foreground">Dari<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} mt-1`} /></label>
                  <label className="block text-xs font-semibold text-muted-foreground">Sampai<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} mt-1`} /></label>
                </div>
              </div>
              {rangeHasFilter && (rangeFilteredSubs.length === 0 ? <EmptyState text="Tidak ada setoran pada rentang tanggal ini." /> : <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div><h2 className="font-admin-heading text-base">Ringkasan periode</h2><p className="mt-1 text-xs text-muted-foreground">{rangeLabel}</p></div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted p-3"><p className="font-admin-heading text-lg">{rangeFilteredSubs.length}</p><p className="text-[10px] font-semibold text-muted-foreground">Setoran</p></div>
                  <div className="rounded-xl bg-admin-success-soft p-3"><p className="font-admin-heading text-lg text-admin-success">{rangeApproved.length}</p><p className="text-[10px] font-semibold text-admin-success">Disetujui</p></div>
                  <div className="rounded-xl bg-admin-success-soft p-3"><p className="font-admin-heading text-lg text-admin-success">{formatRupiah(rangeTotalRp)}</p><p className="text-[10px] font-semibold text-admin-success">Nilai</p></div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Per member</p>
                  {memberRangeList.map(([uid, agg]) => <div key={uid} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-2"><p className="min-w-0 truncate text-xs font-semibold">{memberLabel(uid)}</p><p className="shrink-0 text-xs text-muted-foreground">{agg.total} setoran{agg.approved > 0 ? ` · ${formatRupiah(agg.earned)}` : ""}</p></div>)}
                </div>
              </div>)}
              {filteredSubs.length === 0 ? <EmptyState text={query ? "Tidak ada Gmail yang cocok dengan pencarian." : rangeHasFilter ? "Tidak ada setoran pada rentang tanggal ini." : "Belum ada setoran."} /> : filteredSubs.map((s) => (
                <article key={s.id} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <h2 className="truncate font-admin-heading text-sm font-semibold">{s.gmail_address}</h2>
                      <p className="truncate text-xs font-medium text-admin-primary">Storan: {memberLabel(s.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")} · {formatRupiah(s.rate)}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-app-bg p-3">
                    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password</p><p className="break-all font-mono text-xs text-admin-primary">{s.password}</p></div>
                    <Button type="button" size="icon" variant="outline" className="size-8 shrink-0 rounded-lg" title="Salin password" onClick={() => { navigator.clipboard.writeText(s.password); toast.success("Password disalin"); }}><Copy className="size-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">{STATUSES.map((st) => <StatusButton key={st} status={st} current={s.status} onClick={() => (st === "ditolak" ? rejectSub(s.id) : setSubStatus(s.id, st))} />)}</div>
                  {s.status === "ditolak" && s.fix_guide && <div className="space-y-1 rounded-xl border border-admin-danger/30 bg-admin-danger-soft p-3 text-xs"><p className="font-bold text-admin-danger">Alasan: {s.rejection_reason}</p><p className="whitespace-pre-line text-foreground">{s.fix_guide}</p></div>}
                  <Button type="button" variant="ghost" onClick={() => deleteSub(s.id)} className="w-full rounded-xl text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger"><Trash2 />Hapus dari panel admin</Button>
                </article>
              ))}
            </div>}
            {tab === "penarikan" && (filteredWds.length === 0 ? <EmptyState text={search ? "Tidak ada penarikan yang cocok dengan pencarian." : "Belum ada penarikan."} /> : filteredWds.map((w) => <article key={w.id} className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-admin-heading text-xl">{formatRupiah(w.amount)}</h2><p className="mt-1 truncate text-sm font-medium text-muted-foreground">{w.method} · {w.account_info}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("id-ID")}</p></div><StatusBadge status={w.status} /></div><div className="grid grid-cols-3 gap-2">{W_STATUSES.map((st) => <StatusButton key={st} status={st} current={w.status} onClick={() => setWdStatus(w.id, st)} />)}</div><Button type="button" variant="ghost" onClick={() => deleteWd(w.id)} className="w-full rounded-xl text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger"><Trash2 />Hapus riwayat</Button></article>))}
          </section>}

          {section === "pengaturan" && <section className="space-y-4"><form onSubmit={saveSettings} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"><div><h2 className="font-admin-heading text-base">Pengaturan transaksi</h2><p className="mt-1 text-xs text-muted-foreground">Atur tarif dan batas transaksi member.</p></div>{[["Tarif per Gmail (Rp)",rate,setRate],["Saldo minimal penarikan (Rp)",minWithdraw,setMinWithdraw],["Biaya admin per penarikan (Rp)",adminFee,setAdminFee],["Batas setoran Gmail per hari (0 = tanpa batas)",dailyLimit,setDailyLimit],["Password setoran untuk member (huruf kecil, kosongkan bila member isi sendiri)",memberPassword,setMemberPassword]] .map(([label,value,setter]) => <label key={label as string} className="block text-xs font-semibold text-muted-foreground">{label as string}<input type="text" inputMode={label==="Password setoran untuk member (huruf kecil, kosongkan bila member isi sendiri)"?undefined:"numeric"} value={value as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className={inputClass} /></label>)}<Button type="submit" disabled={savingSettings} className="h-12 w-full rounded-2xl bg-admin-primary text-primary-foreground hover:bg-admin-primary/90">{savingSettings ? "Menyimpan..." : "Simpan pengaturan"}</Button></form></section>}

          {section === "admin" && <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"><div><h2 className="font-admin-heading text-base">Daftar admin</h2><p className="mt-1 text-xs text-muted-foreground">Kelola siapa yang dapat membuka panel ini.</p></div><form onSubmit={addAdmin} className="space-y-3"><input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="email akun terdaftar" className={inputClass} /><Button type="submit" disabled={savingAdmin} className="h-11 w-full rounded-2xl bg-admin-primary text-primary-foreground hover:bg-admin-primary/90">{savingAdmin ? "Menambahkan..." : "Tambah admin"}</Button></form>{admins.length === 0 ? <EmptyState text="Belum ada admin terdaftar." /> : <ul className="space-y-2">{admins.map((a) => <li key={a.user_id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{a.email}</p>{a.user_id === session.user.id && <p className="text-xs text-admin-primary">Akun Anda</p>}</div>{a.user_id !== session.user.id && <Button type="button" size="sm" variant="ghost" onClick={() => deleteAdmin(a.user_id)} className="rounded-xl text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger">Cabut</Button>}</li>)}</ul>}</section>}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{text}</div>; }

function StatusButton({ status, current, onClick }: { status: string; current: string; onClick: () => void }) {
  const icon = status === "ditolak" ? <X /> : status === "menunggu" ? <Clipboard /> : <Check />;
  const active = current === status;
  const tone = status === "ditolak"
    ? "border-admin-danger/40 bg-admin-danger-soft text-admin-danger"
    : status === "menunggu"
      ? "border-admin-warning/40 bg-admin-warning-soft text-admin-warning"
      : "border-admin-success/40 bg-admin-success-soft text-admin-success";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[10px] font-bold capitalize transition ${active ? tone : "border-border bg-muted text-muted-foreground hover:text-foreground"}`}
    >
      {icon}{status}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "disetujui" || status === "selesai" ? "bg-admin-success-soft text-admin-success" : status === "ditolak" ? "bg-admin-danger-soft text-admin-danger" : "bg-admin-warning-soft text-admin-warning";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold capitalize ${tone}`}>{status}</span>;
}
