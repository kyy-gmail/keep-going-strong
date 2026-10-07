import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Semua Menu — AyroGmail" },
      { name: "description", content: "Semua menu AyroGmail: dashboard, riwayat, dan bantuan." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [session]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-app-bg">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="dark text-slate-100 antialiased flex justify-center min-h-screen bg-app-bg">
      <div className="w-full max-w-md bg-app-bg min-h-screen sm:shadow-2xl sm:shadow-black/40 flex flex-col">
        <header className="bg-card/95 backdrop-blur border-b border-border flex items-center gap-3 px-5 py-4 sticky top-0 z-20">
          <Link to="/" className="text-muted-foreground hover:text-foreground p-1" aria-label="Kembali">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </Link>
          <h1 className="font-bold text-lg text-foreground tracking-tight">Semua menu</h1>
        </header>

        <main className="flex-1 px-4 py-6 space-y-3">
          <MenuItem to="/" label="Dashboard" desc="Saldo dan statistik Anda" />
          <MenuItem to="/riwayat" label="Riwayat" desc="Pengiriman Gmail dan penarikan" />
          {isAdmin && <MenuItem to="/admin" label="Panel Admin" desc="Atur tarif, saldo minimal, dan status" />}
          <a
            href="https://whatsapp.com/channel/0029VbAyrogmail"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:bg-muted/60 transition-colors"
          >
            <div>
              <p className="font-medium text-sm text-foreground">Saluran WhatsApp</p>
              <p className="text-xs text-muted-foreground">Info dan pengumuman terbaru</p>
            </div>
            <ChevronIcon />
          </a>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:bg-muted/60 transition-colors text-left"
          >
            <div>
              <p className="font-medium text-sm text-admin-danger">Keluar</p>
              <p className="text-xs text-muted-foreground">Akhiri sesi Anda</p>
            </div>
            <ChevronIcon />
          </button>
        </main>
      </div>
    </div>
  );
}

function MenuItem({ to, label, desc }: { to: string; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:bg-muted/60 transition-colors"
    >
      <div>
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronIcon />
    </Link>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}
