import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Remove anything that looks like secret data before it reaches the AI model.
function sanitize(text: string) {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(password|pass|sandi|pw)\s*[:=]?\s*\S+/gi, "$1 [disembunyikan]")
    .replace(/\b\d{6,}\b/g, "[angka]")
    .slice(0, 500)
    .trim();
}

async function streamGuide(reason: string, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      input: [
        {
          role: "system",
          content:
            "Kamu membantu member aplikasi setoran Gmail yang awam teknologi. Dari alasan penolakan admin, tulis panduan perbaikan singkat. Aturan WAJIB: (1) seluruh jawaban HANYA dalam Bahasa Indonesia sehari-hari yang mudah dipahami orang awam, dilarang memakai bahasa Inggris atau campuran; (2) dilarang memakai istilah teknis seperti server, akun terverifikasi, autentikasi, verifikasi dua langkah, cookie, browser, format, atau istilah IT lain — gunakan kata sederhana, misalnya 'masuk ke Gmail' bukan 'login'; (3) susun 1 kalimat penjelasan lalu 2-4 langkah bernomor yang jelas dan bisa langsung dikerjakan; (4) maksimal 90 kata; (5) jangan pernah meminta atau menyebut password, email, atau data rahasia.",
        },
        { role: "user", content: `Alasan penolakan: ${reason}` },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("Kredit AI habis. Tambah kredit di pengaturan workspace.");
    if (res.status === 429) throw new Error("AI sedang sibuk, coba lagi sebentar.");
    throw new Error(`AI gagal (${res.status}) ${msg.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new Error("AI gagal menyusun panduan.");
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("AI")) throw e;
      }
    }
  }
  if (!out.trim()) throw new Error("AI tidak mengembalikan panduan.");
  return out.trim();
}

export const rejectWithGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string }) => {
    if (!d?.id || typeof d.reason !== "string") throw new Error("Data tidak valid");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin");
    if (!roles?.length) throw new Error("Akses ditolak: bukan admin.");
    const reason = sanitize(data.reason);
    if (!reason) throw new Error("Alasan penolakan wajib diisi.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Konfigurasi AI belum tersedia.");
    const guide = await streamGuide(reason, apiKey);
    const { error } = await context.supabase
      .from("gmail_submissions")
      .update({ status: "ditolak", rejection_reason: reason, fix_guide: guide } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { reason, guide };
  });
