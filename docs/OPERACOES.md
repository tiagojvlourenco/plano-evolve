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
| **EVOLVE Treino** | `treino.html` | verde-água | Musculação (programa, registo de cada sessão, descanso, música) e **Corrida**; para o aluno |
| **EVOLVE Gestão** | `gestao.html` | laranja | Estúdio e Contratos; só para o profissional |

- O código é o mesmo (`app.js`, `app.css`); cada página só diz de que app é com `<html data-app="…">` (`treino`, `gestao`; sem atributo = EVOLVE). `APP_MODE` em `app.js` escolhe o que se mostra.
- **O treino saiu da app EVOLVE**: lá, «Hoje» tem só as refeições (e um atalho «Treino e corrida» para a nova app) e «Plano» só Alimentação e Compras. Os dados (`training_program`, `workout_logs`) não mudaram de sítio nem foram tocados; o profissional continua a editar o programa na ficha do aluno (grupo «Treino»). Alunos que «não fazem nutrição comigo» só veem o atalho na EVOLVE e usam a EVOLVE Treino.
- **EVOLVE Treino**: dois separadores, «Treino» (o treino de hoje, o programa, os últimos treinos, uma ligação para a EVOLVE) e «Corrida» (ver 8u). Um profissional que abra `treino.html` vê o ecrã do aluno em pré-visualização, com o seletor de aluno.
- **Instalar**: abrir `…/treino.html` no Safari → Partilhar → «Adicionar ao ecrã principal». **No iPhone cada ícone guarda a sua própria sessão** (afirmação já feita em 8m, não verificada de novo): o aluno inicia sessão uma vez em cada app. Se o treino já estava aberto na EVOLVE como atalho, deve instalar a nova.
- O service worker guarda uma cópia de cada página por separado (`pageKey`) e `VERSION` subiu para `evolve-v5`; os ícones novos estão em `icon-treino-*.png`.
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
