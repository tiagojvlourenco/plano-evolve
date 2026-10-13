# Evolve Nutrition — resumo técnico da estrutura

> Nota: **não existe `src/`**. A app é um único `index.html` (~12 000 linhas, JavaScript puro dentro de uma IIFE, CSS com variáveis, sem build, sem framework). Os números de linha abaixo são aproximados (estado em `main` após o PR #24).

## 0. Visão geral

| Camada | Tecnologia |
|---|---|
| Front-end | `index.html` (HTML + CSS + JS num só ficheiro), PWA (`manifest.json`, ícones `icon-*.png`) |
| Backend | Supabase (Auth + Postgres com RLS + Storage `progress-photos`) |
| Dados de catálogo | SQL gerado offline em `scripts/` e corrido à mão no SQL Editor |
| Testes | `node tests/run-all.js` (avalia a app em Node com um DOM falso, `tests/extract-app.js`) |
| UI | PT-PT, tema escuro |

Não há router: o estado vive em `var state = {...}` (≈ linha 6126) e cada "ecrã" é um `renderXxx()` que reescreve `innerHTML`.

---

## 1. Rotas e menus

### 1.1 Arranque e autenticação
`boot()` → `initSupabase()` → `sb.auth.getSession()` → `handleSession()`. Ecrãs (alternados com `hideAllScreens()`):

- `authScreen` (`showAuthScreen`, modos `signin` / criar conta / recuperar), `recoveryScreen` (evento `PASSWORD_RECOVERY`), `connectionErrorScreen`, ecrã de loading.
- Sem Supabase configurado, a app abre em modo demonstração com um `modeSwitch` (aluno ⇄ profissional).
- O papel é decidido pelo servidor: existir linha em `professionals` ⇒ profissional; caso contrário é aluno e a linha `students` é associada à conta via `claim_student_row` (RPC).
- **Sem rede**: se não for possível perguntar ao servidor (`checkIsProfessional()` devolve `null`) ou ler as fichas, o **aluno** abre a última cópia da sua ficha (`bootFromSnapshot`, `localStorage` `evolve_snapshot_v1`); o profissional vê o `connectionErrorScreen` (nunca guarda fichas de alunos no dispositivo). O arranque não espera pelas fotos: os URLs assinados só se pedem ao abrir a evolução (`lazyPhotos`).

### 1.1b Gravação, fila offline e service worker
- **Escrita** (`persistStudent`): agrupa alterações (500 ms), compara a ficha com a última versão aceite pelo servidor (`s._sync`, por coluna) e entra na **fila** (`evolve_outbox_v1`, `localStorage`) só com as **colunas que mudaram**. `outboxFlush()` envia a fila por aluno com `update(cols).eq("id", id)`; falhas de ligação/servidor (5xx, 401, 429) repetem-se (online, ao voltar à app, a cada 15 s); recusas do servidor (permissões, formato) isolam-se por coluna: só a recusada é descartada (a ficha é reposta com a versão do servidor, com aviso) e os treinos recusados por "só acrescentar" são fundidos por `id` e reenviados; um `update` que não altera nenhuma linha também conta como recusa. A fila guarda **cópias** (nunca referências vivas da ficha). Ao fechar a app (`pagehide`/`visibilitychange`) o pedido é guardado na fila de forma síncrona. Um aluno nunca reenvia colunas que só o profissional altera (o trigger do servidor recusaria).
- **Indicador** `#syncPill`: "Sem ligação · N alterações guardadas" / "⏳ N por enviar".
- **Cópia da ficha do aluno** (`evolve_snapshot_v1`): atualizada em cada leitura e em cada alteração; apagada, com a fila, ao terminar sessão (`offlineDataWipe`).
- **Dados frescos do profissional**: `proRefreshAndRender()` (ao voltar à app, no máximo de minuto a minuto, e botão "↻ Atualizar") atualiza **no próprio objeto** só as fichas sem alterações por enviar e que não estão abertas; não corre com uma janela aberta nem se houve alterações locais durante a leitura.
- **`sw.js`**: pré-cache da página, `vendor/supabase.js`, fontes e ícones; navegação com rede primeiro (`no-cache`) e cache como reserva; ficheiros do site cache-first; **nada de outros servidores** (Supabase, OFF, YouTube) passa pela cache. Subir `VERSION` ao mudar `vendor/`, `fonts/` ou ícones.

### 1.2 Aluno — `renderAlunoShell()` / `renderAlunoTab()` (`state.alunoTab`)
Barra inferior com 3 separadores:

| Separador | Conteúdo (templates) |
|---|---|
| **Hoje** (`hoje`) | `tplHoje` = Ação do Dia + `tplTodayWorkout` + `tplTodayMeals` |
| **Plano** (`plano`) | `tplPlanoTabs` com secções Alimentação (`tplPlano`, `tplMealFixed/Choice/Builder`), Treino (`tplTrainingProgramCard`) e Compras (`tplShoppingList`: lista semanal agregada do plano, com escolha do supermercado — marca própria deduzida da marca, equivalente na loja escolhida em `storeSuggestion`, texto para copiar; comprados e loja guardados em `localStorage` por aluno) |
| **Progresso** (`evolucao`) | `tplEvolucaoAluno` (peso, avaliações, perímetros, pregas, fotos, adesão) + `tplCheckin` |
| *(ecrã cheio)* `treino` | `tplTreinoScreen` / `tplWorkoutLogger` (registo de séries, descanso automático; rascunho em `localStorage` `evolve_wl_draft_v1`) — conta como "Hoje" na barra |

### 1.3 Profissional — `renderProShell()` (`state.proView`)
Barra lateral:

- **Alunos** (`proView = "dashboard"`) → `renderProDashboardMain()`: lista ordenada por atenção (pedidos pendentes → críticos → alertas → dias sem registo), com indicador de pedidos de ajuda pendentes (`state.pendingHelp`).
  Por cima da lista: **"Hoje: quem contactar"** (`computeContactQueue`: motivos ponderados, exclui inativos, contactados há <3 dias e adiados; botão Contactar → `openContactModal` com mensagem editável e link `wa.me`), **alunos novos** (`onboardingOf`, 30 dias) e **pulso do estúdio** (`studioPulse`).
  Cada aluno mostra também badges de ação (`computeCoachBadges`): sem registos, peso estagnado (com ou sem treino a evoluir), adesão a cair e alta adesão.
- **Estúdio** (`proView = "studio"`) → `renderProStudioMain()`: a cobrar/em atraso/pacotes a acabar/presença do mês, registo rápido de sessões (feita, faltou, cancelou, cancelou tarde), cobranças por receber (com "Pago" e lembrete por WhatsApp), pacotes a acabar e exportação CSV (cobranças e sessões do mês). Os dados lêem-se de novo de cada vez que o ecrã abre. Na ficha do aluno, o separador **Pacotes** (`tplProSessoes`). Pagamentos em atraso, pacotes a acabar/terminados e faltas entram como motivos em "Hoje: quem contactar".
- **Catálogo** (`proView = "catalog"`) → `renderProCatalogMain()` / `renderCatalogList()`.
- **Aluno aberto** (`state.proSelectedId`) → `renderProDetailMain()` com 4 áreas (`PRO_NAV`):

| Área | Sub-separadores (`state.proTab`) | Template |
|---|---|---|
| Resumo | `leitura`, `pedidos`, `checkins`, `perfil`, `notas`, `historico` | `tplProLeitura`, `tplProPedidos`, `tplProCheckins`, `tplProPerfil`, `tplProNotas`, `tplProHistorico` |
| Nutrição | `plano` | `tplProPlano`, `tplPlanoMealEditor`, `tplAddFoodForm`, `tplEditFoodForm`, `tplTemplatesBar("nutricao")` |
| Treino | `treino` | `tplProTreino`, `tplTemplatesBar("treino")` |
| Avaliação | `evolucao` | `tplEvolucaoAluno`, `tplAssessForm`, `tplAssessTable`, `tplPhotoCompare` ("Antes vs Depois": fotos + `compareMetricsHtml`) |

Há ainda: convite de aluno (questionário), importação de pesagens (`tplImportWeighIns`/`tplImportPreview`), cópia do questionário, e o botão voltar com ações rápidas no ecrã do aluno.

---

## 2. Base de dados (Supabase / Postgres, `supabase/migrations/0001…0024`)

Migrações corridas à mão por ordem. Todas as tabelas têm **RLS** ligado.

### `students` (uma linha por aluno; muitos dados em `jsonb`)
- Identidade/perfil: `id` (text, PK), `auth_user_id`, `name`, `initials`, `age`/data de nascimento, `sex`, `height`, `weight_initial|current|goal`, `goal`, `is_demo`, ativo/arquivado, nível de atividade, dados do questionário (treino, sono, preferências, orçamento, tempo de cozinha, dados médicos…).
- Listas/objetos `jsonb`: `training_days`, `likes`, `dislikes`, `avoid`, `allergies`, `targets`, `alerts`, `meals` (o plano), `meal_daily_state` (+ `meals_date`), `checkins`, `weights`, `assessments`, `photos`, `plan_history`, `substitution_history`, `adaptation_history`, `training_program` (0019), `workout_logs` (0019).
- Estrutura de `training_program`: `{name, days:[{id, name, exercises:[{id, name, sets, reps, rpe, rest, notes, demo?, cues?}]}]}` — só o profissional escreve.
- Estrutura de `workout_logs`: `[{id, date, dayId, dayName, rpe, notes, entries:[{exerciseId, name, sets:[{reps, load, rir?}]}]}]` — o aluno só acrescenta (validado por `workout_log_is_valid` / `workout_logs_appended_are_valid`).
- Históricos (`substitution_history`, `adaptation_history`, `workout_logs`) são **append-only** por trigger (0006, 0019).

- Retenção (0022): `phone`, `contact_log` (`[{date, kind:'contacto'|'adiado', channel?, reason?, until?}]`, últimos 50) e `created_at` (fichas antigas ficam vazias). Só o profissional os altera (fora da lista do trigger de permissões do aluno).

### `session_packs`, `sessions`, `payments` (0023)
Pacotes de sessões (`total`, `price`, `starts_on`/`expires_on`, regras `missed_consumes` e `late_cancel_consumes`), sessões (`feita` | `faltou` | `cancelada` | `cancelada_tarde`, ligadas a um pacote) e cobranças (`amount`, `due_on`, `paid_on`, `method`). Só profissionais leem e escrevem (uma política `for all` por tabela); apagar o aluno apaga o histórico, apagar um pacote deixa sessões e cobranças sem pacote. Em modo local ficam em `localStorage` (`evolve_studio_v1`, com dados de demonstração). Regras em `sessionConsumes`/`packUsage`/`pickPackForSession` (a sessão desconta ao pacote que caduca primeiro); a app regista e avisa, não cobra nem emite faturas.

### `session_slots` e contagem automática (0024)
`session_slots` guarda o horário semanal de um aluno (`weekday` 1=segunda…7=domingo, `time`, `counts_from`, `generated_until`). `studioAutoSessions()` (ao abrir a app, ao abrir o Estúdio, ao voltar à app e ao criar um horário) cria como **feitas** (`sessions.source = 'agenda'`) as sessões do horário que já passaram (a de hoje só depois da hora + 1 h), desconta-as ao pacote que caduca primeiro e avança `generated_until`; nunca duplica (uma sessão já registada nesse dia/hora, ou sem hora, ocupa o lugar; índice único parcial no servidor). As exceções (faltou, cancelou, mudou de dia) marcam-se na **Agenda** do Estúdio. `session_packs.used_before` = aulas já dadas antes de usar a app; `studioImportPacks()` importa uma linha por aluno (nome; aulas; início; valor; aulas já dadas). O **Resumo de treinos** (`studioSummaryRows`) substitui o e-mail semanal: valor, total, progresso, em falta, "aguarda renovação" e aulas extra (sessões sem pacote depois do último pacote; um pacote novo desconta-as). O menu Estúdio mostra quantos alunos precisam de atenção.

### `studio_settings`, `sessions.external_id` e Google Agenda (0025)
`studio_settings (key, value jsonb)` guarda definições do Estúdio (chave `google_calendar`: `clientId`, `useAsSource`, `aliases`, `lastSync`); só profissionais. `sessions.source` aceita também `calendario` e `external_id` guarda o id do evento (índice único parcial por `external_id` quando `source = 'calendario'`). Fluxo: Google Identity Services (`initTokenClient`, âmbito `calendar.readonly`, token só em memória) → `fetchCalendarEvents` (Calendar API v3, `singleEvents=true`, paginação) → `normalizeCalendarEvent` → `matchEventStudent` (alias › nome exato › parte depois do último " - " › nome completo único no título › primeiro+último) → `planCalendarSync` (inserir/atualizar/remover, dedup contra sessões não-calendário, cor 11 = faltou, só até ao fim de hoje) → `applyCalendarPlan`. `calUsesCalendar()` pausa a geração do horário semanal. Testes: `tests/gcal.test.js` (lógica) e `tests/gcal-browser.test.js` (ecrã, com o script da Google e a API intercetados).

### `professionals`
`user_id` (PK → `auth.users`), `email`, `created_at`. Só se lê a própria linha; só se gere pelo SQL Editor (`supabase/manage_professionals.sql`).

### `help_requests` / `help_request_notes`
`help_requests`: `id`, `student_id` → `students`, `created_at`, `situation`, `meal_name`, `note`, `status` (`pendente` | `tratado`). O aluno só insere para si; o profissional lê/trata. `help_request_notes`: notas do profissional sobre um pedido.

### `plan_templates` (0020)
`id`, `kind` (`nutricao` | `treino`), `name`, `data` (jsonb: refeições com alimentos, ou dias com exercícios), `created_by`, `created_at`. Só profissionais leem, criam e apagam. Em modo local (sem Supabase) os templates ficam em `localStorage` (`evolve_plan_templates_v1`).

### `exercise_library` (0021)
`id`, `name` (único, sem distinguir maiúsculas), `muscle_group`, `equipment`, `demo` (https), `cues` (jsonb, até 3), `note`, `created_by`, `created_at`. Partilhada por todo o estúdio: todos os profissionais leem, criam, editam e apagam; alunos nunca a veem. A lista base (84 exercícios em 10 grupos, `EXERCISE_SEED`, nomes em inglês; o nome português fica só como alias de pesquisa) vive no código. A demonstração de 79 deles é uma animação WebP de 2 fotogramas na pasta `exercises/` (servida pelo GitHub Pages, `EXERCISE_MEDIA_BASE`; imagens do Free Exercise DB, domínio público; gerada por `scripts/build-exercise-media.py`, nome do ficheiro = `slug(nome)`); os restantes ligam a uma pesquisa de vídeo no YouTube; um exercício guardado aqui com o mesmo nome substitui o da base (apagá-lo repõe o original). Em modo local fica em `localStorage` (`evolve_exercise_library_v1`). No editor de treino, "📚 Escolher da biblioteca" (`openExerciseLibrary`) preenche nome, demonstração e pontos-chave do formulário.

### `custom_foods`
`id`, `name`, `kcal`, `protein`, `carbs`, `fat`, `food_group` (`protein|carb|veg|fat|fruit`), `created_by`, `created_at`. Leitura para autenticados, escrita só para profissionais.

### `food_products` (catálogo de supermercado, 0018)
`id`, `ean` (único), `name`, `brand`, `food_group` (`cereais|laticinios|carnes|fruta|vegetais|gorduras|snacks`), `package_quantity`, `package_unit`, `nutrition_basis` (`100g|100ml`), `kcal`, `protein`, `carbs`, `fat`, `sugars`, `fiber`, `saturated_fat`, `salt`, `ingredients`, `allergens`, `source_url`, `internal_note`, `source_type` (`official|label|open_food_facts|legacy_phase30`), `verification_status` (`pending|verified|rejected`), `verified_at/by`, `created_by`, `created_at`, `updated_at`.
RLS: o aluno só vê `verified`; o profissional vê todos.

### `food_product_retailers`
`food_product_id` → `food_products` (cascade), `retailer` (`Continente|Pingo Doce|Mercadona|Auchan|Lidl`), `retailer_product_url`, `last_seen_at`; único por (produto, retalhista).

### Funções/RPC e Storage
- RPC `claim_student_row` (associa conta ↔ linha de aluno; 0008).
- Bucket privado `progress-photos` (URLs assinados de 6 h; políticas de delete em 0011).
- Verificações de segurança: `supabase/verify_security.sql`, `verify_food_products_security.sql`.

---

## 3. Pesquisa de produtos / nutrição

### 3.1 Fontes de alimentos e carregamento
Tudo converge num dicionário global **`FOOD_DB[nome] = {per, kcal, p, c, f}`** (`per`: `"100g" | "unit" | "fixed"`), mais **`FOOD_GROUPS`** (grupo → lista `{name, qty}`) e **`FOOD_PACKS[nome]`** (tamanho da embalagem).

1. **Embutidos no código**: `FOOD_DB` (≈ linha 2848) e `FOOD_GROUPS` (≈ linha 785) — INSA e alimentos curados.
2. **`custom_foods`** → `loadCustomFoods()` → `mergeCustomFood()`.
3. **`food_products` (só `verified`)** → `loadFoodProducts()` → `fetchAllFoodProductPages()` (páginas de 1000, ordenadas por `id`) → `mergeFoodProduct(row, retailers)`:
   - nome final `Nome (Marca)`, com `· Retalhista` só se houver exatamente 1 retalhista;
   - nunca substitui um alimento existente (só acrescenta o tamanho da embalagem);
   - regra de **embalagem inteira** (`hasWholePackFood`, `packSizeOf`, `snapToWholePacks`, `isPerishableAfterOpening`): produtos ≤ 350 g/ml em dose única são propostos/arredondados a embalagens inteiras.

### 3.2 Pesquisa no plano de nutrição (profissional)
- `allFoodNames()`: lista de **todos** os nomes (a pesquisa já não é restrita ao grupo — Fase 32), ordenada com `Intl.Collator("pt")` e **em cache** (refeita só quando o nº de alimentos muda).
- `filterFoodNames(names, query)`: filtro por substring em minúsculas.
- `foodSearchResultsHtml()`: renderiza no máximo `FOOD_SEARCH_RENDER_CAP = 40` linhas e mostra "+N mais — continua a escrever".
- `foodOptionsForGroup()` / `optionsFor()` continuam por grupo (substituições e "ver mais alimentos").
- Cálculo: `parseQtyAmount()` → `foodNutrition(name, qty)` (g, ml, colheres, unidades, "à vontade"); `buildQtyString()` e `unitKindFor()` fixam a unidade por alimento.

### 3.3 Pesquisa no Catálogo (profissional)
- `loadCatalogProducts()` carrega **todos** os estados (não só `verified`), ordena por nome e calcula uma chave de pesquisa `p._k = nome\nmarca\nean` (minúsculas) uma só vez.
- `catalogFilteredProducts()` aplica: texto (nome, marca ou EAN), grupo, estado de verificação e retalhista.
- `renderCatalogList()` mostra **40 por página** (`CATALOG_PAGE`, `state.catalogLimit`, botão `#catalogMore`) com contagem de resultados; a pesquisa tem debounce de 250 ms e, ao voltar ao Catálogo, mostra de imediato a lista em cache.
- Edição/validação de produtos via `wireProCatalog` / `wireCatalogListActions`.

### 3.4 Pipeline de dados (offline, `scripts/`)
- `import-food-products.js`, `migrate-phase30-products.js` e `lista-*.csv` → `output-import-*.sql`; revisões de nomes em `output-review-*.sql` / `output-translate-*.sql`.
- `generate-pack-sizes.js` + `lib/pack-size.js` → `output-pack-sizes.sql` (UPDATEs idempotentes `where ean=… and name=… and package_quantity is null`) e `output-pack-sizes-review.csv`.

---

## 4. Ficheiros principais (equivalente a `src/`)

| Ficheiro | Papel |
|---|---|
| `index.html` | **Toda a app**: CSS, HTML dos ecrãs, JS (estado, render, rede, regras de nutrição/treino/antropometria) |
| `manifest.json`, `icon-*.png` | PWA (cores `#0D0F12`) |
| `sw.js` | Service worker (a app abre sem rede) |
| `vendor/supabase.js`, `fonts/*.woff2` | Supabase JS 2.117.3 e fontes guardados no site (sem CDN; ver `vendor/README.md`) |
| `exercises/*.webp` | Animações da biblioteca de exercícios (`scripts/build-exercise-media.py`) |
| `supabase/migrations/0001…0025_*.sql` | Esquema, RLS, funções e triggers (correr por ordem) |
| `supabase/manage_professionals.sql` | Adicionar/remover profissionais |
| `supabase/verify_*.sql` | Verificações de segurança/RLS |
| `scripts/` | Geração/importação do catálogo e tamanhos de embalagem |
| `tests/run-all.js`, `tests/extract-app.js`, `tests/*.test.js`, `tests/helpers/` | Suite (≈ 75 ficheiros, ≈ 2400 verificações; inclui testes em Chromium com um Supabase simulado e sem rede) |
| `docs/OPERACOES.md` | Operação: contas, demo, fotos, backups |
| `docs/ARQUITETURA.md` | Este documento |

### Mapa do `index.html` (aproximado)

| Linhas | Conteúdo |
|---|---|
| ~785 | `FOOD_GROUPS` |
| ~2670 | `optionsFor` e regras de refeição |
| ~2848 | `FOOD_DB` |
| ~4400–4500 | `loadCustomFoods`, `mergeFoodProduct`, `loadFoodProducts` |
| ~4775–4830 | `allFoodNames`, pesquisa de alimentos |
| ~5730 | normalizadores (`normalizeWeights`, `normalizeCheckins`, `normalizeWorkoutLogs`…) |
| ~5663 | `initSupabase` |
| ~6126 | `var state` |
| ~6739–8230 | UI do aluno (shell, Hoje, Plano, Treino, Progresso) |
| ~9183–10060 | UI do profissional (shell, dashboard, ficha do aluno) |
| ~10069–10370 | Catálogo |
| ~11797 | autenticação (`showAuthScreen`) |
| ~12000 | `boot()` |
