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
- [ ] **Authentication → URL Configuration → Redirect URLs**: com as três apps (`index.html`, `treino.html`, `gestao.html`) o link de recuperação de password volta à página onde foi pedido; acrescenta `https://tiagojvlourenco.github.io/plano-evolve/**` (com os dois asteriscos) à lista. Sem isso o link cai no Site URL (a app EVOLVE): funciona, mas o aluno acaba noutra app.
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

### 8e-bis. Folhas «Cliente …» do Google (pacotes, contratos e horas)

Com a opção **«Ler também as folhas «Cliente …»»** (Hoje → Google Agenda → Definições), cada **Sincronizar agora** lê, antes do calendário, a aba **Dados** de todas as folhas do Drive cujo nome começa por «Cliente » (Nome, Contrato, Data de início, Valor, Modalidade, Horas mensais, Individual/Duo, Estado) e atualiza a app: cria os **pacotes novos** (um pacote com as mesmas aulas e início a menos de 14 dias do da folha conta como já existente), grava modalidade/formato/estado do contrato e as horas mensais. Só leitura; a app nunca escreve nas folhas.

- **Uma vez**, no mesmo projeto do Google Cloud do Agenda: ativar a **Google Sheets API** e a **Google Drive API**; no ecrã de consentimento acrescentar os âmbitos `…/auth/spreadsheets.readonly` e `…/auth/drive.metadata.readonly`; na app ligar a opção e voltar a sincronizar (o Google pede a nova autorização).
- A folha é a fonte de verdade do **estado**, das **horas** e do **formato**: uma alteração feita na app a esses campos é reposta pela folha na sincronização seguinte.
- Os alunos têm de existir na app com o mesmo nome (sem «PT 60 - »); os nomes que não existirem aparecem no resumo da sincronização.
- Sincronizar é um toque (o Google exige autorização no browser); uma sincronização sem toques exigiria um serviço no servidor (Edge Function com conta de serviço partilhada na pasta), que ainda não existe.

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

- **`index.html` — EVOLVE** (ícone preto e branco): os alunos usam-na; o profissional vê aqui **Alunos, Catálogo e Eu** (nutrição, treino, check-ins, a minha ficha).
- **`gestao.html` — EVOLVE Gestão** (ícone laranja): só para o profissional. Abre no **Estúdio** e tem **Contratos**; abrir um aluno mostra só os **Pacotes** dele (aulas, recebimentos). Uma conta de aluno que a abra vê «Só para o profissional» e uma ligação para a app dela.

Para instalar a Gestão no iPhone: abrir `…/gestao.html` no Safari → Partilhar → «Adicionar ao ecrã principal». No iPhone cada ícone guarda a sua própria sessão: é preciso iniciar sessão uma vez em cada app.

Código partilhado: `app.js` (núcleo) e `app.css`; as duas páginas só têm o esqueleto (`<html data-app="gestao">` na Gestão). `gestao.js` é o código do Estúdio/Contratos e só a app de Gestão o carrega.

## 8n. A Gestão vive noutro ficheiro (`gestao.js`)

O código da Gestão (Estúdio, packs, aulas, Google Agenda, Contratos, Financeiro) está em **`gestao.js`**, fora do núcleo (`app.js`). Só a app de Gestão o descarrega: `loadGestao()` pede-o depois de iniciar sessão e avalia-o dentro da app; os alunos e a app de Acompanhamento nunca o pedem. («Eu» é do Acompanhamento e vive no núcleo.) O que o núcleo precisa de chamar fica no objeto `G` (`G.enter`, `G.renderProStudioMain`, `G.tplProSessoes`, `G.studioRefresh`…), definido no fim de `gestao.js`.

- **Publicar:** `index.html`, `gestao.html`, `app.js`, `app.css`, `gestao.js`, `sw.js`, os manifestos e os ícones têm de ir juntos para o mesmo sítio (um commit só trata disto). O ficheiro `gestao.js` **não** está na lista de pré-cache do service worker: quando há rede vem sempre a versão atual (rede primeiro), e sem rede usa a última que o profissional já viu — por isso, com a app já aberta, a Gestão continua a abrir se a rede cair (ficheiro guardado depois da primeira vez; com rede lenta usa a cópia ao fim de 4 s).
- **Sem rede na primeira vez:** a Gestão mostra um aviso («Não foi possível abrir a Gestão») e o resto da app (alunos, planos, treinos) funciona; ao voltar a ter rede, abrir a Gestão tenta de novo sozinho.
- **Regra para quem mexe no código:** tudo o que for só do estúdio/contratos escreve-se em `gestao.js`. Se o núcleo (`index.html`) precisar de algo de lá, exporta-se em `G` e chama-se como `G.nome` (e nunca pelo nome solto: o teste `tests/gestao-split.test.js` falha se o núcleo usar um nome do módulo sem `G`). Os testes juntam `gestao.js` ao `app.js` (`tests/extract-app.js`); `gestao.html` e `index.html` têm de ter o mesmo corpo (o mesmo teste verifica).

## 8o. Migração 0030: «Não faz nutrição comigo» (e fim do check-in semanal)

Corre `supabase/migrations/0030_no_nutrition.sql` no SQL Editor do Supabase (é seguro repetir). Depois, na ficha do aluno → Perfil, o interruptor **«Não faz nutrição comigo»** (ou a caixa ao convidar o aluno) esconde ao aluno plano alimentar, refeições, compras e PDF — fica com treino, avaliações, fotos e evolução — e esconde-te a ti o grupo Nutrição, as macros e as revisões de plano desse aluno. O aluno não vê nem muda esta opção. Enquanto a migração não correr, a app avisa e o resto grava-se na mesma.

O **check-in semanal** foi retirado da app (o aluno já não o preenche, o painel já não o conta nem o cobra). Os check-ins antigos mantêm-se no histórico. Para o voltar a ligar, `WEEKLY_CHECKIN_ENABLED = true` em `app.js`.

## 8p. O peso vem das avaliações do profissional

Só o profissional regista o peso (Avaliação → nova avaliação, ou a importação de pesagens). O aluno não pesa nem preenche check-ins.

- **Fonte única:** `weighInsOf(s)` junta `weights` (onde as avaliações e as importações escrevem) e só acrescenta o peso de uma avaliação antiga se faltar em `weights`; nunca duas vezes o mesmo dia e nunca uma avaliação só de composição (que repete o peso atual). `checkins[].weight` não se lê à parte.
- **Revisão de fase:** `computePhaseReview` usa essas pesagens e acrescenta `progress` (`weightProgress`: variação em kg e %, intervalo real, kg/semana). A proposta de ajuste continua a exigir 4 pesagens em 2 semanas dentro dos últimos 28 dias; com menos, a revisão fica «dados» e descreve o que há, sem falar de estagnação.
- **Indicadores:** o peso só avalia tendência com 3 ou mais pesagens; «Pesagem» é um lembrete («regista o peso na próxima avaliação»), nunca uma falha do aluno. Treinos e inatividade usam as sessões registadas (`workoutLogs`), não os check-ins; «sem registos» e «sem dados» têm mensagens diferentes.
- **Datas:** `todayISO()` devolve o dia **local** (antes era UTC e dava o dia anterior à meia-noite de verão em Portugal). As datas já gravadas não se alteram.
- **Permissões:** nada mudou na base de dados. O trigger da migração 0019 continua a deixar o aluno escrever `weights`/`weight_current` (herdado do check-in); nenhum ecrã do aluno o usa. Retirar essas colunas da lista é uma migração à parte, por decidir.

## 8q. Migração 0031: o aluno deixa de poder escrever o peso

Corre `supabase/migrations/0031_weight_professional_only.sql` no SQL Editor do Supabase (é seguro repetir). Tira `weights` e `weight_current` da lista de colunas que o aluno pode escrever (o gatilho de 0004→0019); o profissional continua a escrever tudo e o aluno continua a escrever o diário do dia, check-ins antigos, histórico de substituições/adaptações, fotos e sessões de treino. Não altera dados. Depois de correr, confirma com o bloco I de `supabase/verify_security.sql` (ainda por validar no projeto real).

O teste `tests/weight-permissions-db.test.js` exercita o gatilho num Postgres temporário local (se a máquina tiver um), mas é um harness: não substitui a verificação no Supabase. `checkins[].weight` continua escrevível pelo aluno (é histórico) e a app não o lê como pesagem.

## 8r. Revisão de fase com avaliações espaçadas (4–6 semanas)

A revisão (`computePhaseReview`) tem duas vias. **Pesagens frequentes** (4 em 2 semanas, nos últimos 28 dias): a regra de sempre. **Avaliações do profissional**: 3 ou mais avaliações com peso, 28 dias ou mais da primeira à última, dentro de 84 dias, a última com 42 dias ou menos (`PHASE_CFG.sparse*`, `phaseSparseEvidence`).

- **Estados** (`evidenceState`): `insuficiente` (menos de 2 avaliações ou menos de 21 dias), `observacao` (2 avaliações a 21+ dias, ou 3 com menos de 28), `desatualizado` (última há mais de 42 dias), `suficiente-espaçadas`. Nenhum dos três primeiros propõe calorias, e a falta de avaliação recente nunca é «estagnação» nem «falta de adesão».
- **Ponto de partida:** as avaliações contam desde a data da última alteração de calorias (ou do início da fase); o último peso até 3 dias antes é o ponto de partida; as anteriores não entram.
- **Confirmação:** só se propõe ajuste quando o ritmo da reta e o do último intervalo (vs. uma avaliação 14+ dias antes) estão fora da banda no mesmo sentido. Isto vale também para a manutenção e para o aviso urgente (que exige 3+ avaliações).
- **Suspeitas:** um salto de mais de 3 %/semana entre avaliações, ou um ponto a mais de 2 kg da reta, pede para confirmar o peso e não sustenta proposta.
- **Adesão:** abaixo da banda num cut, sem 2+ check-ins preenchidos nos últimos 42 dias, não se sugere reduzir: aviso para o PT confirmar a adesão com o aluno.
- **Sem repetição:** a via espaçada só volta a aparecer com uma avaliação posterior à última revisão aplicada ou adiada (`lastReviewDate`, `seenWeighInDate`).
- As propostas só se aplicam quando o PT as valida (`applyPhaseReview`).

### 8r.1 Correções finais da revisão de fase

- **Pesagem discrepante:** na via espaçada o filtro de pontos discrepantes está desligado; um salto de mais de 3 %/semana ou um ponto a mais de 2 kg da reta devolve «Pesagem suspeita» com a data e o valor, mantém tudo no histórico e não propõe calorias até o peso ser confirmado/corrigido.
- **Revisão vista:** ao aplicar ou adiar guarda-se `nutritionPhase.seenWeighInDate` (a avaliação mais recente com data até hoje; as futuras não contam). Nas duas vias (frequente e espaçada) a revisão só volta com uma avaliação válida **7 dias ou mais** depois dela. «Rever agora» responde «Sem avaliação nova desde a última revisão.». A 2.ª etapa de uma saída para a manutenção é um passo combinado e não é bloqueada.
- **Resumo do peso:** o intervalo mostrado na revisão começa no ponto de partida da fase atual (pesagem do dia da alteração, ou a de até 3 dias antes), não em todo o histórico.
- **Fome, energia e adesão:** só contam check-ins com valores preenchidos, de 42 dias ou menos e desde a última alteração de calorias (fase atual). Sem eles é «sem dados». Os indicadores (`recentCheckins`) usam a janela de 42 dias.
- **Confirmação da adesão:** no pop-up da revisão do tipo «adesão» o PT regista *Cumprida / Parcial / Não cumprida* (`confirmPhaseAdherence` → `nutritionPhase.adherenceConfirmed = {date, level}`, gravado pela coluna `nutrition_phase`, só o profissional). Vale 42 dias e só desde a última alteração de calorias; aplicar uma revisão ou mudar as calorias à mão invalida-a. «Cumprida» continua a avaliação (o PT valida a proposta); «Parcial» e «Não cumprida» adiam e não propõem reduzir.
- **Reduções de calorias** (cut abaixo da banda, manutenção com o peso a subir, bulk acima da banda, incluindo o aviso urgente do bulk) exigem adesão confirmada (PT ou check-ins). Os aumentos (perda demasiado rápida, bulk parado) não dependem dela. Nenhuma decisão altera o plano sem o OK do PT.

## 8s. Convite por link (sem email)

O Supabase tem um serviço de email incluído que não serve para uso real (só entrega a membros da equipa e tem um limite baixíssimo): por isso o aluno não recebia o email de confirmação. Agora o PT gera um **link**, envia-o ao aluno por WhatsApp/SMS, e o aluno define a password e entra: a conta fica logo ativa, sem email.

**Como funciona:** na ficha do aluno (Resumo → Perfil → Contacto) o botão «Gerar link de convite» (e, logo ao criar um aluno com email, abre sozinho) pede o link à função `convidar-aluno`. O link aponta para a própria app. O token só é gasto quando o aluno carrega em «Definir password e entrar», por isso as pré-visualizações do WhatsApp ou antivírus não o inutilizam. Se o aluno já tem conta, o botão passa a «Link para nova password» (serve também para quem esqueceu a password, sem email).

**Publicar a função (uma vez):**
1. Instala o CLI do Supabase (`brew install supabase/tap/supabase`) e faz `supabase login`.
2. Na pasta do projeto: `supabase link --project-ref <referência do teu projeto>` e `supabase functions deploy convidar-aluno`. Deixa a verificação de JWT ligada (por omissão).
3. Se a app não estiver em `https://tiagojvlourenco.github.io`, define o segredo `ALLOWED_ORIGINS` com o endereço certo (`supabase secrets set ALLOWED_ORIGINS=https://o-teu-endereço`).
4. Em Authentication → (definições do email), põe a validade do link («Email OTP expiration») no máximo (86400 s = 24 h). Por omissão é 1 h, o que é pouco para enviar por WhatsApp.

**Validar (ainda não foi feito no teu projeto):**
1. Cria um aluno com um segundo email teu e gera o link.
2. Abre-o numa janela privada: deve pedir a password. Define-a e confirma que entras na app como aluno.
3. Em Authentication → Users o aluno deve aparecer **confirmado** (sem «Waiting for verification»). Se não aparecer confirmado, diz-me: o ramo «recovery» para contas já criadas depende desse comportamento do Supabase.
4. Abre o mesmo link outra vez: deve dizer que já foi usado ou expirou.

**Segurança:** quem tiver o link define a password dessa conta; envia-o só ao aluno. Cada link só serve uma vez e expira. A função recusa quem não é profissional e emails sem convite; a chave de serviço nunca sai do servidor. Testes: `tests/convidar-aluno.test.js` (função, em Node com dependências simuladas) e `tests/invite-link-browser.test.js` (ecrãs, Chromium com Supabase simulado). Não cobrem o Supabase real.

## 8t. Música no treino

No ecrã de treino do aluno há três botões: «♪ Spotify», «♪ Apple Music» e «♪ YouTube Music». Cada um abre essa app de música no telemóvel. A EVOLVE **não toca nem controla música** e **não guarda nada** (sem links, sem localStorage, sem Supabase, sem migração): é a app de música que toca, por isso a música continua quando o aluno sai da EVOLVE (o treino fica guardado no telemóvel e o cronómetro de descanso conta pela hora, não pelo ecrã).

- Os botões são links `https` para a página inicial de cada serviço (`open.spotify.com`, `music.apple.com`, `music.youtube.com`), que o telemóvel entrega à app se estiver instalada; se não estiver, abrem no navegador. Escolheu-se https em vez de endereços próprios da app (`spotify:`, `music://`) porque estes ficam mortos quando a app não existe.
- Abrem sem referência à EVOLVE (`noopener noreferrer`); a EVOLVE nunca contacta os serviços.
- Não abre uma playlist específica nem sabe o que está a tocar (isso exigiria OAuth do Spotify ou a conta paga da Apple).
- **Por validar no iPhone e no Android:** se cada botão abre a app (e não o navegador) com a EVOLVE instalada no ecrã principal, e se ao voltar à EVOLVE o treino está como ficou. Se o iPhone abrir o navegador, troca-se para os endereços próprios da app.
- Testes: `tests/workout-music.test.js`.

## 8u. Corrida (migração 0032, na app EVOLVE Treino)

- **Aviso de ritmo (hipótese, não medida)**: antes de guardar, se o ritmo em movimento for mais rápido que 3:20/km (18 km/h) e a distância tiver 300 m ou mais, aparece o aviso no ecrã e uma pergunta «Guardar mesmo assim?» (carro, bicicleta ou transportes). Limiares em `RUN_CFG.askPaceSPerKm` e `askMinDistM`. A base de dados continua só a recusar médias acima de 43 km/h.

A Corrida vive no separador «Cardio» (corrida e bicicleta) da app EVOLVE Treino (`treino.html`) e, para o profissional, no chip «Corridas» da ficha do aluno (grupo «Treino», app EVOLVE). O código está em três ficheiros carregados só quando se abre a Corrida: `corrida-core.js` (contas e leitura de ficheiros, sem ecrã), `corrida.js` (ecrãs do aluno e do profissional) e `corrida-live.js` (gravador GPS e fila de envio).

**O que o aluno pode fazer** (só se o profissional ligar a Corrida nesse aluno):
- **Importar** um ficheiro GPX ou TCX gravado no relógio ou noutra app (o ficheiro é lido no telemóvel e não é guardado), **registar à mão** (tapete, GPS que falhou, ou corrida gravada na app Fitness da Apple, que não exporta ficheiros: o campo «Tudo numa linha» aceita «5,2 km 28:30», «ontem 18:30 5,23 km 27:58» ou «22/10 às 20:17 5 km 1h05» e preenche a data, a hora, a distância e o tempo) e ver as corridas: totais das últimas 8 semanas, lista, parciais por km e o percurso desenhado (sem mapa de terceiros).
- **Gravar com GPS** na própria app, **com o ecrã ligado** (só no modo «também gravar com GPS»): pausa, terminar com confirmação (e «Terminar no último ponto bom» se se esqueceu de terminar), bloqueio de toques, rascunho que sobrevive a um recarregamento (só uma janela de cada vez pode gravar o mesmo rascunho), e fila que envia depois quando não há rede (uma corrida recusada por causas passageiras, como a cache de esquema logo após a migração, é reenviada uma vez por sessão e tem «Tentar outra vez»; as recusadas ficam no máximo 30 dias, com «Apagar»). **A app não promete nada sobre o ecrã bloqueado nem sobre mudar de aplicação**: isso não está verificado (ver abaixo) e a interface avisa que pode ficar uma lacuna.
- Escolher, em cada corrida, **partilhar o percurso** com o profissional (desmarcado por omissão) e **aparar o início e o fim** (0, 100, 200, 500 m; o raio real tem uma folga aleatória de até 50 % para dificultar deduzir a partida, e o profissional vê «pelo menos N m»; o aparo parte de um primeiro/último ponto «limpo», sem pontos espúrios); dar esforço e nota; exportar o GPX (só para si); apagar uma corrida, só o percurso, todas, ou retirar o consentimento (apaga tudo). Apagar exige ligação.
- Antes da primeira corrida aceita um aviso de privacidade (o mesmo texto para importar, à mão e GPS); o aceite fica no servidor, e um recibo local permite começar sem rede (o servidor decide sempre ao guardar). **Com a Corrida desligada o aluno continua a poder ver e apagar o que já tem** («Ver ou apagar as minhas corridas»: apagar tudo, retirar o consentimento).

**O que o profissional vê**: o interruptor «Corrida neste aluno» (Desligada / Importar e registar à mão / Também gravar com GPS (experimental)), se o aluno aceitou o aviso, totais, lista, parciais e o percurso **só se o aluno o partilhou** (já aparado e simplificado, nunca o completo). Pode apagar uma corrida; não cria nem altera.

### Passos para o Tiago (por esta ordem)
1. **Aplicar `supabase/migrations/0032_corrida.sql`** no SQL Editor (cola o ficheiro inteiro; é seguro repetir). Cria `students.runs_mode` (todos os alunos ficam em «off»), `run_consents`, `runs` e `run_tracks`, com RLS e direitos explícitos. Sem esta migração a app funciona como hoje e o chip «Corridas» mostra «Falta correr a migração 0032».
2. **Correr o bloco J de `supabase/verify_security.sql`** (precisa de duas contas reais, uma de cada aluno, como os blocos anteriores). É obrigatório antes de ligar um aluno real: os testes automáticos usam um Postgres local e um Supabase simulado, não o Supabase real.
3. Ligar a Corrida a **uma conta de teste tua** (ficha → Treino → Corridas), primeiro em «Importar e registar à mão» e depois, se quiseres testar o GPS, em «Também gravar com GPS».
4. Fazer os testes no telemóvel (lista abaixo) e só depois ligar a alunos.

### Direitos de tabela (importante para migrações futuras)
A 0032 faz `revoke all` a `anon` e `authenticated` e só concede `select, insert, delete` a `authenticated`; nunca `update`. Foi escrita assim porque o changelog do Supabase (45329; lido, **não testado no teu projeto**) indica que **a partir de 30/10/2026 as tabelas novas deixam de receber direitos por omissão em projetos já existentes**. Se for verdade, qualquer migração futura que crie tabelas precisa de `grant` explícito (sem ele a API devolve «permission denied» mesmo com RLS correta).

### Privacidade (o que fica guardado e onde)
- **Fica guardado** (tabela `runs`): data e hora, distância, tempo, tempo em movimento, parciais por km, lacunas, esforço e nota; origem (GPX, TCX, à mão, GPS). Sem coordenadas.
- **Percurso** (`run_tracks`): só existe se o aluno o partilhou; sai aparado nas pontas (raio com folga aleatória) e simplificado. Uma linha aqui = percurso partilhado. O percurso completo só existe no ecrã de confirmação, antes de guardar (e o GPX que o aluno exporta).
- **Só no telemóvel**: o rascunho da gravação em curso (pontos completos, até guardar/descartar/sair da conta) e a fila de envio (só o que seria enviado, nunca pontos completos). Ambos se apagam ao sair da conta.
- **Sem serviços de terceiros por omissão**, nem frequência cardíaca, cadência ou nome/autor do ficheiro. **Exceção opcional: o mapa de fundo.** No resumo e no detalhe da corrida, **o aluno e o profissional** vêem um botão «Mostrar mapa»; ao tocar, o telemóvel pede os quadrados do mapa a `tile.openstreetmap.org` (1 a 9 pedidos, só com zoom/x/y no endereço; o OpenStreetMap fica a saber a **zona** e o **IP**) e desenha o percurso por cima, com «© OpenStreetMap». A escolha vale só até recarregar a página, o botão explica o que implica antes de tocar, o profissional só o pode ligar em percursos que o aluno partilhou (já aparados), e o pedido do mapa sai do telemóvel de quem o liga (a zona do percurso fica a ser conhecida pelo OpenStreetMap). A política de uso do OpenStreetMap permite uso moderado com atribuição; com poucos alunos está dentro dela (se o estúdio crescer muito, trocar por um serviço próprio ou pago). Nenhuma coordenada vai para a consola, avisos ou URLs. O aviso de privacidade do consentimento não foi alterado: o aviso do botão é o consentimento no momento do uso (decide se queres também mencioná-lo no aviso).
- Retirar o consentimento apaga todas as corridas e percursos do aluno (gatilho na base de dados); apagar o aluno apaga tudo em cascata.
- **O texto do aviso de privacidade é um rascunho, não parecer jurídico.** Fica por decidir por ti (com quem te aconselhe): base legal, prazo de retenção, responsável pelo tratamento, avaliação de impacto, região do projeto Supabase e acordo com o Supabase. O profissional (dono do projeto Supabase) consegue, tecnicamente, ler qualquer linha: a RLS esconde percursos não partilhados da app, não do administrador da base de dados.

### O que está verificado e o que NÃO está
- **Verificado automaticamente** (Chromium, Postgres 16 local, Supabase simulado): contas com séries sintéticas, leitura de GPX/TCX normais e hostis (DOCTYPE, ENTITY, «billion laughs», aninhamento, 16 MB), os limites do SQL, RLS (isolamento entre alunos, sem update, o aluno não liga a Corrida a si próprio, retirar consentimento apaga tudo, corrida de pedidos em simultâneo), consentimento antes de guardar, partilha desmarcada por omissão, aparo do percurso, XSS por notas/dados hostis, privacidade de rede (nenhum pedido fora do site), fila offline→online sem duplicar, rascunho e retoma, bloqueio de toques, sair da conta apaga o que é local. Testes: `tests/corrida-core.test.js`, `corrida-import-browser`, `corrida-browser`, `corrida-live`, `corrida-live-browser`, `corrida-split`, `corrida-seam`, `runs-db`, `corrida-migration`, `treino-app`.
- **Verificado num iPhone real (22/10/2026, conta da Diana, EVOLVE Treino no ecrã principal)**: o registo à mão guarda e lê de volta; a gravação com GPS **funciona com o ecrã ligado** («Sinal bom ±2 m», percurso desenhado) e **pára com o ecrã bloqueado ou a app em segundo plano**: ficam lacunas e a distância dessas lacunas não é contada (a app não inventa distância). Por isso a interface avisa que o ecrã tem de ficar ligado. Ainda não medido: bateria, Android, 30–60 min de Wake Lock.
- **NÃO verificado** (o resto):
  - **Qualquer iPhone ou Android real**: o que acontece com o ecrã **bloqueado** ou outra aplicação à frente (as fontes — norma W3C, código do WebKit — indicam que a página deixa de receber posições, mas nada foi medido por nós); se o **Wake Lock** funciona na app instalada durante 30–60 min; a precisão e a bateria do GPS; o seletor de ficheiros sem filtro; a partilha/descarga do GPX; `window.confirm` na app instalada.
  - **Os limiares de cálculo** (também a limpeza de pontos espúrios por salto de posição e de hora, a ligação de segmentos curtos, o limite de lacuna adaptativo e o limite da hora do GPS face ao relógio do telemóvel) (`RUN_CFG`: precisão máxima 30 m, lacuna 15 s, passo mínimo, salto 12 m/s…) são hipóteses validadas só com ruído sintético; com ruído grande o teste de salto rejeita fixes legítimos. Têm de ser calibrados com um percurso de distância conhecida (pista de 400 m ou 1 km medido) em cada sistema e com ficheiros reais.
  - **Safari/WebKit e Firefox** (leitura de XML, velocidade); **o Supabase real** (RLS com duas contas, cache de esquema depois da migração: se a app disser «Corrida indisponível» logo a seguir, espera um minuto ou recarrega o esquema); ficheiros reais de relógios.

### Lista de testes no telemóvel (o que me deves enviar)
1. EVOLVE Treino instalada no ecrã principal; iniciar sessão; separador Corrida.
2. **Importar** um GPX/TCX real (Strava/Garmin/Suunto/COROS/Polar): confirma distância e tempo face à app de origem (meta de desenho: dentro de ~2 %, **não é facto**).
3. **Registar à mão** e apagar; retirar o consentimento.
4. **GPS, ecrã ligado**, 5 min a caminhar, no browser e na app instalada: distância certa? lacunas?
5. **GPS com o ecrã bloqueado 10 min** e **com outra app à frente**: o que fica (lacunas, distância)? É esta a medição que decide se vale a pena uma app nativa. Exporta o resultado (o GPX do percurso e/ou capturas do resumo) e diz-me modelo, sistema, navegador e se a app estava instalada.
6. Sem rede a meio e voltar: a corrida chega uma só vez?
7. Matar a app a meio da gravação e reabri-la: aparece «Retomar / Guardar o que há / Descartar»?

### Como o aluno obtém o ficheiro (resumo; menus mudam, não testámos todas as apps)
Suunto e COROS: na app, abrir o treino → exportar GPX. Strava, Garmin Connect e Polar Flow: só no site (abrir a atividade → exportar GPX; Polar também TCX). Apple Fitness: não exporta um treino sozinho (há apps de terceiros, não avaliadas); evitar «Exportar todos os dados de saúde». Nike Run Club: não confirmámos exportação. Sem ficheiro: «Registar à mão».

## 8w. Ecrã de treino: descanso e séries
- O cronómetro de descanso fica **no topo** do ecrã, com botão «Som ao acabar» (ligado/desligado, guardado no telemóvel). Reiniciar volta ao descanso pré-definido, mesmo depois de −15/+15 s. Tocar na última série do treino pára o descanso.
- Enquanto o descanso corre pede-se ao telemóvel para não apagar o ecrã (Wake Lock; sem suporte, nada acontece). **Não verificado no iPhone**; com o ecrã bloqueado a página fica suspensa e não há som nem painel (limite do iPhone para apps web).
- Ao fazer uma série, a carga e o RIR passam para a série seguinte do mesmo exercício (se o aluno ainda não escreveu nada nela). O esforço da sessão sugere-se como 10 − média do RIR, até o aluno mexer no seletor.
- No programa, as repetições aceitam «Falha» e «Dropset» (atalhos ao adicionar); não geram sugestão de sobrecarga.

## 8x. Bicicleta na Corrida (migração 0033)
- **Para ti, Tiago**: corre `supabase/migrations/0033_corrida_bike.sql` no SQL Editor (uma vez; é segura de repetir). Acrescenta a coluna `runs.activity` (`run` por omissão, `bike`) e troca o limite de velocidade média: corrida 12 m/s, bicicleta 25 m/s. Não mexe em políticas nem privilégios.
- Sem a 0033 a app continua a funcionar: as corridas gravam-se e leem-se como antes; guardar uma bicicleta diz «falta correr a migração 0033».
- No ecrã da Corrida há «Corrida | Bicicleta». A escolha vale para importar ficheiro (GPX/TCX de ciclismo só se aceitam como Bicicleta), registar à mão e gravar com GPS (limites de velocidade de bicicleta; o ecrã mostra km/h). A lista, o detalhe e os totais mostram «Bicicleta» e km/h; o ritmo médio das semanas só conta as corridas.
- **Não verificado**: GPS de bicicleta numa volta real (a 30 km/h o GPS do navegador tem muito menos pontos por quilómetro e a distância pode sair diferente; nada foi medido), ecrã do profissional com bicicletas, e o aviso de privacidade (v1) só fala de «corridas»: antes de abrir a bicicleta a alunos, rever o texto e, se for preciso, subir a versão do aviso.
- Não há aviso de «foi mesmo bicicleta?» (o aviso de ritmo rápido só vale para corrida).

## 8y. Periodização (treino de força e corrida)
- **Sem migração**: os dois planos ficam dentro do programa de treino do aluno (`training_program`, que só o profissional escreve): `periodization` (bloco de força) e `runPlan` (plano de corrida). Guardam-se só os parâmetros; as semanas calculam-se sempre, por isso mudar uma regra no código muda os planos já definidos.
- **Força** (ficha do aluno → Treino → «Periodização do bloco»): escolhes dias por semana (2 a 6), objetivo (massa, recomposição, força, manutenção), semanas (4 a 8, a última é deload) e início. As séries por grupo muscular sobem da base ao topo da zona de volume do objetivo (as mesmas zonas do painel de volume); o RIR alvo desce de 3 para 1; o deload corta 40 % e usa RIR 4. O aluno vê «Semana n de N · fase · RIR alvo · séries por grupo» no ecrã de registo do treino. «Criar os dias sugeridos» cria os dias da divisão (corpo inteiro ×2 e ×3, superior/inferior ×2, 5 dias, empurrar/puxar/pernas ×2) só se o programa estiver vazio. Não mexe nos exercícios.
- **Corrida** (ficha do aluno → Corridas → «Plano de corrida»): objetivo (5 km, 10 km, meia, maratona, treino livre), sessões por semana (2 a 5), semanas (6 a 20), km por semana de partida e início. Sobe cerca de 8 % por semana até ao pico do objetivo, com semana de recuperação (−25 %) de 4 em 4 e afinação no fim. Cada semana tem fácil, qualidade (3 ou mais sessões) e longão, descritos por **esforço (RPE)**, não por ritmo (não há dados do aluno para dar ritmos). O aluno vê a semana no separador Corrida, com o previsto e o feito (só corridas, a bicicleta não conta).
  - **Outra distância** («Outra distância…», 1 a 100 km, por exemplo 8 km): o pico semanal, o longão máximo e as semanas recomendadas interpolam-se entre os objetivos fixos.
  - **Data da prova** (opcional, a pelo menos 28 dias do início; não vale para treino livre): as semanas passam a sair das datas, a última semana tem a prova no lugar do longão e a afinação fica antes. Com poucas semanas o plano avisa que a preparação fica condensada; com mais de 24 começa 24 semanas antes. O aluno vê «Prova a dd/mm · faltam N dias».
- **Importante**: são regras gerais de treino (progressão gradual, recuperação, afinação), não um plano individualizado, e nenhum dos valores foi validado com alunos reais nem por um estudo desta app. Servem de ponto de partida para o profissional ajustar. Avisos honestos aparecem quando o objetivo não cabe nas semanas ou a base é baixa.
- Não verificado: aspeto no iPhone, e como os alunos reais respondem às semanas de RIR alto no início do bloco.

## 8z. Imagens do livro de exercícios
- 545 dos 554 exercícios do livro do estúdio têm agora imagem (a biblioteca mostra-a como a dos exercícios da base): vêm do Excel «Livro de Exercícios», por baixo de cada nome, e foram convertidas para WebP de 360 px (cerca de 5 MB no total) com `python3 scripts/build-book-media.py LIVRO.xlsx`. Um exercício com duas imagens fica com uma animação de 2 fotogramas; com uma, imagem fixa.
- Os 9 sem imagem (3 em formato WMF que não consegui ler, e alguns nomes repetidos) continuam a ligar à pesquisa de vídeo.
- **Direitos**: o estúdio confirmou ter autorização para publicar as imagens, mas várias trazem a marca de água «WorkoutLabs.com»: convém confirmar a licença com a origem. Se for preciso retirar, apagar as imagens de `exercises/` que não são do Free Exercise DB e os `|1` de `EXERCISE_BOOK`.
- Não são vídeos: são fotografias/ilustrações. Vídeos de verdade (MP4) pesariam demasiado para a app offline e não há uma fonte livre; a opção seria ligações do estúdio a vídeos próprios no campo «GIF / vídeo demonstrativo» de cada exercício.

## 8aa. Registo à mão a partir do texto da app Fitness
- No «Registar à mão» o campo «Tudo numa linha» é agora uma caixa de texto e aceita também o **texto copiado do resumo de um treino da app Fitness da Apple** (português ou inglês). Como copiar no iPhone: abrir o treino, fazer uma captura de ecrã, abri-la em Fotografias, tocar no ícone do Texto em Direto, «Copiar tudo» e colar. A app lê a distância, a data, a hora de início (a primeira do intervalo «18:51–19:23») e o **tempo de treino** (sem as pausas; se o rótulo não vier junto do valor, o menor dos dois tempos h:mm:ss). Só preenche o formulário: o aluno confirma antes de guardar.
- **Não verificado**: o formato foi tirado de uma captura de ecrã real (Fitness em português, iPhone), mas **não** foi testado o que o Texto em Direto realmente copia (a ordem do texto pode variar) nem noutras versões do iOS; por isso o leitor aceita rótulos e valores separados ou na mesma linha. Não traz o percurso nem as parciais: só os números.

## 8ab. Treinos de cardio estruturados (como na app Fitness)
- No separador **Cardio** o aluno tem o cartão **Treinos**: os que o profissional prescreveu, «Treinos prontos» (8 × 400 m, 5 × 1000 m, 10 × 1 min, sprints de 20 s, corrida contínua de 30 min, meta de 5 km, e dois de bicicleta) e «Montar o meu treino» (sem prescrição e sem guardar). Há dois tipos: **repetições** (aquecimento, N × esforço em metros ou segundos com recuperação em segundos ou metros, arrefecimento) e **meta** (distância ou tempo).
- O profissional prescreve na ficha do aluno → Treino → Corridas → «Treinos de cardio prescritos» (nome, corrida ou bicicleta, tipo, valores, dia opcional). Guarda-se em `training_program.cardioSessions` (máx. 30), **sem migração**. Treinos com data com mais de 14 dias deixam de aparecer ao aluno.
- **Com «Gravar com GPS» ligado**, «Começar» abre o gravador e este **guia passo a passo**: «Corre forte 3 · faltam 220 m (passo 6 de 17)», com som e vibração (os do descanso: respeitam o botão «Som ao acabar») a cada mudança. O guia só avisa: não altera o que se grava. Ao guardar, as notas da corrida ficam com «Treino: nome». Sem GPS ligado, o aluno vê os treinos mas sem botão (a nota explica).
- **Não verificado**: o guia num iPhone com o ecrã ligado durante uma volta (som, vibração e a contagem por distância com GPS real); a precisão da contagem de 400 m depende do GPS (o mesmo erro da distância da corrida). Se a gravação for retomada depois de uma falha (rascunho), o guia não continua: perde-se o treino estruturado e fica só a gravação normal.
- Não há «feito/por fazer» automático por treino: o aluno vê todos os prescritos até passarem 14 dias da data.

## 8ac. «Melhorar tempo»
- No cartão **Treinos** do Cardio há «Melhorar tempo»: o aluno escolhe uma **corrida anterior** (da mesma atividade, com pelo menos 1 km e 5 min; as 8 mais recentes) e tenta fazer a mesma distância mais depressa. Com a gravação por GPS ligada, o gravador mostra «Adiantado 0:10 · previsão 29:50 · faltam 3,5 km» (ou «Atrasado…»), comparando o tempo da gravação com o que a corrida anterior levou até à mesma distância (usa as **parciais por km** dela quando as tem, senão um ritmo constante). Ao chegar à distância mostra o resultado, fixo e com um sinal sonoro («Meta atingida! 0:30 mais rápido…» ou «Não deu desta vez…»). As notas da corrida guardada ficam «Melhorar tempo: data · distância · tempo».
- O profissional também pode prescrever **«Contra o relógio»** (distância e tempo a bater, por exemplo 5 km em 25:00) em Treinos de cardio prescritos: o gravador compara com ritmo constante. Recusa-se um tempo impossível (mais de 43 km/h de média a correr, 90 km/h de bicicleta).
- **Diferença para a app Fitness**: a Fitness compara com a **mesma rota**; aqui só se compara o tempo com a **distância** (o percurso pode ser outro), porque o percurso do aluno só fica no servidor se ele o partilhar (e aparado). O erro do GPS na distância entra na comparação. **Não verificado** numa corrida real.

## 8ad. Mapa interativo
- Com «Mostrar mapa» ligado, o detalhe da corrida mostra **só o mapa** (o desenho simples do percurso desaparece até o mapa ser escondido) e o mapa já não é uma imagem fixa. **No telemóvel: um dedo faz deslizar a página e dois dedos mexem e aproximam o mapa** (a pinça arredonda ao nível de zoom mais próximo ao largar); os botões **+** e **−** e **◎** (voltar à vista do percurso) funcionam sempre. **No computador**: o rato arrasta, a roda e o duplo clique fazem zoom (3 a 18). O aluno e o profissional (nos percursos partilhados) usam o mesmo mapa.
- A vista inicial continua a pedir 1 a 9 quadrados ao OpenStreetMap; **só quando se mexe** carrega-se uma margem à volta e os quadrados do novo zoom (sempre só `z/x/y`, sem coordenadas nem identificadores). O aviso de «Mostrar mapa» diz isso. Sem biblioteca de mapas: o desenho e os gestos são código nosso.
- **Não verificado**: os gestos foram testados com toques simulados num Chromium de secretária (um dedo, pinça e dois dedos a deslizar), **não** num iPhone real; nem o desempenho em telemóveis lentos.

## 8v. Três apps: EVOLVE, EVOLVE Treino e EVOLVE Gestão

O mesmo site tem **três apps instaláveis**, cada uma com a sua página, o seu manifesto e o seu ícone:

| App | Página | Ícone | Para quê |
|---|---|---|---|
| **EVOLVE** | `index.html` | preto e branco | Alimentação, avaliações e progresso do aluno; o profissional vê aqui Alunos, Catálogo e Eu (nutrição, treino, avaliação, corridas de cada aluno) |
| **EVOLVE Treino** | `treino.html` | preto e branco (igual ao EVOLVE; já foi verde-água) | Musculação (programa, registo de cada sessão, descanso, música) e **Corrida**; para o aluno |
| **EVOLVE Gestão** | `gestao.html` | laranja | Estúdio e Contratos; só para o profissional |

- O código é o mesmo (`app.js`, `app.css`); cada página só diz de que app é com `<html data-app="…">` (`treino`, `gestao`; sem atributo = EVOLVE). `APP_MODE` em `app.js` escolhe o que se mostra.
- **O treino saiu da app EVOLVE**: lá, «Hoje» tem só as refeições (e um atalho «Treino e corrida» para a nova app) e «Plano» só Alimentação e Compras. Os dados (`training_program`, `workout_logs`) não mudaram de sítio nem foram tocados; o profissional continua a editar o programa na ficha do aluno (grupo «Treino»). Alunos que «não fazem nutrição comigo» só veem o atalho na EVOLVE e usam a EVOLVE Treino.
- **EVOLVE Treino**: dois separadores, «Treino» (o treino de hoje, o programa, os últimos treinos, uma ligação para a EVOLVE) e «Corrida» (ver 8u). Um profissional que abra `treino.html` vê o ecrã do aluno em pré-visualização, com o seletor de aluno.
- **Instalar**: abrir `…/treino.html` no Safari → Partilhar → «Adicionar ao ecrã principal». **No iPhone cada ícone guarda a sua própria sessão** (afirmação já feita em 8m, não verificada de novo): o aluno inicia sessão uma vez em cada app. Se o treino já estava aberto na EVOLVE como atalho, deve instalar a nova.
- O service worker guarda uma cópia de cada página por separado (`pageKey`) e `VERSION` subiu para `evolve-v5` (e para `evolve-v6` quando o ícone do Treino passou a preto e branco); os ícones novos estão em `icon-treino-*.png`.
- Verificado (Chromium, Supabase simulado, `tests/treino-app.test.js`): separadores de cada app, ecrãs, atalhos, pré-visualização do profissional, manifesto, service worker. **Por verificar em telemóvel real**: instalar no ecrã principal (ícone, nome «Treino», sessão própria por ícone) e o regresso do seletor de ficheiros/música.

### Pôr a funcionar sem surpresas (ordem de publicação e instalação)
- **Publica tudo de uma vez (um só merge) e espera uns minutos antes de enviares o link do Treino aos alunos.** Quem ainda tem o service worker antigo (`evolve-v4`) mapeia **qualquer** página para a cópia de `index.html`; com rede lenta, abrir `treino.html` nesse telemóvel pode mostrar a EVOLVE no endereço do Treino até o service worker novo (`evolve-v5`) ativar. Abrir a EVOLVE uma vez com rede resolve. Não envies o link da nova app antes de a EVOLVE ter sido aberta depois da publicação.
- **O aluno precisa de instalar a EVOLVE Treino à parte** (Safari → `…/treino.html` → Partilhar → «Adicionar ao ecrã principal»). As três apps têm o mesmo âmbito (`./`): a ligação «Treino e corrida» da EVOLVE abre o Treino **dentro da janela da EVOLVE** (funciona, com a sessão dessa app), mas não o instala. Diz isto aos alunos.
- **Código da Corrida**: `corrida-core.js`, `corrida.js` e `corrida-live.js` (~200 KB no total) **não** estão na cache inicial: só se descarregam quando o aluno com a Corrida ligada abre a EVOLVE Treino (a app pede-os em segundo plano ao arrancar, para ficarem guardados e abrirem sem rede ao ar livre) ou quando alguém abre a Corrida/ficha «Corridas». Com a Corrida desligada nada disto é pedido. Um aluno que ligues e que **nunca** tenha aberto a app com rede não consegue abrir a Corrida sem rede.
- **Quota**: um aluno com sessão válida e a Corrida ligada pode, tecnicamente, inserir muitas linhas (cada percurso até 200 KB). Os CHECK limitam cada linha, não o número delas (mesmo risco das outras tabelas do projeto). Vigia o tamanho com `select pg_total_relation_size('run_tracks')` de vez em quando.
- `tests/runs-db.test.js` **salta** (e diz que saltou) se não houver Postgres local; nesse caso a suíte fica verde sem provar a RLS. Corre-o onde haja Postgres antes de mexer na migração.


## 8ae. Aviso de privacidade v2 e endurecimento de funções (0034)

- O aviso (RUN_UI_NOTICE) passou à **versão 2**: cobre bicicleta, treinos guiados e o mapa opcional (OpenStreetMap: recebe IP e zona). Quem aceitou a v1 volta a ver o aviso uma vez; as corridas antigas ficam ligadas ao consentimento v1. **Ainda precisa de revisão jurídica.**
- Migração `0034_hardening_funcoes.sql` (aplicada em produção): `search_path` fixo nas 3 funções de validação do diário; `claim_student_row` só para `authenticated`; `enforce_student_column_permissions` sem EXECUTE para clientes.
- Fica por fazer no painel Supabase: ativar «Leaked password protection» (Auth). O aviso `claim_student_row` executável por `authenticated` é intencional (o aluno reclama o convite).

## 8af. Nomes em português do livro (pesquisa)

Os exercícios do livro ganham um alias em português (`exercisePtAlias`, dicionário `EXERCISE_PT_WORDS` em app.js), usado só na pesquisa da biblioteca. É tradução palavra a palavra, **por rever** por um profissional (ex.: «Push Up» → «flexão»). Para corrigir um nome, edita o exercício na biblioteca (o alias próprio tem prioridade) ou o dicionário. As 9 imagens em falta continuam por fazer: o Excel original já não está disponível; precisa de ser carregado de novo para `scripts/build-book-media.py`.

## 8ag. Imagens do livro: origem e licença

- 72 exercícios do livro passaram a usar animações feitas com o Free Exercise DB (domínio público, 2 fotogramas), onde o nome coincide exatamente. Podem ficar.
- **As restantes ~475 imagens do livro vieram de pesquisa no Google (marca de água WorkoutLabs): são de terceiros, sem licença, e estão num site público.** Decisão pendente do dono: retirá-las (os exercícios mantêm-se, com pesquisa de vídeo) ou obter licença. Alternativa recomendada: vídeos curtos próprios, ligados a cada exercício na biblioteca.
- Aviso «Leaked password protection»: indisponível no plano Free do Supabase, aceite. O registo livre (signUp) tem de ficar ligado porque o convite do profissional funciona por signUp + `claim_student_row`.

## 8ah. Verificação de segurança J-B (27/10/2026)

O bloco J-B de `supabase/verify_security.sql` correu no Supabase real (projeto «Nutrição EVOLVE»): **40 ok, 0 falhas**, sem gravar nada (rollback final confirmado: sem utilizadores, consentimentos ou corridas novas). Como só havia 1 aluno com conta, o aluno B foi criado **dentro da transação** (linha em `auth.users` + `students.auth_user_id`) e desfeito com ela. Não prova o caminho real de login (GoTrue/PostgREST): isso é o J-C, que continua pendente e precisa de uma 2.ª conta de aluno real.

## 8ai. Imagens em falta (Turkish Get Up, Windmill)

Os 2 exercícios em formato EMF/WMF foram convertidos com o LibreOffice (`soffice --headless --convert-to png`) e recortados; são uma folha com vários passos, não uma animação. Mesma origem (Google) e mesma situação de licença do §8ag. Sobram 7 sem imagem por nome repetido ou diferente no Excel; continuam a ligar à pesquisa de vídeo.

## 8aj. Aluno «só treino» (sem nutrição)

O interruptor «Não faz nutrição comigo» é também o «só treino». Na app EVOLVE o aluno vê agora Hoje e Progresso (sem o separador Plano): o Hoje tem um cartão grande para a app EVOLVE Treino e um atalho para o Progresso (medidas, avaliações, fotos). Não há redirecionamento automático porque a evolução só existe na app EVOLVE. Ideia futura: levar o Progresso para a app Treino e então redirecionar.

## 8ak. Ecrã de registo do treino (redesenho)

Uma série ocupa um bloco compacto: kg e reps lado a lado (com − / +), círculo de «série feita» à direita. O RIR passou de campo numérico a quatro pastilhas (Falha, +1, +2, 3+), com «?» que abre a legenda «Como registar» (recolhida por omissão). O valor continua num campo escondido (`data-wl-rir`), por isso o envio, o esforço da sessão e as sugestões de sobrecarga e deload não mudaram. Modo do RIR por programa (`trainingProgram.rirMode`): `last` (omissão: só na última série de cada exercício), `all`, `off`; o profissional escolhe no separador Treino. A música ficou recolhida («♪ Música»). Em ecrãs ≤ 370 px os botões − / + passam para baixo do campo. Verificado em Chromium (390 e 320 px); não visto num telemóvel real.

## 8al. Ecrã «Hoje» da app Treino (redesenho)

Dia de descanso: cartão curto («Hoje · descanso», próximo treino, «Treinar mesmo assim»). O programa lista cada treino como um bloco: o nome abre os exercícios, o botão «Iniciar» (dentro do cabeçalho do bloco) começa o treino sem abrir a lista. O atalho para a app EVOLVE passou a cartão com «Abrir». Os ids `#startWorkout`, `data-start-day` e `#goEvolveApp` mantêm-se.

## 8am. Cardio: ação principal e login com a marca certa

- Com o GPS ligado pelo profissional, «Gravar com GPS» é a ação principal (primeira e a laranja); importar ficheiro e registar à mão ficam por baixo. O aviso do ecrã e das lacunas está na secção recolhida «Antes de gravar». Sem GPS, «Importar ficheiro» continua a principal.
- A faixa do topo e o ecrã de arranque dizem «EVOLVE», «EVOLVE Treino» ou «EVOLVE Gestão» conforme a app (já não «Evolve Nutrition · protótipo ... base de dados real»); só avisa se estiver em modo local.

## 8an. App EVOLVE (aluno): Plano recolhido e Progresso mais limpo

- **Plano:** cada grupo de uma refeição mostra a opção escolhida e «Trocar»; as alternativas só aparecem ao tocar nesse grupo (`state.planOpen`) e voltam a recolher ao escolher. A página passou de cerca de 7200 px para cerca de 2500. Só no ecrã do aluno (`compact`); o profissional e os testes de `tplMealChoice` continuam a ver a lista completa.
- **Progresso:** os 4 números do peso numa linha; tabelas com sombras nas pontas (deslizam); «Antes vs Depois» sem a grelha de quadrados vazios enquanto não houver fotografias.
- **Hoje:** o botão «Abrir» do atalho para a app Treino ficou centrado.
- Não alterado, por decisão pendente do dono: o tom dos avisos a vermelho («risco aumentado», «adiposidade central aumentada») mostrados ao aluno.

## 8ao. Desfazer adaptação e «Cardio» na ficha do profissional

- O aluno pode **desfazer** uma adaptação de refeição feita por engano: «Desfazer adaptação» (adaptação sem trocas) ou «Repor plano original» (com trocas). Ambos usam `undoMealAdaptation`: repõem os alimentos, tiram a marca e retiram do registo **de hoje** as trocas e adaptações dessa refeição (para os resumos do profissional não contarem o que não aconteceu). O histórico de dias anteriores nunca é apagado.
- Na ficha do aluno (profissional) o separador e o título passaram de «Corridas» a **«Cardio»** («Cardio neste aluno»), como na app do aluno.

## 8ap. Lista de compras: produtos que não há na loja e dias personalizados

- Com um supermercado escolhido, um produto de **marca** (último parêntese com maiúscula, ex. «Pão clássico (The Rustik Bakery)») que não se confirma nessa loja mostra «⚠ Não confirmado no <loja>» com **«Escolher alternativa»**. Os que só existem noutra loja e não têm equivalente também o oferecem; os que têm sugestão ganham «Usar».
- A alternativa vem do mesmo grupo (marca própria da loja e genéricos), com a quantidade recalculada para as mesmas calorias, ordenada pela semelhança. A troca vale **só para a lista de compras, por aluno e por loja** (neste telemóvel, `evolve_shop_alt_v1:<aluno>:<loja>`); «↺ Repor» desfaz. Fica registada em `adaptationHistory` como «troca_loja» (resumo do profissional: «Trocas na lista de compras»).
- **O plano alimentar não muda**: o aluno não o pode escrever (regra do servidor); quem o altera é o profissional. Se um dia se quiser aplicar a troca ao plano, é uma função do lado do profissional.
- **Dias:** além de 3 / 5 / 7 há «Personalizar»: − / número / + de 1 a 30. A lista, o título e o texto copiado usam esse número.

## 8aq. Refeição ignorada ou reagendada por engano

Apanhado no varrimento dos botões: depois de «Não vou fazer esta refeição» não havia como voltar atrás (e concluí-la deixava-a «feita» mas fora da conta, com «ignorada» na linha). Agora há **«↺ Voltar a incluir esta refeição»**, e concluir uma refeição ignorada (no detalhe ou no círculo) volta a incluí-la primeiro. Para as reagendadas há **«↺ Repor o horário original»**. As duas funções (`unskipMeal`, `unrescheduleMeal`) tiram do registo de hoje a ocorrência dessa refeição; o histórico de outros dias nunca é apagado. Nota: uma refeição reagendada muda de lugar na lista (ordenada pela hora nova).

## 8ar. Terminar o treino com séries por marcar

Se o aluno toca em «Terminar treino» com algumas (mas não todas) as séries marcadas, aparece «Terminar o treino?» com «Terminar mesmo assim» e «Continuar a treinar»: um treino guardado só o profissional o pode apagar. Com todas as séries marcadas guarda logo; sem nenhuma continua a avisar que falta marcar pelo menos uma.

## 8as. EVOLVE Treino: acessibilidade, áreas de toque e fiabilidade (auditoria de 05/11/2026)

Medido em Chromium (390 px, CPU 4× mais lento): a app abre em ~0,7 s e nenhuma interação demora mais de ~70 ms; o offline (aviso «Sem ligação · 1 alteração guardada neste telemóvel», fila local e envio ao voltar a rede) e o service worker (rede primeiro, cópia só sem rede) já estavam certos e não foram tocados. O que se corrigiu:
- **Estrutura:** `#alunoApp`/`#proApp` com `role="main"`; a saudação é o `h1`; a barra de baixo é `role="navigation"` com nome e `aria-current="page"` no separador ativo; carregar = `role="status"`, erros de entrada e de ligação = `role="alert"`.
- **Janelas (`openModal`):** `role="dialog"` + `aria-modal`, título/nome, o foco entra na janela, Tab/Shift+Tab não saem dela, Esc fecha, e ao fechar o foco volta ao botão de onde abriu (`closeModal`).
- **Avisos:** `showToast` anuncia-se numa região viva persistente (`#liveRegion`, `announce()`); a bolha visual fica `aria-hidden` para não repetir.
- **Toque:** `#alunoApp` e «Sair» com mínimo de 44 px (botões pequenos, cabeçalhos de secção, seletores, campos, nomes dos exercícios, pastilhas e «?» do RIR). Os − / + das cargas e repetições ficam com 34 × 44 px (acima dos 24 px do WCAG 2.2; 44 de largura não cabe duas colunas num ecrã de 390 px).
- **Contraste:** o texto vermelho passa a `--critical-text` (#FF7B72, ≥ 5,3:1 em todas as superfícies); o `--critical` antigo ficava a 4,1:1 sobre `--surface-2`.
- **Foco e movimento:** contorno `:focus-visible` global e, com «reduzir movimento» ligado, animações e transições praticamente instantâneas.
- Testado em `tests/treino-a11y.test.js`. **Não se mexeu** em schema, RLS, migrações nem Supabase. Ideias que ficaram de fora por não compensarem: `content-visibility` nos exercícios (sem ganho medido) e barra de progresso fixa no registo (colide com o cronómetro de descanso).

## 8at. Tabelas de alimentos num ficheiro à parte (`alimentos.js`)

- **O quê:** `FOOD_GROUPS` e `FOOD_DB` (≈ 200 KB, 19% do `app.js`) passaram para `alimentos.js`, que define `window.EVOLVE_FOOD = {groups, db}`. O texto das tabelas é o mesmo (conferido: 8 grupos, 1516 alimentos, mesmo hash do conteúdo).
- **Quem o carrega:** `index.html` e `gestao.html`, com `<script src="alimentos.js">` mesmo antes do `app.js`. O `treino.html` **não** o carrega: o EVOLVE Treino não mostra alimentação e o `app.js` fica com as duas tabelas vazias (`{}`), sem erros.
- **Service worker:** `alimentos.js` está no pré-cache e é servido com rede primeiro, como o resto do código (por isso as apps de alimentação abrem sem rede).
- **Para mexer nas tabelas:** editar `alimentos.js` (já não está no `app.js`). Os testes leem-no pelo `tests/extract-app.js` e `tests/helpers/app-text.js`. Os catálogos vindos do Supabase continuam a juntar-se a `FOOD_DB` em memória.
- **Teste:** `tests/alimentos-ficheiro.test.js` (10 verificações, incluindo o treino a abrir sem pedir o ficheiro).
- **Não medido num telemóvel real:** o ganho de tempo/descarga esperado é de cerca de 200 KB de código a menos para interpretar no EVOLVE Treino (≈ 37 KB comprimidos); só se confirma em iPhone/Android com rede móvel.

## 8au. EVOLVE Treino: registo de séries mais simples e separador «Evolução»

**Registo (separador Treino, ecrã de treino)** — o que já existia ficou como estava (botões −/+, RIR por toque, cronómetro de descanso, rascunho no telemóvel, «Terminar treino» com confirmação). Acrescentou-se:
- **Série atual:** a primeira série por marcar tem a etiqueta «Agora» e `aria-current="step"`; cada exercício mostra `feitas/total` (e ✓ quando completo); por baixo da barra diz quantas séries faltam. Ao marcar ✓ a série seguinte passa a atual e fica à vista (sem saltos se já se vê).
- **Valores da série anterior:** a série seguinte herda carga, **repetições** (novo) e RIR da que acabaste de marcar, a não ser que já a tenhas mexido. Marcar ✓ nunca é automático.
- **Série marcada sem repetições:** fica assinalada a vermelho, a marca não se desfaz e a série não é registada ao terminar; a pergunta de «Terminar treino» diz quantas são.
- **Retoma:** se a app for fechada ou recarregada com séries marcadas, «Hoje» mostra «Treino em curso» e o ecrã de treino mostra «Retomaste o treino em curso» (com «Recomeçar», que pede confirmação). O aviso sai no primeiro toque.
- **Estado do rascunho:** linha «Treino em curso guardado neste telemóvel às HH:MM». Se o telemóvel não deixar guardar (sem espaço, modo privado) avisa para não fechar a app. Sincronização e «sem ligação» continuam no indicador que já existia.
- Continua a valer: o rascunho expira ao fim de 12 h; o treino terminado fica na fila de envio se não houver rede.

**Separador «Evolução» (EVOLVE Treino: Treino | Evolução | Cardio)** — só com o que está registado em `workout_logs`:
- Período (4 semanas, 12 semanas, tudo): treinos, séries e volume, com a diferença para o período anterior do mesmo tamanho.
- Exercício (lista dos registados, do mais frequente): recordes pessoais de sempre (carga máxima, 1RM estimado, mais repetições, maior volume numa sessão, com a data da primeira vez e 🏆 se foi na última sessão); última sessão vs anterior; gráfico de 1RM estimado; volume das últimas 8 sessões. Exercícios de peso do corpo mostram só repetições.
- **O que é medido e o que é estimado:** volume = repetições × carga (séries sem carga não somam); o 1RM é uma **estimativa** (Epley, até 12 repetições), com o aviso no ecrã. Nada é projetado nem extrapolado.
- Estados vazios: sem treinos; período sem treinos; menos de 2 sessões (não mostra gráfico).
- **Corrida/bicicleta:** o separador Cardio já tinha distância, duração, ritmo médio e quilómetros por semana (corrida.js, não foi alterado); a Evolução tem só o atalho para lá.
- Sem alterações a schema, migrações, RLS ou Supabase.
- Testes: `tests/treino-registo-evolucao.test.js` (35 verificações, em Node e Chromium).
- **Não verificado em telemóvel real:** toque, teclado numérico, ecrã apagado a meio do treino, rascunho depois de o iOS fechar a app em segundo plano.

## 8av. EVOLVE Treino: ecrã de treino, histórico, resumo da semana, sincronização e conforto

**Ecrã de treino**
- **Barra fixa em baixo** (por cima do separador, ao alcance do polegar): exercício, «Série n de N», carga × repetições da série atual e o botão **«✓ Feita»**. Só marca quando tocas (nunca sozinho); no fim passa a «Treino completo» + «Terminar treino».
- **Cronómetro de descanso compacto** no ecrã de treino (≈ 140 px em vez de ≈ 235): mesmos botões (pausa, ±15 s, reiniciar) e mesmo comportamento. O som ao acabar liga-se em «Conforto».
- **Ecrã ligado durante todo o treino** (Wake Lock), não só durante o descanso; liberta-se ao sair do ecrã de treino (se não houver descanso a correr) e volta a pedir-se ao regressar à app. Sem suporte do browser, nada acontece.
- **Conforto** (guardado só no telemóvel, `evolve_wl_comfort_v1`): *Controlos grandes* (campos e botões ≥ 56 px, um por linha), *Mão esquerda* («Feita» à esquerda, na série e na barra) e *Som ao acabar o descanso*.
- Letra das etiquetas maior (≥ 0,72 rem) e cada marcação é anunciada a leitores de ecrã («Série 1 de … feita. Faltam n séries.»).

**Histórico** (separador Treino → «Ver todo o histórico»): todos os treinos com séries válidas, por mês, com **pesquisa** (nome do treino ou do exercício, sem acentos nem maiúsculas) e período (4 semanas, 12 semanas, tudo). Tocar num treino abre o detalhe (cada série com carga × repetições e RIR, esforço, notas e se já está sincronizado). A lista dos «Últimos treinos» em «Hoje» também abre o detalhe.

**Resumo da semana** (cartão «Esta semana» em «Hoje»): dias de segunda a domingo com os treinos feitos, treinos feitos vs previstos (`trainingDays`), séries e volume, e a semana passada. Corrida e bicicleta (só se a Corrida estiver ligada): atividades, distância, duração e ritmo médio (só das corridas) da semana. **As corridas só são lidas quando o aluno toca em «Ver esta semana»** (ou depois de abrir o Cardio): a Corrida continua a não pedir nada antes disso (`RUN.weekSummary(s, onChange, load)` em `corrida.js`, aditivo).

**Sincronização** (linha de estado em «Hoje», no histórico e no ecrã de treino):
- *Tudo sincronizado* (com a hora do último envio), *por enviar* (guardado neste telemóvel), *sem ligação* (segue sozinho quando houver rede), *a enviar…*, *erro* (quantas tentativas; o treino continua guardado no telemóvel; botão «Enviar agora») e recusa do servidor (visível 30 min).
- Os treinos por enviar ficam registados à parte (`evolve_wl_unsent_v1`, por aluno) até o servidor confirmar a lista (`outboxAcked`) ou a recusar; no histórico levam a marca «⏳ por enviar». O envio em si (fila, tentativas, junção de listas) **não mudou**.
- O profissional que pré-visualiza o ecrã do aluno não vê este estado.

**Limites**
- Não testado em telemóvel real: uso com uma mão, toque, Wake Lock de verdade (simulado nos testes) e iOS a fechar a app em segundo plano. O Wake Lock só existe em browsers recentes (iOS ≥ 16.4).
- O resumo da semana não tem calorias nem frequência cardíaca (não são recolhidas). O cronómetro de descanso continua a não sobreviver a recarregar a página.
- Sem alterações a schema, migrações, RLS ou Supabase.
- Testes: `tests/treino-conforto-historico.test.js` (45 verificações, Node + Chromium).

## 8aw. EVOLVE Treino: revisão abrangente (arranque, calendário, pesquisa, ecrãs, erros)

**O que mudou**
- **Arranque:** «Hoje» mostra o treino previsto, a linha «Último treino: … · há N dias» e o botão para começar. Sem programa, o cartão explica o estado («quando houver treinos no programa, o de hoje aparece aqui») e mostra o último treino feito.
- **Calendário de atividade** (Histórico → Calendário): mês a mês (nunca meses futuros), um ponto por tipo (musculação, corrida/bicicleta), tocar num dia abre o resumo do dia (treinos com detalhe; corridas com «Abrir no Cardio»). **Resumo do mês:** treinos, dias com treino, séries e volume; corridas só depois de o aluno tocar em «Ver corridas do mês» (`RUN.monthSummary`, aditivo, igual ao resumo da semana: sem leituras antes de o aluno pedir). Se a lista de corridas lida pode estar incompleta, o ecrã diz.
- **Pesquisa no histórico:** treino, exercício, **notas, data** (05/11, 05/11/2026, 2026-11-05, «quinta», «novembro», «nov») e várias palavras em conjunto (todas têm de aparecer). Linhas com nota dizem «com nota».
- **Orientações:** os pontos-chave do exercício (até 3) aparecem no próprio exercício, em «Pontos-chave»; o «ⓘ» continua com a demonstração e o histórico de cargas.
- **Descanso:** o ajuste do descanso (−15 s/+15 s) vale também para as séries seguintes **do mesmo exercício** nessa sessão (repõe-se ao terminar; «Reiniciar» volta ao valor do programa).
- **Notas:** a caixa «Como correu?» abre sozinha quando todas as séries estão marcadas; a nota aparece no detalhe do treino e na pesquisa.
- **Feedback:** além de «✓ Treino guardado…», aparece «✓ Treino sincronizado» quando o servidor confirma um treino que estava por enviar.
- **Objetivo semanal:** barra de progresso «x de y treinos previstos» (dias previstos do programa). **Não há meta de distância:** a app só tem distância prevista dentro do plano de corrida (já mostrado no Cardio).
- **Erros:** se desenhar um separador falhar, aparece «Algo correu mal» com «Tentar outra vez» e «Voltar ao início» (os treinos e o treino em curso estão guardados à parte) em vez de um ecrã em branco.
- **Ecrãs:** em altura ≤ 520 px (telemóvel na horizontal) o cronómetro fica numa só linha, a barra da série e o separador ficam mais finos (sobram ~220 px para o treino em vez de ~108); em ≥ 900 px o conteúdo tem largura máxima de 880 px e fica centrado.

**Já existia e foi só confirmado:** retoma do treino (continuar/recomeçar, sem duplicar: o rascunho apaga-se ao terminar), pesquisa por treino e exercício, resumo da semana, estado de sincronização, descanso ajustável durante a sessão.

**Só documentado (não alterado, por risco ou por falta de dados)**
- **Distância/meta de corrida** semanal: não existe dado de meta fora do plano de corrida.
- **Velocidade de arranque (módulos):** a Corrida (`corrida-core.js`, `corrida.js`, `corrida-live.js`) já só é pedida quando o aluno a usa; o `app.js` (~900 KB) continua num só ficheiro porque o projeto não tem passo de compilação e partir o núcleo em ficheiros muda a ordem de avaliação de tudo.
- **Renderização:** marcar séries, escrever, pesquisar e o cronómetro já atualizam só o necessário; mudar de separador ou de filtro redesenha o separador (rápido, e mais seguro do que remendar o DOM).
- **Acoplamento app.js ↔ Corrida:** é feito só pelo objeto `RUN` (contrato no cabeçalho de `corrida.js`): `go/screen/wire/submitRun/…` e, agora, `weekSummary` e `monthSummary` (só leitura, sem coordenadas). O que falta separar é o estado: `state.*` (separador, filtros, calendário), `wlDraft` (rascunho em localStorage), `outbox`/`syncLast`/`evolve_wl_unsent_v1` (envio) e `RUN.*` (Corrida) vivem em sítios diferentes; este mapa é o ponto de partida para um módulo de estado de treino, só com um passo de compilação.
- **Consistência visual musculação/corrida:** os cartões da Corrida usam classes próprias (`run-*`) e os de treino as comuns (`card`, `btn`, `evo-*`); alinhar tudo exige tocar em `corrida.js` e nos seus testes.

**Limites:** não testado em telemóvel real (horizontal, uma mão, toque); o calendário só mostra corridas já lidas (100 por pedido); a pesquisa por data não aceita intervalos. Sem alterações a schema, migrações, RLS ou Supabase.
- Testes: `tests/treino-revisao.test.js` (34 verificações, Node + Chromium).

## 8ax. EVOLVE Treino: linguagem visual comum (musculação e corrida)

**Âmbito:** uma camada no fim de `app.css` («EVOLVE Treino — linguagem visual comum»), com todas as regras sob `html[data-app="treino"]`. O EVOLVE (`index.html`) e a Gestão não mudam (teste 14 do `treino-consistencia-visual`). A Corrida (`corrida.js`) não foi alterada: usa as mesmas classes, só passam a ter o mesmo desenho.

**O que estava inconsistente (medido em 390 px)** → **o que ficou**
- Botões com 4 cantos (9, 11, 14 px) e 4 tamanhos de letra (12,2 a 16 px) → canto único **12 px**; normal 44 px; **principal 56 px** com a mesma letra (Iniciar treino, Terminar treino, Importar ficheiro); secundário da corrida 52 px; barra da série 52 px.
- Estados de botão só em parte → **premido** (desce 1 px e escurece), **desativado** (50% e cursor «não permitido»), **a carregar** (`aria-busy="true"`: indicador a rodar, sem toques; com «reduzir movimento» fica parado) e **foco** de teclado (anel de 2 px) em botões, pastilhas, linhas, células do calendário, resumos, listas e campos. «Terminar treino» (modo profissional) e «Enviar agora» passam a mostrar o estado a carregar.
- Campos de texto com 13 a 14,4 px (o iPhone ampliava o ecrã ao tocar) e cantos de 8 a 10 px → **16 px** e canto **12 px** em todos (as caixas de carga e repetições do treino mantêm o tamanho grande próprio).
- Etiquetas de campo (formulários do treino, da pesquisa e da corrida) com 10,4 e 12,2 px → **12,2 px** (0,76 rem) em todos os ecrãs; as etiquetas de caixas de seleção ficam como estavam.
- Títulos: 27,2 px (nome do treino), 24 px (separadores), 19,2 px (secções da corrida) → **ecrã 24 px**, **secção 17,6 px** (corrida, calendário, janelas). O «Histórico» passa a ter título de ecrã como a Evolução e o Cardio.
- Cantos: controlos 12 px, superfícies interiores (kpi, linhas, avisos) 14 px, cartões 20 px.
- Estados: vazio, sem programa, sem corridas e erro ao desenhar usam o mesmo cartão centrado; erros (corrida, «Algo correu mal», avisos) usam todos o vermelho de texto acessível, 13,4 px e negrito; a linha de sincronização tem o mesmo tamanho de texto e canto.

**Mantido de propósito (contextos diferentes):** caixas de carga/repetições grandes (o treino) e barras de quilómetros (a corrida); cartão denso do registo (14 px de margem) vs cartões normais (22 px); letras e números da corrida (distância em destaque).

**Limites:** medido em Chromium; não visto num iPhone/Android reais. Há classes com nome antigo em `corrida.js` (`run-btn`, `run-h`, `run-state`) que se mantêm para não mexer nos testes da Corrida; a camada comum alinha-as por CSS.
- Testes: `tests/treino-consistencia-visual.test.js` (15 verificações em Chromium).

## 8ay. EVOLVE Treino: ronda de qualidade (desempenho com muitos treinos, acessibilidade do calendário, mudança de hora)

Medido com 800 treinos registados e o processador 4× mais lento (≈ telemóvel): abrir a lista do histórico levava 736 ms e **cada tecla da pesquisa 778 ms** (a lista inteira, 800 linhas e 211 KB de HTML, era reconstruída).
- **Histórico paginado:** 40 linhas por página e «Mostrar mais (n treinos por ver)». O total e a pesquisa contam todos os resultados. Com 800 treinos: abrir a lista **170 ms**, cada tecla **35 ms**. A pesquisa espera 120 ms de pausa na escrita; o estado «por enviar» lê-se uma vez por lista (antes, uma vez por linha).
- **Calendário acessível:** deixou de usar `role="grid"`/`gridcell` sem linhas (ARIA inválido). É um grupo com nome («Novembro de 2026: dias com atividade»), os dias sem atividade ficam fora da leitura por voz e só os dias com treino ou corrida são botões com rótulo («2 de novembro: 1 treino»).
- **Mudança de hora:** `daysSinceDate` contava múltiplos de 24 h, por isso, na primeira hora do dia a seguir ao «avanço» de hora (dia de 23 h) «há 2 dias» aparecia como «há 1 dia» e, na última hora do dia de 25 h, o contrário. Passou a contar dias de calendário (afeta só esses dois dias do ano; é a única alteração fora da app de treino, partilhada porque a função é comum).
- **Por enviar:** os identificadores de treinos que já não existem na ficha (ex.: reposta pelo servidor) são esquecidos em vez de ficarem «por enviar» para sempre.
- A barra da série atual passa a ser uma região com nome («Série atual»).
- **Pré-visualização do profissional:** confirmado por teste que todos os separadores (incluindo histórico e calendário) abrem sem erros e sem o estado de sincronização do aluno.
- **Limites:** o desempenho foi medido com CPU simulada em Chromium; a lista de corridas (Cardio) não foi medida com centenas de corridas.
- Testes: `tests/treino-qualidade.test.js` (18 verificações, com fuso de Lisboa).

## 8az. EVOLVE Treino: robustez (dados estragados no telemóvel) e offline de ponta a ponta

Ronda de verificação por ângulos ainda não testados. Resultado: **dois defeitos reais corrigidos** e o resto confirmado.
- **Rascunho estragado (corrigido):** se o armazenamento tivesse um número ou um texto no lugar do rascunho do treino (outra versão da app, edição à mão), a primeira escrita falhava e «Hoje» nem desenhava (aluno sem conseguir treinar). O rascunho lido passa por `wlDraftClean`: só se aceita a forma certa, campo a campo.
- **Fila de envio estragada (corrigido):** uma entrada mal formada (`{ana: "x"}`, `cols` nulo, lista de treinos que não é lista) fazia o mesmo e bloqueava o envio das restantes. A fila lida passa por `outboxClean`: entradas inválidas caem, as boas ficam.
- **Saída do cartão «Algo correu mal»:** passa a ter «Continua a falhar?» → «Apagar o rascunho local» (apaga só o treino em curso e as opções de Conforto; os treinos guardados e os por enviar não são tocados).
- **Offline de ponta a ponta (confirmado, sem alterações):** com o service worker a sério — abre sem rede (29 ficheiros em cache, 0 pedidos falhados), regista e termina o treino («Sem ligação: 1 treino guardado neste telemóvel»), sobrevive a recarregar (3 treinos, 1 «por enviar») e ao voltar a rede sincroniza sozinho (3 treinos no servidor, sem duplicar).
- **Cardio com 400 corridas (confirmado):** 100 por página, abre em ~0,3 s com a CPU 4× mais lenta; a abrir uma corrida ~0,13 s. Sem alterações.
- **Já robustos:** cópia local (snapshot) estragada, «por enviar» e «conforto» com formas erradas.
- **Limites:** não testa o iOS a limpar o armazenamento, o Wi-Fi a falhar a meio de um pedido nem o disco realmente cheio (o aviso de rascunho não guardado já existia).
- Testes: `tests/treino-robustez.test.js` (12 verificações, incluindo 8 casos de armazenamento estragado e o offline real).


## 8ba. Fase 38: fiabilidade, estagnação unificada e painel do profissional

Resultado da auditoria (`auditoria-evolve.md`). O que mudou:
- **Mudança de hora (corrigido):** `computeLastCheckinDaysAgo` contava dias por milissegundos/24 h e falhava perto das 23:00 nos dias de mudança de hora (6 testes de datas partiam). Passa a contar dias de calendário (`daysSinceDate`). Teste: `tests/dst-days.test.js`.
- **Estagnação de peso, uma só decisão:** `signalWeight` decide; o cartão da Fase 37 (`tplPlateauCard`, «Adiar 2/3 semanas») fica só para alunos sem fase, e o motor de fases (`computePhaseReview`) trata dos restantes. Evento `estagnacao_adiada` no histórico do plano.
- **Catálogo mais rápido:** `fetchFoodProductsFast` (contagem + páginas em paralelo, com recurso ao método em série); as apps Treino e Gestão já não carregam alimentos no arranque.
- **Alimentos bloqueados:** `isFoodBlockedFor` impede que um rascunho colado aplique alimentos que o aluno evita ou a que tem alergia (avisa quantos saltou).
- **Números em português:** `ptDec`/`ptNum` na evolução e nas refeições.
- **Painel do profissional:** filtros rápidos «Avaliação em atraso» (≥ 42 dias), «Revisão de fase» e «Objetivo atingido»; cartão «Estado» no Resumo (`tplProEstado`).
- **Aluno:** o ecrã Hoje mostra as refeições antes do atalho para o Treino; o gráfico de adesão antigo só aparece com o check-in semanal ativo.
- **Testes:** `tests/run-all.js` conta os ficheiros ignorados (sem Playwright/Postgres) e falha com `EVOLVE_REQUIRE_BROWSER=1`; 48 ficheiros que liam o código com janelas de tamanho fixo passaram a fatias por função; o falso Supabase já não deixa o aluno escrever `weights`/`weight_current` (migração 0031).
- **Por fazer (decisão do profissional):** versões otimistas (Y1: nova migração + mudança na sincronização, alto risco, não validável sem a base real); aplicar 0020 (`plan_templates`) e 0026 (`studio_only`), que a produção ainda não tem; confirmar 0031 com a consulta no fim do ficheiro.

## 8bb. Y1: versão otimista da ficha (migração 0035)

- **Problema:** o profissional com a app em dois aparelhos (ou o aluno a gravar enquanto o profissional edita) podia sobrescrever, sem aviso, uma coluna que o outro acabou de mudar.
- **Como funciona:** `students.rev` (bigint) sobe em cada UPDATE (gatilho `zz_students_bump_rev`, que corre depois da verificação de permissões do aluno). O profissional envia `update … where rev = <a que leu>` (`outboxSendCols`). Se não alterar nenhuma linha, `resolveRevConflict` lê a ficha: as colunas que o servidor não mudou seguem com a versão nova (sem perguntar); se outro aparelho mudou mesmo uma coluna que vais gravar, pergunta (OK = manter as tuas, Cancelar = usar a do servidor, que atualiza a ficha local). Máximo de 3 tentativas; depois a alteração fica na fila.
- **Só o profissional** usa o filtro. O aluno grava como antes. Sem a coluna (migração por aplicar) a app grava como antes (`revColumnAvailable`).
- **Testes:** `tests/ficha-versao.test.js` (16 verificações: dois aparelhos, mesma coluna, colunas diferentes, mesmo valor, conflito misto, aluno, sem migração, ficha que não pára de mudar). A migração foi ensaiada na base real dentro de uma transação desfeita: o aluno continua a gravar as suas colunas, o contador sobe e as colunas do plano continuam recusadas.
- `tests/offline-browser.test.js` já não fica preso: fecha as ligações keep-alive do Chromium ao parar o servidor.

## 8bc. Nutrição do profissional: refeições recolhíveis

Cada refeição do plano (`tplPlanoMealEditor`) é um `<details class="pm-details">`: fechada mostra uma linha (nome, hora, kcal, nº de alimentos); aberta mostra o que já existia (nome, horário, remover, alimentos, «+ Adicionar alimento», macros). O estado aberto/fechado guarda-se por refeição (`PRO_MEAL_OPEN`, um `WeakSet` pela referência da refeição), por isso sobrevive aos redesenhos e à reordenação por horário; a refeição nova abre-se sozinha. Nenhuma lógica de edição mudou (os campos continuam no DOM). Teste: `tests/pro-refeicoes.test.js`.

Também recolhíveis (`proFold`, estado em `PRO_FOLD_OPEN`, lembrado durante a sessão): **Alvos nutricionais**, **Fase e objetivo de peso** e **Suplementação (creatina)**. Fechados mostram o essencial (ex.: «1800 kcal · P 140 · H 180 · G 55», «Cut», «creatina 4 g/dia»). Os testes de browser que clicam nestes cartões abrem-nos primeiro (`.pro-fold` → `open`).

## 8bd. Avaliação do profissional: secções recolhíveis

No separador Avaliação (só na vista do profissional; o aluno vê tudo como antes) ficam sempre visíveis o peso, os indicadores de composição e a tabela de avaliações. Recolhidos (`proFold`, estado lembrado na sessão): **Nova avaliação** (formulário + importar pesagens), **Perímetros**, **Pregas cutâneas** e **Fotografias de progresso**, cada um com o essencial no resumo (nº de avaliações, nº de fotos). Os testes de browser abrem os blocos antes de os ler.

## 8be. Check-ins do profissional: resumo e histórico curto

`tplProCheckins` abre com um resumo (quantos check-ins, quando foi o último e a média de adesão, energia e fome dos últimos 4) e mostra só os 6 mais recentes; os anteriores ficam num bloco recolhido «Anteriores» (`proFold`). As linhas são as mesmas de antes (todos os campos). Teste: `tests/pro-checkins.test.js`.

## 8bf. Perfil do profissional: resumo em cada secção

As secções do Perfil continuam recolhidas por omissão e pela mesma ordem; cada uma passa a mostrar o essencial à direita do título (`perfilSection(..., meta)` + `perfilMetas`): idade/altura/peso, telefone ou email, dados médicos preenchidos («2 de 4»), horário de trabalho, alergias/restrições («sem alergias registadas» também aparece), água e opções do plano ativas. Testes em `tests/pro-checkins.test.js` (8 a 11).

## 8bg. Treino, Histórico e Progresso: mais curtos

- **Treino (profissional):** cada dia de treino vem recolhido (estado lembrado em `PRO_FOLD_OPEN`, chave `dia:<id>`); o formulário de novo exercício fica atrás de «+ Adicionar exercício»; «Progressão de carga» e «Sessões registadas» são blocos recolhíveis com resumo.
- **Histórico:** as 10 alterações mais recentes à vista, as anteriores num bloco «Anteriores».
- **Progresso do aluno:** Perímetros e Pregas cutâneas passam a blocos recolhíveis (as fotografias e o peso ficam à vista).
- **Testes:** `pack-repair-browser` (20b) esperava pelo redesenho com leitura imediata e falhava às vezes; passou a esperar pelo texto.
- **Instável sob carga:** `offline-browser` 15/16 (avisos de sincronização com tempos curtos) falha às vezes quando a bateria corre em paralelo e passa sempre sozinho.

## 8bh. Plano do aluno: refeições recolhíveis

No separador Plano do aluno, cada refeição é um `<details class="pl-meal">` com nome, hora e kcal no resumo; abre-se para ver os alimentos, trocar e ver as macros. O estado lembra-se enquanto a app está aberta (`state.planMealOpen`). O ecrã Hoje não mudou (já mostra as refeições do dia). Gestão e a app Treino não foram alteradas: a Gestão já esconde por omissão os pacotes sem nada a tratar («Mostrar todos») e o Treino é o ecrã de uso durante o treino.

## 8bi. Apagar um aluno a partir da lista

Cada linha da lista de alunos do painel tem um botão 🗑 («Apagar <nome>») que abre a mesma janela de confirmação do Perfil (`openDeleteStudentModal`): nada se apaga sem carregar em «Apagar» nessa janela. O botão não abre a ficha (`stopPropagation`). O caminho antigo (Perfil → «Apagar aluno») mantém-se. Teste: `tests/delete-from-list.test.js`.

## 8bj. Avaliação: marcas de fase, coluna da data fixa; Notas dentro do Perfil

- **Tabela de avaliações (profissional e aluno):** a coluna da Data fica fixa ao deslizar para o lado; a hora e a condição vão por baixo da data (coluna estreita); as variações (▲▼) vão por baixo do valor. Cada avaliação leva uma barra de cor da fase em que foi feita (Cut laranja, Bulk verde, Manutenção cinzento) e, ordenando por data, aparece uma linha «▶ Cut/Bulk · data · objetivo» no sítio certo (`phaseTimeline`: eventos `fase_inicio` do histórico + fase atual).
- **Resumos dos blocos recolhíveis** já não se sobrepõem ao título (o resumo quebra linha, no máximo 55 % da largura).
- **Separador Notas removido:** as notas privadas e as notas datadas passaram para uma secção «Notas privadas» no fim do Perfil (mesmos campos e botões). Quem tinha o separador «notas» aberto é levado ao Perfil.
- Testes: `tests/pro-checkins.test.js` (16 a 23); ajustados os que liam o formato antigo da data/hora.

## 8bk. Antes e depois: imagem no estilo das publicações

«Descarregar / enviar ao aluno» (e «Guardar a comparação» no aluno) gera agora **uma imagem por posição** (frente, lado, costas; só as que têm foto numa das datas), 1080×1350, fundo preto: por cima de cada foto o peso («73,4 KG») e «Massa Gorda: 39,8%» da avaliação dessa data, as duas fotos lado a lado, o contador «1/3», a barra laranja e a marca EVOLVE em baixo (`drawComparisonSlide`, `comparisonHeadFor`). No telemóvel abre a folha de partilha com todas as imagens; no computador descarrega-as uma a uma. Sem fotos nenhumas sai uma só imagem, com os valores. O bloco «Nova avaliação» já não mostra texto de resumo ao lado do título.

O logótipo da marca está guardado em `logo-evolve.jpg` (886×887, branco sobre preto) e é usado na imagem de antes e depois (recortado e desenhado à direita da barra laranja). Se o ficheiro não carregar, a marca desenha-se em texto.
O logótipo (`logo-evolve-wordmark.jpg`, a versão recortada de `logo-evolve.jpg`) aparece também no ecrã de carregamento e no de entrada do EVOLVE (`index.html`, classe `.brand-logo`, com `mix-blend-mode: screen` para o fundo preto se fundir com o cartão). O mesmo corpo vale para `treino.html` e `gestao.html` (um teste exige o corpo igual nas três páginas), mas na **Gestão o logótipo fica escondido por CSS** (`html[data-app="gestao"] .brand-logo`), a pedido. Os ícones das apps mantêm o símbolo Φ (legível em tamanho pequeno).

## 8bl. Ecrã de entrada limpo e arranque com o Phi

**Entrada** (`#authScreen`): enquanto está visível o `<body>` leva a classe `on-auth` (posta em `showAuthScreen`, tirada em `hideAllScreens`). Com ela o cabeçalho e a faixa de protótipo desaparecem, o fundo fica `#0a0a0a`, o cartão perde fundo e borda, e aparece o logótipo, «Email», «Palavra-passe», «Entrar» e uma linha: «Acesso reservado à equipa EVOLVE» (EVOLVE e Gestão) ou «Acesso reservado aos alunos EVOLVE» (Treino). Por trás dos campos há um Phi muito discreto (`#authForm::before`, `#161616`, 172×275 px, com o topo 34 px acima do formulário); as medidas vêm de uma imagem de referência. «Criar conta» e «Esqueci-me da password» continuam lá, em cinzento pequeno (o primeiro acesso dos alunos convidados e a recuperação dependem deles). Nos modos «Criar conta» e «Recuperar» o título e o subtítulo voltam a aparecer.

**Arranque** (`#evSplash`, logo a seguir ao `<body>` das três páginas, escondido na Gestão por CSS): Phi branco com um anel laranja fino (`#e85d26` a 65 %), por cima de tudo, até a app decidir o que mostrar. Aí `hideAllScreens()` (que todos os caminhos chamam antes de mostrar o ecrã seguinte) verifica se `#appLoading` já não está visível e chama `splashRelease()`: espera o mínimo de 650 ms desde que a página abriu (`SPLASH_MIN_MS`, para o Phi não «piscar»), põe a classe `out` e retira o elemento 500 ms depois. A saída copia o vídeo de referência: dissolução de 0,27 s com `ease`, anel a alargar em linha reta (×1,42 em 0,35 s) e Phi a crescer 5 %. Com «reduzir movimento» sai em 0,12 s, sem anel nem escala. Se o JavaScript falhar, uma animação CSS (`evSplashFailsafe`) tira-o sozinho aos 6 s.

**Imagem de arranque do iPhone** (`splash/arranque-LxA.png`, 12 tamanhos, ligadas por `apple-touch-startup-image` em `index.html` e `treino.html`): o primeiro fotograma, antes de a página abrir, tem as mesmas medidas do `#evSplash` (Phi 78 px, anel 79 px, em px CSS) para a passagem não se notar. Geram-se com `python3 scripts/gerar-ecras-arranque.py` (Pillow). **O iOS só lê estas imagens quando a app é adicionada ao ecrã principal**: quem já a tinha instalada tem de a remover e voltar a adicionar para as ver; o resto da animação (dentro da página) atualiza-se sozinho. Teste: `tests/splash.test.js`.

## 8ba. Ícone do EVOLVE Treino a preto e branco e o logótipo offline

- **Ícone:** o EVOLVE Treino deixa de ter o ícone verde-água e passa a usar o mesmo preto e branco do EVOLVE (`icon-treino-180/192/512.png` iguais a `icon-180/192/512.png`, por decisão do Tiago). A Gestão mantém o ícone laranja. Como o Treino e o EVOLVE ficam com ícones iguais, no ecrã principal distinguem-se só pelo nome. O service worker subiu para `evolve-v6` para o ícone novo não ficar preso na cache. **No iPhone o ícone antigo fica guardado: apaga a app do ecrã principal e volta a adicioná-la pelo Safari («Partilhar → Adicionar ao ecrã principal»).**
- **Defeito apanhado pelo teste de offline:** `logo-evolve-wordmark.jpg` (logótipo da entrada e do carregamento, acrescentado no `main`) não estava no pré-cache do service worker, por isso sem rede aparecia partido. Passou a estar em `SHELL`.
- **Testes do `main` por atualizar:** com os «Pedidos de ajuda» retirados, o grupo «Resumo» da ficha do aluno só tem o Perfil e deixou de ter sub-separadores; `offline-browser` e `gestao-split` esperavam o botão «Perfil» e foram ajustados (sem alterações à app).


## 8bm. Perfil e Resumo mais simples

- **Dados médicos com Sim/Não** (`ynField`): «Tem alguma condição médica ou patologia?», «Toma medicação?» e «Tem lesões ou limitações físicas?». «Não» não pede nada; «Sim» abre o campo para dizer o quê. Não há coluna nova: «Não» guarda o campo vazio e um campo com texto aparece como «Sim». «Sim» sem texto não grava (avisa). O resumo da secção passou a «N de 3 com registo» / «só observações» / «sem registos». Observações ficou como campo opcional.
- **Idade a partir da data de nascimento:** o Perfil tem agora o campo «Data de nascimento» (+ «Guardar data de nascimento») e a idade calcula-se sozinha. Ao ler a ficha (`rowToStudent`) a idade acompanha sempre a data de nascimento, por isso muda no dia do aniversário sem ninguém mexer; sem data de nascimento mantém-se a idade guardada. A coluna `age` não é reescrita por causa disto.
- **Peso no «Estado do aluno»:** em vez de uma linha comprida, linhas separadas: «Peso atual», «Objetivo» (com «faltam X kg» ou «atingido»), «Peso perdido» / «Peso ganho» desde o início (o nome muda sozinho conforme o peso desce ou sobe) e, quando há uma fase iniciada depois do início (ex.: Bulk depois do Cut), «Nesta fase» a contar desde o dia e o peso em que a fase começou. O objetivo muda quando se inicia a fase nova na Nutrição (isso já atualizava o peso objetivo).
- **Fora do Perfil:** «Notas privadas» (e as notas datadas) e «Apagar aluno». Apagar faz-se pelo 🗑 da lista de alunos, com a mesma confirmação. Nenhuma ficha tinha notas guardadas quando se retirou; a coluna `notes` não foi apagada. Testes: `tests/perfil-simplificado.test.js`.

## 8bn. Avaliação mais fácil de ler

- **Gráfico do peso** (`trendChartSvg`, no cartão «Evolução de peso»): cada dia é um ponto discreto (média do dia) e a linha laranja é a tendência, uma média móvel centrada (± span/30 dias, entre 2 e 10). Assim os altos e baixos do dia a dia não escondem a evolução. Tem eixo com valores, meses (ou 4 datas em períodos curtos), a linha do objetivo a tracejado verde (só se não estiver longe demais), o início das fases e os valores do primeiro e do último dia. O eixo do tempo é real (dias), não por índice. Com menos de 8 dias não há suavização. Os gráficos dos exercícios (Treino) continuam com `weightSvg`.
- **Histórico das avaliações por medida** (`tplAssessHistory`): botões Peso · M. gorda · M. muscular · Visceral · Água (só as medidas que existem). Para a escolhida aparece o gráfico, «Desde dd/mm/aaaa: X → Y» e uma lista data → valor → variação para a anterior. A cor diz se a variação foi no sentido certo: o peso conforme a fase nessa data (Cut desce, Bulk sobe, sem fase conforme o peso objetivo), a massa gorda e a visceral a descer, e a massa muscular e a água a subir. Mudanças pequenas ficam a cinzento (peso, gordura e água < 0,3; músculo < 0,2; visceral < 1). As marcas «▶ Cut/Bulk» e a cor da fase na borda das linhas continuam. «Tabela completa» (`state.assessView = "tabela"`) mostra a tabela de sempre, com ordenação e ✕ para apagar, e «Ver por medida» volta à lista. A medida escolhida fica em `state.assessMetric`. Vale para o profissional e para o Progresso do aluno. Testes: `tests/avaliacao-legivel.test.js`.
