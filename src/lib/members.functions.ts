import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberRow = {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  total_subs: number;
  approved_subs: number;
  earned: number;
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Akses ditolak: bukan admin.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: users }, { data: profiles }, { data: subs }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, display_name, created_at"),
      supabaseAdmin.from("gmail_submissions").select("user_id, status, rate"),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));
    return (users?.users ?? [])
      .map((u) => {
        const prof = profileMap.get(u.id);
        const mine = (subs ?? []).filter((s) => s.user_id === u.id);
        const approved = mine.filter((s) => s.status === "disetujui");
        return {
          user_id: u.id,
          email: u.email ?? "(tanpa email)",
          display_name:
            (prof?.display_name as string | null) ??
            (u.email ? String(u.email).split("@")[0] : "(tanpa nama)"),
          created_at: (prof?.created_at as string | undefined) ?? u.created_at,
          total_subs: mine.length,
          approved_subs: approved.length,
          earned: approved.reduce((acc, s) => acc + (Number(s.rate) || 0), 0),
        } as MemberRow;
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  });
