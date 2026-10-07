import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat — AyroGmail" },
      { name: "description", content: "Riwayat pengiriman Gmail dan penarikan dana Anda." },
    ],
  }),
  component: RiwayatPage,
});

type Submission = {
  id: string;
  gmail_address: string;
  status: "menunggu" | "disetujui" | "ditolak";
  rate: number;
  created_at: string;
  rejection_reason?: string | null;
  fix_guide?: string | null;
};
type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  menunggu: "bg-admin-warning-soft text-admin-warning",
  disetujui: "bg-admin-success-soft text-admin-success",
  ditolak: "bg-admin-danger-soft text-admin-danger",
  diproses: "bg-admin-primary-soft text-admin-primary",
  selesai: "bg-admin-success-soft text-admin-success",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RiwayatPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<"gmail" | "dana">("gmail");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    supabase
      .from("gmail_submissions")
      .select("id, gmail_address, status, rate, created_at, rejection_reason, fix_guide")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSubmissions((data as unknown as Submission[]) ?? []));
    supabase
      .from("withdrawals")
      .select("id, amount, method, status, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .then(({ data }) => setWithdrawals((data as Withdrawal[]) ?? []));
  }, [session?.user.id]);

  if (loading || !session) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-app-bg">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="dark text-slate-100 antialiased flex justify-center min-h-screen bg-app-bg">
      <div className="w-full max-w-md bg-app-bg min-h-screen sm:shadow-2xl sm:shadow-black/40 flex flex-col">
        <header className="bg-card/95 backdrop-blur border-b border-border flex items-center gap-3 px-5 py-4 sticky top-0 z-20">
          <Link to="/" className="text-muted-foreground hover:text-foreground p-1" aria-label="Kembali">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </Link>
          <h1 className="font-bold text-lg text-foreground tracking-tight">Riwayat</h1>
        </header>

        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-border bg-card p-1 flex">
            <button
              onClick={() => setTab("gmail")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "gmail" ? "bg-admin-primary text-primary-foreground shadow-lg shadow-admin-primary/25" : "text-muted-foreground"}`}
            >
              Gmail
            </button>
            <button
              onClick={() => setTab("dana")}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "dana" ? "bg-admin-primary text-primary-foreground shadow-lg shadow-admin-primary/25" : "text-muted-foreground"}`}
            >
              Penarikan
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 py-4 space-y-3 overflow-y-auto scrollbar-thin">
          {tab === "gmail" &&
            (submissions.length === 0 ? (
              <EmptyState text="Belum ada Gmail yang dikirim" />
            ) : (
              submissions.map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="font-medium text-sm text-foreground truncate">{s.gmail_address}</p>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize shrink-0 ${statusStyle[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Rp {s.rate.toLocaleString("id-ID")}</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                  {s.status === "ditolak" && (s.rejection_reason || s.fix_guide) && (
                    <div className="mt-3 rounded-xl border border-admin-danger/30 bg-admin-danger-soft p-3 text-xs space-y-1">
                      {s.rejection_reason && <p className="font-semibold text-admin-danger">Alasan ditolak: {s.rejection_reason}</p>}
                      {s.fix_guide && <p className="whitespace-pre-line text-foreground/90">{s.fix_guide}</p>}
                    </div>
                  )}
                </div>
              ))
            ))}

          {tab === "dana" &&
            (withdrawals.length === 0 ? (
              <EmptyState text="Belum ada penarikan dana" />
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="font-medium text-sm text-foreground">
                      Rp {w.amount.toLocaleString("id-ID")} · {w.method}
                    </p>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize shrink-0 ${statusStyle[w.status] ?? "bg-muted text-muted-foreground"}`}>
                      {w.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{formatDate(w.created_at)}</p>
                </div>
              ))
            ))}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
