// Lógica da função «convidar-aluno» (sem dependências: recebe tudo por parâmetro, por isso testa-se em Node).
// Só um PROFISSIONAL autenticado pode pedir um link, e só para um email que já tenha convite numa ficha de aluno.
// Não envia email nenhum: devolve o token (já em hash) que a app transforma num link próprio.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ORIGINS = ["https://tiagojvlourenco.github.io", "http://localhost", "http://127.0.0.1"];

export function corsHeaders(origin, allowed) {
  const list = (allowed && allowed.length ? allowed : DEFAULT_ORIGINS);
  const ok = origin && list.some((o) => origin === o || origin.startsWith(o + ":"));
  return {
    "Access-Control-Allow-Origin": ok ? origin : list[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(status, headers, json) {
  return { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, json };
}

// deps: getUser(authorization) → {id} | null · isProfessional(userId) → boolean · hasInvite(email) → boolean
//       generateLink(type, email) → {data, error}   (type: "invite" | "recovery")
export async function handleConvidar(req, deps) {
  const h = corsHeaders(req.origin, req.allowedOrigins);
  if (req.method === "OPTIONS") return { status: 204, headers: h, json: null };
  if (req.method !== "POST") return reply(405, h, { erro: "Método não permitido.", codigo: "metodo" });

  const user = req.authorization ? await deps.getUser(req.authorization) : null;
  if (!user || !user.id) return reply(401, h, { erro: "Sessão inválida. Entra de novo na app.", codigo: "sem_sessao" });
  if (!(await deps.isProfessional(user.id))) return reply(403, h, { erro: "Só o profissional pode gerar links de convite.", codigo: "nao_profissional" });

  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return reply(400, h, { erro: "Email inválido.", codigo: "email_invalido" });
  if (!(await deps.hasInvite(email))) return reply(404, h, { erro: "Não há nenhum aluno convidado com este email. Cria primeiro a ficha do aluno.", codigo: "sem_convite" });

  let tipo = "invite";
  let res = await deps.generateLink("invite", email);
  if (res.error && /already|exists|registered/i.test((res.error.code || "") + " " + (res.error.message || ""))) {
    tipo = "recovery";               // a conta já existe: o link serve para definir uma password nova
    res = await deps.generateLink("recovery", email);
  }
  const token = res && res.data && res.data.properties && res.data.properties.hashed_token;
  if (res.error || !token) return reply(502, h, { erro: "Não foi possível gerar o link. Tenta de novo daqui a pouco.", codigo: "geracao" });
  return reply(200, h, { tipo, token_hash: token, email });
}
