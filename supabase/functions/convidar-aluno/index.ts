// Edge Function «convidar-aluno» — gera um link de convite (ou de nova password) SEM enviar email.
// Publicar: ver docs/OPERACOES.md (secção 8s). Usa as variáveis que o Supabase já fornece:
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (esta nunca sai do servidor).
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleConvidar } from "./core.mjs";

Deno.serve(async (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);

  let body: unknown = null;
  if (request.method === "POST") { try { body = await request.json(); } catch { body = null; } }

  const out = await handleConvidar(
    { method: request.method, origin: request.headers.get("origin") || "", authorization: request.headers.get("authorization") || "", body, allowedOrigins: allowed },
    {
      // quem pede: valida o token do utilizador (não confia no que vem no corpo do pedido)
      getUser: async (authorization: string) => {
        const c = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
        const { data, error } = await c.auth.getUser();
        return error || !data?.user ? null : { id: data.user.id };
      },
      isProfessional: async (userId: string) => {
        const { data } = await admin.from("professionals").select("user_id").eq("user_id", userId).maybeSingle();
        return !!data;
      },
      hasInvite: async (email: string) => {
        const { data } = await admin.from("students").select("id").eq("invite_email", email).limit(1);
        return !!(data && data.length);
      },
      generateLink: async (type: "invite" | "recovery", email: string) => {
        const { data, error } = await admin.auth.admin.generateLink({ type, email } as never);
        return { data, error: error ? { code: (error as { code?: string }).code || "", message: error.message } : null };
      },
    },
  );
  return new Response(out.json === null ? null : JSON.stringify(out.json), { status: out.status, headers: out.headers });
});
