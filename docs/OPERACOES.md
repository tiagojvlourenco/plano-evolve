# Evolve Nutrition — Operações (Fase 9)

Este documento cobre o que é preciso saber e fazer para operar a app com alunos reais: como criar contas, arquivar dados de demonstração, recuperar de um erro, e o que confirmar antes de convidar o primeiro aluno real.

Nada aqui substitui os ficheiros de migração em `supabase/migrations/` — este documento explica **quando e porquê** os usar, não repete o SQL.

## 1. Criar o primeiro aluno real

1. Aplica `0010_demo_flag.sql` (ver secção 6) — sem isto, o novo aluno ainda aparece misturado com os de demonstração.
2. No dashboard do profissional → **"+ Convidar aluno"** → preenche o questionário com o **email real** do aluno.
3. Copia o link da app (botão "Copiar" no modal de convite) e envia-o ao aluno, junto com a instrução: "cria conta com este mesmo email".
4. O aluno cria conta, confirma o email (link que a Supabase lhe envia), volta à app e entra — a app associa a conta automaticamente (`claim_student_row`, já validado com contas reais).
5. Confirma no dashboard: o aluno aparece na lista principal, sem a etiqueta "demonstração", sem precisares de ativar "Mostrar contas de demonstração".

## 2. Gerir profissionais

Ver `supabase/manage_professionals.sql` — é o único sítio onde isto se faz (a tabela `professionals` não tem nenhuma política de escrita via app, por desenho). Resumo:

- **Adicionar**: a pessoa faz login uma vez na app com o email dela; depois corres o `insert` do ficheiro no SQL Editor.
- **Remover**: `delete` do mesmo ficheiro. Não apaga a conta de autenticação, só o acesso de profissional.

## 3. Dados de demonstração — arquivar sem apagar

Depois de aplicar `0010_demo_flag.sql`, Maria/Rui/Sofia/Tiago ficam marcados `is_demo = true` e desaparecem da lista principal do dashboard, sem serem apagados. Para os veres outra vez, usa o botão **"Mostrar contas de demonstração"** no dashboard.

Isto é reversível a qualquer momento:

```sql
-- Voltar a mostrar um aluno de demonstração por omissão
update students set is_demo = false where id = 'maria';

-- Marcar um aluno real como demonstração (ex.: uma conta de teste tua)
update students set is_demo = true where id = '<id>';
```

Nunca apagues estas linhas só porque são de demonstração — mantém-nas para referência e para voltares a testar fluxos sem criar dados novos.

## 4. Fotografias — privacidade e remoção

- O bucket `progress-photos` é privado; as imagens só são acessíveis por URLs assinados de 6h, recalculados a cada sessão — nunca gravados como permanentes (corrigido na Fase 9: um bug fazia com que esse URL temporário pudesse ser gravado por engano na base de dados; ver commit correspondente).
- Um aluno remove a própria fotografia diretamente na app (separador Evolução → "✕" sobre a foto). O profissional tem o mesmo botão na vista do aluno, para quando o pedido chega por outro canal.
- Exige `0011_photo_deletion.sql` aplicada (políticas de `delete` no Storage — não existiam antes desta fase).
- Em último recurso (sem depender destas políticas), qualquer fotografia pode ser apagada manualmente em **Storage → progress-photos** no dashboard — nesse caso, apaga também a entrada correspondente em `students.photos` para não ficar um caminho morto.

## 5. Cópias de segurança e recuperação

- **Base de dados**: a Supabase faz backups automáticos cuja frequência/retenção depende do plano do projeto (Free vs. Pro+) — confirma no dashboard em **Settings → Add-ons/Backups** qual se aplica ao teu projeto antes de assumires qualquer garantia. Para uma cópia manual pontual (antes de uma alteração arriscada, por exemplo): **Database → Backups → Download** no dashboard, ou `pg_dump` com a connection string do projeto (Settings → Database), nunca com a chave publicável.
- **Storage** (`progress-photos`): não tem backup automático separado da base de dados nas configurações por omissão — para uma cópia pontual, usa o dashboard (Storage → progress-photos → selecionar tudo → download) ou um script com a service-role key **corrido fora do browser** (nunca no cliente da app).
- **Recuperação de erro de dados**: se uma gravação incorreta afetar um aluno específico, o histórico de `substitution_history`/`adaptation_history` é *append-only* (nunca é possível perder eventos já registados por reescrita, só por restauro de um backup anterior). Para reverter uma linha inteira, usa um backup da base de dados (dashboard) — não há "undo" dentro da app.
- **Nunca**: nenhuma service-role key deve alguma vez ser colada no código do cliente (`evolve-nutrition.html`) nem em nenhum ficheiro servido ao browser. Todas as ações que precisam dela (restauro, exports em massa, gestão de utilizadores de auth) fazem-se **só no dashboard do Supabase**.

## 6. Ações manuais necessárias no Supabase (antes do primeiro aluno real)

Nenhuma destas pode ser feita por uma migração SQL nem pela app — confirma cada uma no dashboard:

- [ ] **Authentication → URL Configuration**: `Site URL` e `Redirect URLs` apontam para `https://tiagojvlourenco.github.io/plano-evolve/` (não `localhost`). Sem isto, os links de confirmação de email e de recuperação de password de um aluno real vão parar ao sítio errado.
- [ ] **Authentication → Email Templates**: confirmar que os templates de "Confirm signup" e "Reset password" estão em português (ou pelo menos claros) — por omissão vêm em inglês genérico da Supabase.
- [ ] **Authentication → Providers → Email**: confirmar que "Confirm email" está ativo (já parece estar, confirmado empiricamente nesta sessão) e decidir se queres manter a confirmação obrigatória para alunos reais.
- [ ] **Database → Backups**: confirmar o plano/retenção aplicável (ver secção 5).
- [x] Aplicar `0010_demo_flag.sql` e `0011_photo_deletion.sql` — aplicadas e validadas em produção em 2026-09-28.
- [ ] Correr `supabase/manage_professionals.sql` para qualquer profissional adicional além da tua conta.

## 7. Checklist operacional — migrações desta fase

- [x] Ler o resultado desta Fase 9 e confirmar que concordas com as alterações.
- [x] Aplicar `0010_demo_flag.sql` no SQL Editor — aplicada em 2026-09-28 (com `disable`/`enable trigger` em torno do UPDATE, ver nota abaixo).
- [x] Aplicar `0011_photo_deletion.sql` no SQL Editor — aplicada em 2026-09-28.
- [x] Correr as queries 11 e 12 de `verify_security.sql` — `is_demo` confirmado em maria/rui/sofia/tiago; as 2 políticas de delete confirmadas.
- [x] Correr o teste funcional H de `verify_security.sql` com uma conta de aluno real (Tiago) e uma fotografia sintética criada só para o teste — upload, listagem, remoção e limpeza final confirmados sem resíduos.
- [ ] Confirmar as 3 ações manuais de Auth da secção 6 no dashboard (ainda pendente da tua parte).
- [ ] Só depois disto, `git push` (nada foi publicado ainda nesta fase).

**Achado durante a aplicação de `0010`**: correr o `UPDATE` do backfill diretamente no SQL Editor falhou com "Só o profissional pode alterar estes dados do plano." — o trigger `enforce_student_column_permissions()` usa `auth.uid()`, que no contexto de uma ligação direta do SQL Editor (sem JWT de sessão) devolve `null`; sem isso ser reconhecido como profissional, o trigger tratou a alteração como se fosse um aluno a tentar mexer numa coluna fora da allowlist. Corrigido desligando o trigger só para esse UPDATE administrativo pontual e voltando a ligá-lo de imediato (ver o SQL final em `0010_demo_flag.sql`).

**Achado durante a validação do teste funcional H (mais importante que o da migração)**: `persistStudent()` usava `upsert()`, que falha sempre que é o PRÓPRIO ALUNO a gravar a sua linha (RLS rejeita o ramo `ON CONFLICT DO UPDATE` de um upsert por não haver política de `INSERT` para o aluno — e não deve haver, para impedir que crie linhas novas). **Isto impedia qualquer aluno real de gravar seja o que for** — concluir uma refeição, um check-in, uma fotografia — não só a funcionalidade desta fase. Corrigido: `persistStudent()` passou a usar `update().eq("id", s.id)`; a criação de um aluno novo (sempre pelo profissional) passou a usar uma função separada, `insertStudent()`. Validado ao vivo: um `update()` simples na linha do Tiago, que antes falhava com erro de RLS, passou a funcionar sem erro depois da correção.

## 8. Checklist de lançamento — antes do primeiro aluno real de verdade

- [ ] Profissional cria e gere um aluno (perfil, plano, alvos) sem erros.
- [ ] Aluno cria conta através de um convite real, confirma o email, e entra na app.
- [ ] Aluno só vê os seus próprios dados (já validado por RLS com contas reais nas Fases 7-9; repetir visualmente com a conta real do primeiro aluno).
- [ ] Aluno consulta o plano, adapta uma refeição, envia um check-in, e envia um pedido de ajuda.
- [ ] Profissional vê as alterações do aluno, o pedido de ajuda, e os indicadores da Leitura profissional.
- [ ] Aluno recupera o acesso: pede recuperação de password, recebe o email, define password nova, entra.
- [ ] Fotografias: aluno envia, vê, e remove uma fotografia; profissional só vê o que o aluno autorizou.
- [ ] App testada num telemóvel real (não só emulação) — ecrã de login, refeição, modais, check-in.
- [ ] `npm test` passa (ver resultado no relatório desta fase).

## 8b. Migração 0022 (telefone, contactos e alunos novos)

- [ ] Correr `supabase/migrations/0022_contact_and_onboarding.sql` no SQL Editor (é repetível). Sem ela a app funciona, mas o telefone e o registo de contactos não ficam guardados (a app avisa uma vez) e o painel de retenção esquece os contactos ao recarregar.
- Depois de correr: as fichas que já existem ficam sem data de criação e **não** contam como "alunos novos"; as novas (e só elas) entram no cartão de onboarding durante 30 dias.

## 8c. Migração 0023 (pacotes, presenças e cobranças)

- [ ] Correr `supabase/migrations/0023_studio_packs.sql` no SQL Editor (é repetível). Sem ela, o menu **Estúdio** e o separador **Pacotes** avisam que falta a migração; o resto da app não é afetado.
- **Regras por omissão** (escolhidas ao criar cada pacote): faltar sem aviso **gasta** uma sessão; cancelar tarde **gasta**; cancelar a tempo **nunca** gasta. Validade por omissão: 3 meses (0 = sem validade). A sessão é descontada ao pacote que caduca primeiro.
- A app **não cobra** nem emite faturas: regista cobranças e exporta CSV (cobranças e sessões do mês) para a contabilidade. A fatura certificada continua a ser emitida no programa de faturação.
- Os dados de pacotes e cobranças só são legíveis por profissionais (RLS); os alunos nunca os veem.

## 8d. Migração 0024 (horário semanal e contagem automática) e fim do script de e-mail

- [ ] Correr `supabase/migrations/0024_studio_agenda.sql` no SQL Editor (depois da 0023; é repetível). Sem ela, o Estúdio funciona só com registo à mão (sem horários nem "aulas já dadas").
- [ ] Importar os pacotes que estão a decorrer: Estúdio → "Importar pacotes que já estão a decorrer" (uma linha por aluno: nome; aulas; início; valor; aulas já dadas; e, opcional, validade em meses — sem a sexta coluna o pacote não caduca). As aulas já dadas vêm do "em falta" da folha de cálculo.
- [ ] Definir o horário semanal de cada aluno (ficha → Pacotes → Horário semanal). A app conta sozinha cada sessão depois de passar; só precisas de marcar as exceções na Agenda do Estúdio.
- [ ] Durante 1 ou 2 semanas, comparar o "Resumo de treinos" da app com o e-mail do script. Quando bater certo, apaga o *trigger* semanal do Google Apps Script (função `listarTriggers` / "Recriar trigger semanal" do menu da folha).
- O horário semanal conta as aulas sem precisares do Google Agenda (ver 8e para ler o calendário a sério). Aulas que não seguem o horário (extra, mudadas de dia) registam-se na secção "Sessão fora do horário". A "falta" (cor 11 no calendário) marca-se como "Faltou"; por omissão também gasta uma sessão, como no script.
- O limite de "a acabar" passa a ser o número de aulas por semana do aluno (mínimo 2). No script, a fórmula `(aulas/4)/13` arredondada dava quase sempre 1.

## 8e. Migração 0025 e ligação ao Google Agenda (só leitura)

- [ ] Correr `supabase/migrations/0025_google_calendar.sql` (depois da 0024; é repetível). Cria `studio_settings` (só profissionais), `sessions.external_id` e a origem `calendario`.
- [ ] **Google Cloud Console** (uma vez, com a conta Google que tem a agenda):
  1. Criar um projeto (ou usar um existente) e ativar a **Google Calendar API**.
  2. *Ecrã de consentimento OAuth*: tipo **Externo**, nome da app, o teu e-mail; adicionar o âmbito `https://www.googleapis.com/auth/calendar.readonly`; adicionar o teu e-mail como *utilizador de teste*.
  3. *Credenciais → Criar credenciais → ID de cliente OAuth → Aplicação Web*. Em **Origens JavaScript autorizadas** pôr o endereço da app (`https://tiagojvlourenco.github.io`, sem barra no fim nem caminho). Não é preciso URI de redirecionamento.
  4. Copiar o **ID de cliente** (`…apps.googleusercontent.com`) para Estúdio → Google Agenda e guardar.
  5. Em modo *Teste* a autorização caduca ao fim de ~7 dias (pede para voltar a autorizar). Para não repetir, publicar a app no ecrã de consentimento (*Publicar app*); para uso próprio com um só âmbito de leitura, não precisa de verificação extensa (aparece o aviso "app não verificada" e carregas em *Avançadas → continuar*).
- [ ] Estúdio → Google Agenda → **Sincronizar**. Abre a janela de autorização da Google; a app lê os eventos desde o pacote mais antigo ainda em vigor (por omissão 120 dias, máximo 400) até hoje, e cria/atualiza/remove as sessões `calendario`.
- Como reconhece o aluno: título `PT 60 - Nome` (parte depois do último " - "), o título igual ao nome, ou o nome completo dentro do título (se só um aluno bater). Títulos que não batem aparecem na lista "sem aluno" e podes associá-los a um aluno (alias, guardado nas definições). Eventos de dia inteiro e cancelados são ignorados; a cor **Tomate (11)** = faltou, as restantes = feita; só contam eventos até ao fim do dia de hoje.
- **Só eventos que começam por…** (por omissão `PT`): só os eventos cujo título começa por esse prefixo («PT 60 - Nome», «PT Duo…») contam como aulas. Reuniões, feriados, aniversários e outros compromissos nem contam nem aparecem na lista. Deixa o campo vazio para ler todos. Ao sincronizar, as sessões que vieram de eventos que já não passam no filtro são removidas.
- Se a fonte for o calendário, a geração automática do horário semanal fica em pausa (para não contar duas vezes). Uma sessão do calendário que editas na Agenda passa a manual e a sincronização deixa de lhe mexer.
- Acrescentar o que já foi dado: se um pacote tem "aulas já dadas" > 0 **e** o calendário cobre essas aulas, são contadas duas vezes. A app avisa no resumo da sincronização; põe "já dadas" a 0 nesses pacotes.
- Segurança: o *token* de acesso fica só na memória (nunca é guardado nem enviado para o Supabase) e o âmbito é só de leitura. Só o ID de cliente e os alias ficam guardados (`studio_settings`, ou `localStorage` em modo local).
- Limites: sincronizar exige um clique (a Google abre uma janela); sem o clique não há leitura em segundo plano.

## 8f. Migração 0026 e criar alunos a partir da agenda

- [ ] Correr `supabase/migrations/0026_studio_only_students.sql` (depois da 0025; é repetível). Acrescenta `students.studio_only`. Sem ela, os alunos criados da agenda criam-se na mesma, mas não ficam marcados como "só estúdio" (entram nos alertas de "sem registos").
- Depois de **Sincronizar**, o cartão Google Agenda lista os nomes que aparecem na agenda e ainda não são alunos (o nome é a parte depois do último " - " do título, sem parênteses). Os que parecem alunos vêm marcados; compromissos (dentista, reunião…) e títulos com números ("PT 60") ficam por marcar. Podes corrigir o nome antes de criar.
- Só vêm marcados os nomes que parecem alunos **e** aparecem 3 vezes ou mais; casamentos, batizados, reuniões, feriados, etc. ficam por marcar. **Ignorar os não selecionados** guarda esses títulos como ignorados para não voltarem a aparecer.
- Criaste alunos por engano? Na ficha do aluno (Resumo → Pacotes), no fim, **Remover este aluno** apaga a ficha, pacotes, sessões e cobranças (só para alunos «só estúdio»); o título fica ignorado.
- **Criar os alunos selecionados** cria as fichas de uma vez como *só estúdio* (sem email, sem registos inventados), guarda cada título como alias e conta logo as aulas com os eventos já lidos (não pede autorização outra vez). Se fechares a app antes de criar, basta sincronizar de novo.
- Um aluno *só estúdio* não entra em "Hoje: quem contactar" por falta de registos, onboarding, check-in ou plano antigo, nem no pulso do estúdio (que só conta quem usa a app). Continuam a contar os motivos do estúdio (pagamento em atraso, pacote a acabar, faltas) e os pedidos de ajuda. Deixa de ser *só estúdio* quando recebe um convite (email) ou cria conta.
- Se um nome da agenda é igual ao de um aluno que já existe (mesmo arquivado), não se cria outro: o título passa a alias desse aluno e a app avisa. Um aluno arquivado nunca perde as aulas já contadas.
- Os pacotes não vêm da agenda: depois de criar os alunos usa "Importar pacotes que já estão a decorrer" (nome; aulas; início; valor; já dadas) para os criar de uma vez.

## 8g. Migração 0027: sessões «agendadas» (as datas previstas da folha)

- [ ] Correr `supabase/migrations/0027_sessions_agendadas.sql` (depois da 0026; é repetível). `sessions.status` passa a aceitar `agendada` e `sessions.source` aceita `folha`.
- **Estúdio → Importar as datas previstas (agendadas)**: cola uma linha por aluno com as datas da folha «Treinos» (`Nome; 20/07/2026; 21/07/2026; …`; aceita 31/12/2026 e 2026/12/31). Ficam como «Agendada» na ficha do aluno (Resumo → Pacotes → «Próximas sessões agendadas»), **não gastam aulas do pacote**. As de datas já passadas e sem evento no Google Agenda aparecem como «Agendada · por confirmar».
- Ao **sincronizar o Google Agenda**, o evento desse dia converte a sessão agendada em «Feita» (ou «Faltou», cor Tomate) e passa a gastar uma aula do pacote certo, em vez de criar outra. A sincronização nunca apaga as sessões da folha. Podes também mudar o estado à mão («Alterar…» na linha da sessão), e a sessão passa a manual.
- Importar duas vezes não duplica: conta as sessões que já existem em cada dia (incluindo as que o Google Agenda já converteu).
- Validade dos pacotes importados (sexta coluna de «Importar pacotes que já estão a decorrer»): trimestral/semestral/anual = duração + 3 meses de margem; mensal = 3 meses; exceções à parte.

## 8h. Migração 0028: pacotes partilhados (casais) e validade por tipo de pack

- [ ] Correr `supabase/migrations/0028_shared_packs.sql` (depois da 0027; é repetível). Acrescenta `session_packs.shared_with`. Sem ela, tudo o resto funciona e a app avisa quando tentas partilhar.
- Na ficha do aluno (Resumo → Pacotes): **Partilhar** dá a outros alunos o direito de gastar aulas desse pacote. Com «partilha nos dois sentidos» marcada, cada um também fica com acesso ao seu próprio pacote, por isso, mesmo com 13 aulas num e 26 no outro, as sessões de qualquer dos dois descontam ao mesmo conjunto e acabam juntos. Só há uma cobrança (a do pacote do dono). No formulário de **Novo pacote** escolhe logo o parceiro em «Partilhado com».
- Importar pacotes: sexta coluna = meses ou o tipo (**Mensal** 3, **Trimestral** 6, **Semestral** 9, **Anual** 15 meses: duração + 3); sétima coluna = aluno(s) com quem se partilha (`Ana Silva; 26; 01/10/2026; 520; 9; Trimestral; João Silva`; separa vários com `&`, `/` ou ` e `).
- Novo pacote: escolhe o **Tipo de pack** e a validade preenche-se sozinha (trimestral pago a 14/01 dura até 14/04 e vale até 14/07).

## 8i. Migração 0029: fases de peso (cut/bulk), revisão periódica e creatina

- [ ] Correr `supabase/migrations/0029_nutrition_phase.sql` (depois da 0028; é repetível). Acrescenta `students.nutrition_phase`. Sem ela, o PDF e o resto grava-se, mas a fase, as revisões e a confirmação da creatina (menores, rins, gravidez, amamentação) não ficam guardadas: a app avisa e não aplica revisões às cegas.
- **Creatina mono-hidratada** aparece em todos os planos, sempre no pequeno-almoço, com a dose pelo peso (0,05 g/kg, entre 3 e 5 g) e a nota «Pode ser tomada em qualquer altura do dia.». Na Nutrição há o cartão «Suplementação» para a retirar/incluir; menores e fichas com rins, gravidez ou amamentação pedem a tua confirmação antes de aparecer ao aluno.
- **Fase e objetivo de peso** (Nutrição): o peso objetivo define cut, bulk ou manutenção; «Definir fase» aplica as calorias de partida graduais (cut −10 %, bulk +5 % da manutenção). De 3 em 3 ou de 4 em 4 semanas (à tua escolha; nunca menos, para o peso estabilizar depois de cada alteração), se o peso não evolui como previsto, aparece um **pop-up ao entrar** (e um cartão no painel) com a sugestão de mudar 100–200 kcal; **OK — aplicar** ajusta os alvos e as quantidades das refeições do aluno de uma vez; «Adiar 7 dias» esconde-o. Perder ou ganhar peso depressa demais avisa logo, sem esperar pela data. Se guardares outro peso objetivo com a fase em curso, só o objetivo muda (as calorias e as etapas ficam; para mudar de fase usa «Alterar fase»). Se a adesão é baixa ou a fome alta, a app não propõe cortar mais.
- A creatina nova retém 0,5–1,5 kg de água: a revisão ignora as pesagens das 2 semanas a seguir a começar ou parar.
- **Plano em PDF**: botão «Plano em PDF (imprimir)» no plano do aluno e «Exportar o plano em PDF» na Nutrição. No iPhone abre a folha de partilha (Imprimir, Guardar nos Ficheiros, WhatsApp).

**Medir antes de otimizar mais:** para saber quanto pesa cada ficha (e se vale a pena carregar menos colunas no arranque do profissional), corre `select name, pg_size_pretty(pg_column_size(s.*)) as tamanho from students s order by pg_column_size(s.*) desc;`

## 9. Riscos e limitações que ficam por resolver nesta fase

- **Bibliotecas guardadas no site** (resolvido): o Supabase JS (`vendor/supabase.js`, versão 2.117.3) e as fontes (`fonts/`) já não vêm de CDNs. Para atualizar o Supabase JS, ver `vendor/README.md` e subir `VERSION` em `sw.js`; o service worker serve a versão guardada até a `VERSION` mudar.
- **Sem backup automatizado fora do Supabase**: dependemos inteiramente das garantias do plano Supabase; não há uma cópia externa agendada.
- **Sem monitorização de erros em produção**: erros no browser de um aluno real só chegam ao profissional se o aluno os reportar — não há nenhum serviço de monitorização (deliberadamente, por instrução desta fase).
- **Teste em telemóvel físico**: a validação desta fase foi feita por emulação de viewport (375×812); recomenda-se um teste round-trip num telemóvel Android e iOS reais antes do lançamento.
- **Plano de backup do Supabase não confirmado**: este documento assume que vais confirmar o plano/retenção atual (ver secção 6) — as garantias reais dependem disso.

## 8j. Horas mensais por aluno (sem migração nova)

As «Horas mensais» da folha «Dados» de cada cliente guardam-se em `studio_settings` (chave `monthly_hours`, `{idDoAluno: horas}`), tabela criada na migração 0025. Importam-se em Estúdio → «Importar as horas mensais» (`Nome; horas`, aceita «PT 60 - Nome» e duos «A + B», cujas horas se dividem pelos dois) ou editam-se na ficha (separador Pacotes). A soma dos alunos ativos aparece no cabeçalho do Estúdio («Horas mensais ativas»).

## 8k. Pacote caducado com aulas dadas depois (o aluno parou e voltou)

Na ficha do aluno (Pacotes): «Editar» muda aulas, aulas já dadas antes da app, início e validade do pacote, e as aulas extra passam para ele. Se o aluno aguarda renovação com aulas extra mas o pacote caducado ainda tem aulas, aparece «Contar estas aulas no pacote caducado (sem validade)». A janela do Google Agenda chega agora às aulas previstas (folha) já passadas e aos pacotes caducados que ainda têm aulas: sincronizar volta a confirmar essas aulas.

Automático para todos: «Sincronizar» (Google Agenda) e o botão «↻ Acertar pacotes» (Estúdio → Resumo de treinos) correm `autoFixPacks()`: as aulas sem pacote contam no pacote com aulas por dar; se o pacote caducou, não há outro mais novo e o aluno continuou a treinar, perde a validade. Um pacote esgotado ou já renovado não se mexe. Eventos de duo («PT Duo 60 - Ana + Rui»), quando os dois nomes são alunos, contam uma aula a cada um (id da sessão = idDoEvento#idDoAluno).

Associação evento → aluno: o título (ou o que vem depois de « - ») tem de ser o nome do aluno; um duo «A + B» conta para os dois; e, se vier só o primeiro ou o último nome («PT 60 - Carina», «PT 60 - Diana»), casa com o aluno cuja ficha tenha essa palavra como primeiro ou último nome, desde que seja um só. Os restantes títulos ficam na lista «sem aluno» do cartão do Google Agenda.

Renovar um pacote: na ficha (Pacotes), os pacotes esgotados, caducados ou a acabar têm o botão «Renovar». Cria um pacote igual (aulas, preço, validade, partilha) a começar na primeira aula que ficou sem pacote (ou hoje), com o contador a zero, passa para ele as aulas já dadas sem pacote e cria a cobrança por pagar; depois só falta marcar «Pago» quando o dinheiro chegar.

A renovação conta a partir da 1.ª aula do pacote novo: se já há aulas dadas sem pacote, o pacote novo começa na primeira delas e a validade conta daí; se ainda não há, fica «a contar» (notes = «renov:<meses>») e, quando a primeira aula entrar no pacote (ao sincronizar ou em «Acertar pacotes»), o início e a validade passam a ser os dessa aula.

Renovar antes de acabar o pacote (por exemplo com 6 aulas por dar): «Renovar» está sempre disponível. As aulas gastam-se primeiro no pacote que caduca primeiro e, com a mesma validade (ou sem ela), no mais antigo; o pacote novo só começa a ser gasto quando o antigo acaba. O Resumo de treinos mostra «N pacotes ativos · restam X no total».

Pacotes partilhados (casais): uma aula gasta primeiro o pacote do próprio aluno e só depois o do parceiro; e as aulas de um aluno anteriores ao início do seu primeiro pacote próprio não gastam o pacote do parceiro (eram de um pacote anterior). «Sincronizar» e «↻ Acertar pacotes» voltam a ligar as aulas dos alunos com pacotes partilhados ao pacote certo (`reassignSharedPackSessions`). O cartão «Hoje: quem contactar» vem recolhido, com o número de alunos no cabeçalho; o estado fica guardado no dispositivo.

Pacotes partilhados — ordem e partilha (substitui a regra anterior «pacote próprio primeiro»): uma aula gasta primeiro o pacote que caduca primeiro e, com a mesma validade (ou sem ela), o mais antigo, seja do próprio aluno ou do parceiro; assim as aulas que restam no pacote do parceiro gastam-se antes do pacote novo. Partilhar num dos pacotes basta: os dois alunos passam a ser parceiros e podem gastar os pacotes um do outro (`partnersOf`). As aulas anteriores ao início do pacote próprio continuam a não gastar o pacote do parceiro.

Número da aula: cada sessão (ficha do aluno e agenda do dia do Estúdio) mostra «Aula n/total», a posição dentro do pacote (contando as aulas já dadas antes da app; nos pacotes partilhados conta o conjunto). As aulas previstas (agendadas) levam o número que terão e passam ao pacote seguinte quando o primeiro acaba (`sessionNumberMap`).

Estúdio: lupa (nomes que começam pelas letras escritas, em todas as listas com alunos) e ordem do resumo de treinos (urgência, A→Z, Z→A, menos aulas primeiro).

## 8l. Contratos (área só do Tiago)

Novo menu «Contratos» (e «Eu»): sem migração nova. Os dados dos contratos ficam em `studio_settings` (chave `contracts`: `{idDoAluno: {formato, modalidade, minutos, estado}}`; chave `personal`: a ficha de «Eu»); as horas por mês continuam em `monthly_hours`.
- **Lista:** totais (horas contratadas por mês, contratos ativos — um duo conta uma vez —, receita recorrente por mês = valor por sessão × sessões por mês), filtros Todos/Ativo/Suspenso/Cancelado, lupa e ordem (nome, valor, aulas por dar, horas).
- **Ficha do contrato:** termos (formato, modalidade, plano, horas, valor do ciclo, valor por mês), participantes, treinos próximos/últimos com o número da aula, recebimentos (Pago/Desmarcar) e arquivo de packs; «Editar condições» e «Renovar».
- **Duo:** dois alunos marcados como duo e parceiros (pacote partilhado) formam um só contrato; as horas repartem-se pelos dois.
- **Importar:** `Nome; modalidade; formato; estado` (o «PT 45/60» do nome dá os minutos).
- **Financeiro:** recebido/a receber/em atraso do mês, com Pago e Desmarcar, e CSV.
- **Eu:** abre a ficha escolhida (alimentação e treino). Para teres ficha, convida-te como aluno.
- Não inclui a atribuição de sessões a outro PT nem a coluna lateral do backoffice.

## 8m. Duas apps: EVOLVE (Acompanhamento) e EVOLVE Gestão

O mesmo site tem **duas apps instaláveis**, para não misturar o acompanhamento dos alunos com a gestão do estúdio:

- **`index.html` — EVOLVE** (ícone preto e branco): os alunos usam-na; o profissional vê aqui **Alunos, Catálogo e Eu** (nutrição, treino, check-ins, a minha ficha). Tem a ligação «Gestão ↗».
- **`gestao.html` — EVOLVE Gestão** (ícone laranja): só para o profissional. Abre no **Estúdio** e tem **Contratos**; abrir um aluno mostra só os **Pacotes** dele (aulas, recebimentos). Tem a ligação «Acompanhamento ↗». Uma conta de aluno que a abra vê «Só para o profissional» e uma ligação para a app dela.

Para instalar a Gestão no iPhone: abrir `…/gestao.html` no Safari → Partilhar → «Adicionar ao ecrã principal». No iPhone cada ícone guarda a sua própria sessão: é preciso iniciar sessão uma vez em cada app.

Código partilhado: `app.js` (núcleo) e `app.css`; as duas páginas só têm o esqueleto (`<html data-app="gestao">` na Gestão). `gestao.js` é o código do Estúdio/Contratos e só a app de Gestão o carrega.

## 8n. A Gestão vive noutro ficheiro (`gestao.js`)

O código da Gestão (Estúdio, packs, aulas, Google Agenda, Contratos, Financeiro) está em **`gestao.js`**, fora do núcleo (`app.js`). Só a app de Gestão o descarrega: `loadGestao()` pede-o depois de iniciar sessão e avalia-o dentro da app; os alunos e a app de Acompanhamento nunca o pedem. («Eu» é do Acompanhamento e vive no núcleo.) O que o núcleo precisa de chamar fica no objeto `G` (`G.enter`, `G.renderProStudioMain`, `G.tplProSessoes`, `G.studioRefresh`…), definido no fim de `gestao.js`.

- **Publicar:** `index.html`, `gestao.html`, `app.js`, `app.css`, `gestao.js`, `sw.js`, os manifestos e os ícones têm de ir juntos para o mesmo sítio (um commit só trata disto). O ficheiro `gestao.js` **não** está na lista de pré-cache do service worker: quando há rede vem sempre a versão atual (rede primeiro), e sem rede usa a última que o profissional já viu — por isso, com a app já aberta, a Gestão continua a abrir se a rede cair (ficheiro guardado depois da primeira vez; com rede lenta usa a cópia ao fim de 4 s).
- **Sem rede na primeira vez:** a Gestão mostra um aviso («Não foi possível abrir a Gestão») e o resto da app (alunos, planos, treinos) funciona; ao voltar a ter rede, abrir a Gestão tenta de novo sozinho.
- **Regra para quem mexe no código:** tudo o que for só do estúdio/contratos escreve-se em `gestao.js`. Se o núcleo (`index.html`) precisar de algo de lá, exporta-se em `G` e chama-se como `G.nome` (e nunca pelo nome solto: o teste `tests/gestao-split.test.js` falha se o núcleo usar um nome do módulo sem `G`). Os testes juntam `gestao.js` ao `app.js` (`tests/extract-app.js`); `gestao.html` e `index.html` têm de ter o mesmo corpo (o mesmo teste verifica).
