/* =====================================================================================================================
   EVOLVE Treino — Corrida: núcleo puro (corrida-core.js)

   Este ficheiro é avaliado com eval direto (modo estrito) dentro da IIFE de app.js, concatenado ANTES de corrida.js
   (ver loadCorrida em app.js), e também com eval em Node nos testes. Por isso:
     - ES5 no estilo do projeto (var/function; sem arrow, let, const, async, template strings);
     - só declarações de topo com prefixo run / RUN_ (corrida.js e app.js veem-nas todas, porque o eval é um só);
       nomes que começam por runI são INTERNOS: não usar fora deste ficheiro;
     - não define RUN (já existe em app.js), não faz pedidos de rede, não usa localStorage, não toca no DOM;
       o único objeto do browser que usa é o DOMParser (só em runParseGpx / runParseTcx / runParseFile);
     - nenhum texto vindo de dados (nomes de ficheiros, autores, extensões) é devolvido por nenhuma função.

   ---------------------------------------------------------------------------------------------------------------------
   API (contrato com corrida.js)
   ---------------------------------------------------------------------------------------------------------------------
   Convenções
     Ponto      {lat, lon, t, acc}: graus decimais; t em MILISSEGUNDOS desde 1970 (UTC); acc em metros ou null.
     Segmento   array de pontos. «segments» = array de segmentos. Só nos pontos gravados ao vivo, o 1.º ponto de um segmento
                que não seja o primeiro traz b:"gap" (abriu por lacuna de sinal; g = segundos sem posições) ou b:"pause"
                (abriu depois de uma pausa pedida pelo aluno). Os leitores de ficheiros não escrevem b nem g. Em runStats("live"),
                uma quebra entre segmentos SEM b:"pause" conta como lacuna; em "import" qualquer quebra é pausa do relógio.
     Formato da BD (run_tracks.points)  [ [ [lat, lon, tsec], ... ], ... ]  — tsec = segundos INTEIROS desde runs.started_at.
     cfg        é sempre opcional; um objeto parcial junta-se a RUN_CFG chave a chave (ex.: {trimM: 500}).
     nowMs      opcional onde o «agora» conta (datas no futuro); por omissão Date.now(). Nos testes passa-se fixo.
     Falhas     as funções que podem falhar devolvem {ok:false, error:"mensagem PT-PT", code:"..."} e NUNCA lançam;
                as restantes devolvem null (ou o valor neutro indicado). Nenhuma função altera os argumentos de entrada,
                exceto runFeed / runPause / runResume, que alteram o state que recebem (e devolvem info).

   Fluxos típicos
     Ao vivo   st = runFeedInit(); runFeed(st, fix) a cada posição; runPause / runResume; rascunho = JSON.stringify(st) e, ao arrancar,
               runFeedRestore(JSON.parse(...)). No fim: stats = runStats(st.segs, null, "live"); track = runPrepareTrack(st.segs, {trimM, rnd: Math.random()})
               (null = sem percurso); row = runBuildInsert({id: runUuid(), studentId, source: "live", startedAtMs: stats.startedAtMs,
               durationS: stats.durationS, movingS: stats.movingS, distM: stats.distM, gaps: stats.gaps, gapS: stats.gapS,
               splitsS: stats.splitsS, hiddenS, rpe, notes, consentV}); run_tracks.points = track.segments, trim_m = track.trimM.
     Importar  r = runParseFile(file.name, await file.text()); se r.ok: stats = runStats(r.segments, null, "import"); o resto como acima
               com source = r.source. Mostrar r.warnings (texto fixo, sem dados do ficheiro) e runDupCheck(corridas, {startedAtMs, distM}).
     À mão     runParseKm / runParseDuration → runManualStats(startedAtMs, distM, durationS) → runBuildInsert com source "manual".
     Ver       runNormalizeRow(linha) nas listas; runTrackSvg(run_tracks.points); runToGpx(linha, run_tracks.points) para exportar.

   Auxiliares
     runCfg(cfg) → cfg completo      junta um cfg parcial a RUN_CFG (devolve o próprio RUN_CFG se cfg for vazio); não altera nada.
     runHav(lat1, lon1, lat2, lon2) → metros   haversine (raio médio 6 371 008,8 m), graus de entrada.

   Constantes
     RUN_CFG      todos os limiares. O grupo «hipóteses» NÃO foi medido (valores do desenho; calibrar na fase F2);
                  o grupo «espelho do SQL» copia os CHECK de supabase/migrations/0032_corrida.sql (um teste compara).
     RUN_SOURCES  ["live","gpx","tcx","fit","manual","native"] (valores aceites por runs.source).
     RUN_MSG      mensagens PT-PT dos erros de importação (as mesmas que runParse* devolvem em .error).

   Registo ao vivo (reducer; o state é um objeto JSON simples: JSON.stringify serve para o rascunho)
     runFeedInit() → state
         state público (só leitura): segs (segmentos; o último está aberto se state.open), open, paused, startedAtMs (t do
         1.º ponto aceite, ou null), lastGoodT, maxT, nPts, nFix, rej {invalid,time,acc,jump}, distM (float), movMs, gaps,
         gapMs, splitsS. NÃO mexer nestes campos por fora; usar runFeed / runPause / runResume / runLiveView.
     runFeed(state, fix, cfg) → {reason, added, good, gap}
         fix = {lat, lon, acc, t(ms)}; t é o position.timestamp. Quem chama deve limitá-lo ao relógio do telemóvel (t <= Date.now());
         o núcleo não tem relógio. Ordem das regras:
           invalid (campos em falta/fora de intervalo) → paused (ignorado) → time (t não cresce) → acc (acc em falta ou > accMaxM)
           → lacuna (passou > gapS desde o último fix bom: fecha o segmento, o próximo abre outro, gaps++, gapS += segundos)
           → jump (velocidade desde a âncora > vMaxMs) → near (a < minStepLiveM da âncora: fix bom, não é ponto) → ok (ponto novo).
         reason: "ok" | "near" | "invalid" | "paused" | "time" | "acc" | "jump". added: true só em "ok". good: true em "ok" e
         "near" (há sinal utilizável). gap: true se ESTE fix abriu um segmento por lacuna. Nunca se soma distância em linha
         reta através de uma lacuna nem de uma pausa. Distância pelo método da âncora (a âncora é o último ponto aceite).
         Horas: o máximo (maxT) só avança com fixes ACEITES; um fix recusado por precisão ou por salto, mesmo com hora adiantada,
         não o envenena. Se o fix que ABRIU um segmento (1.º da corrida, depois de lacuna ou de pausa) trouxe uma hora adiantada e o
         fix seguinte, com sinal utilizável, recua mais de timeBackS em relação a ele mas cabe na linha de tempo anterior, o fix
         adiantado é desfeito (sai do percurso e das lacunas; conta em rej.time) em vez de se recusar tudo o que vem a seguir.
         LIMITE CONHECIDO: uma hora adiantada de um fix a meio de um segmento (dentro de gapS) faz recusar os fixes seguintes até
         ao máximo de gapS segundos; uma hora adiantada no 1.º fix da corrida sem fixes seguintes não se deteta (sem relógio no núcleo).
     runPause(state, tMs) → state     fecha o segmento; os fixes seguintes dão reason "paused" até runResume.
     runResume(state, tMs) → state    o próximo fix aceite abre um segmento b:"pause" (não é lacuna; o tempo parado não conta).
     runFeedRestore(saved, cfg) → state | null    recria o state de um rascunho (JSON.parse do state guardado). Só usa saved.segs,
         saved.paused, saved.pauseAt, saved.pausedMs, saved.rej; valida tudo e recalcula os totais. O próximo fix aceite abre
         um segmento b:"gap" (a lacuna entre o último ponto guardado e a retoma), ou b:"pause" se estava em pausa.
     runLiveView(state, nowMs) → {distM, movingS, elapsedS, paceSPerKm|null, gaps, gapS, splitsS, points, paused, sinceGoodS|null,
         rej}   números arredondados para o ecrã. elapsedS = (agora - início - pausas) é o relógio de parede: INCLUI as lacunas e o
         tempo desde o último fix bom até «agora» (sinceGoodS). O que se grava é o de runStats, que acaba SEMPRE no último ponto
         (nunca soma o fim aberto); se a corrida «acordou» depois de uma lacuna enorme, ver runCutAtLastGap.
     runCutAtLastGap(segments, minGapS) → {segments, cutS, cutPoints}   «Terminar no último ponto bom»: cópia sem o que vem a partir da
         ÚLTIMA lacuna ao vivo (b:"gap") de pelo menos minGapS segundos (obrigatório; se faltar ou for inválido não corta nada). Quem
         chama decide quando a oferece; sem essa lacuna devolve tudo e cutS = 0.
     runReasonText(reason) → texto PT-PT curto para o motivo (ou "").

   Resultado final de qualquer fonte
     runStats(segments, cfg, mode) → {distM, durationS, movingS, gaps, gapS, splitsS, startedAtMs, endedAtMs, points, skipped}
         mode "live" (ou "native") | "import" (omissão). Inteiros arredondados. startedAtMs/endedAtMs null sem pontos.
         distM: método da âncora (minStepLiveM / minStepImportM), pontos com salto (> vMaxMs) ou tempo a recuar são ignorados (skipped).
         Em «import», antes de contar, limpa os pontos soltos: um ponto com posição absurda (1.º, último ou do meio; ou uma série de até
         spikeK-1 seguidos) sai SÓ ele (entra em skipped) em vez de fixar a âncora e apagar o que vem a seguir; um trecho curto (< spikeMaxS)
         solto no início ou no fim também sai; vários pontos seguidos (>= spikeK) coerentes entre si abrem um trecho novo (como uma pausa).
         Só salta o que passa de spikeMinM (30 m): saltos menores são ruído e contam como antes. Em «live» não há limpeza (o reducer
         já recusa os saltos), para dar o mesmo que o acumulado.
         durationS: tempo total SEM as pausas (lacunas incluídas): soma dos intervalos de cada segmento + (só em live) o intervalo
                    de cada lacuna entre segmentos. Em importação a quebra ENTRE segmentos é pausa do relógio: não conta, EXCETO se
                    os segmentos seguem a menos de importJoinS e com velocidade possível (um Lap/Track por km): aí liga-se (soma o
                    passo e o intervalo).
                    (desenho 2 dizia «último menos o primeiro»; aqui segue-se o SQL, «tempo total sem as pausas»; o relógio de
                    parede é endedAtMs - startedAtMs.)
         movingS: soma dos intervalos (âncora → ponto novo) com velocidade implícita > vMoveMin; movingS <= durationS sempre.
                  LIMITE CONHECIDO: como a âncora só avança a cada minStep (15 m ao vivo, 8 m em ficheiros), uma paragem de até ~30 s
                  seguida de arranque conta como movimento (sobrestima o «tempo em movimento» em segundos por paragem curta).
         gaps/gapS: live → lacunas entre segmentos (b:"gap") e os seus segundos; import → intervalos > max(importGapS, 3× o intervalo
                    mediano do segmento) entre pontos seguidos do MESMO segmento (um ficheiro gravado a 61 s por ponto não é «tudo
                    lacunas»). Pausas não são lacunas.
         splitsS: segundos EM MOVIMENTO de cada km completo (interpolação linear no cruzamento); o último km incompleto não entra.
     runManualStats(startedAtMs, distM, durationS) → stats para registo à mão (movingS = durationS; sem lacunas nem parciais).

   Privacidade do percurso (nada disto sai do telemóvel sem o aluno partilhar)
     runTrim(segments, R) → segments   remove TODOS os pontos a menos de R metros do primeiro ou do último ponto do percurso
         (partida e chegada; para um laço funciona); se remover do meio, o segmento parte-se em dois. R <= 0 não altera.
     runSimplify(points, eps) → points   Douglas-Peucker ITERATIVO (sem recursão). Mantém o 1.º e o último; nenhum ponto
         original fica a mais de eps metros do resultado. Aceita {lat,lon,...} ou [lat,lon,...]; devolve os mesmos elementos.
     runPrepareTrack(segments, cfg) → {segments, trimM, points} | null      segments = pontos {lat, lon, t(ms)} (não aceita a forma de arrays)
         cfg = {trimM, rnd}: trimM tem de ser um de RUN_CFG.trimChoices (0, 100, 200, 500, 1000, 2000); NaN, texto, null, negativo ou
         outro valor NÃO desligam o aparo: usa-se o por omissão (200; falha fechado). rnd ∈ [0,1) vem de quem chama (Math.random(); sem
         rnd, 0): o raio efetivo é trimM × (1 + trimSlack × rnd), ou seja, entre trimM e 1,5 × trimM; o que se guarda (trimM devolvido,
         run_tracks.trim_m) é o escalão NOMINAL. O raio é só uma folga: não impede deduzir a partida a partir de VÁRIAS corridas com
         a mesma partida (as circunferências intersetam-se); para isso só ajuda uma zona privada fixa, que o núcleo não tem.
         limpar pontos soltos (runIClean: o aparo centra-se no 1.º e no último ponto LIMPOS, não num fix antigo/espúrio nas pontas)
         → aparar → simplificar (eps 4, 8, 15, depois ×2 até caber em maxTrackPoints e em maxTrackBytes) → fundir
         segmentos até maxSegments → arredondar a 5 casas → t em segundos inteiros desde o 1.º ponto de `segments` (= startedAtMs
         de runStats) → descartar segmentos com < 2 pontos. null se não sobrar percurso (demasiado curto para esta privacidade,
         ou sem posições). Cabe sempre nos CHECK de run_tracks (1..200 segmentos; texto jsonb <= 200000).
     runTrackBytes(segs) → n   tamanho do texto jsonb equivalente (o que o CHECK octet_length(points::text) mede).

   Exportação (GPX do aluno)
     runToGpx(run, trackSegments) → string GPX 1.1 | null
         run = {startedAtMs} ou {started_at} (só precisa da hora de início, e só se os pontos vierem no formato da BD).
         trackSegments: formato da BD ([lat,lon,tsec], tempo = início + tsec) OU pontos {lat,lon,t(ms)}. Um <trkseg> por segmento,
         sem nome, sem autor, sem metadados; creator="EVOLVE" (o GPX 1.1 exige o atributo). null se não houver pontos válidos.

   Leitura de ficheiros (precisam de DOMParser; recebem TEXTO; runParseFile também aceita ArrayBuffer/Uint8Array)
     runParseGpx(text, opts) / runParseTcx(text, opts) / runParseFile(name, input, opts)
         → {ok:true, source:"gpx"|"tcx", segments, warnings:[PT-PT...], startedAtMs, endedAtMs, points, declaredDistM|null}
         | {ok:false, error, code}            opts = {cfg, nowMs}
         declaredDistM: distância que a app de origem declara, só como número (TCX: soma dos Lap/DistanceMeters ou, sem eles, o maior
         DistanceMeters dos Trackpoint; GPX: sempre null, não tem campo normalizado). Serve para avisar se difere muito da calculada.
         runParseFile detecta por conteúdo (raiz gpx / TrainingCenterDatabase), usa o nome só para recusar «.fit»; FIT binário
         (bytes 8–11 = «.FIT») é recusado com RUN_MSG.fit. Recusa: > maxFileBytes, texto com <!DOCTYPE ou <!ENTITY (antes de
         parsear), parsererror, só rte/wpt/Courses, sem horas, sem posições, ciclismo (TCX Biking), > maxFilePoints, duração >
         24 h, início antes de 2000 ou no futuro (> agora + futureSlackMs). Datas sem fuso lêem-se como UTC (com aviso).
         Ciclismo: TCX com Sport Biking; GPX só se o ficheiro o diz em <trk><type> (bike/biking/cycling); sem tipo aceita-se.
         Pontos com hora repetida/a recuar, sem hora, fora de intervalo ou em (0,0) são descartados (com aviso, só números).
         Um ponto (ou série curta, até orderWindow) com HORA ADIANTADA sai SÓ ele, sem apagar os que vêm depois; segmentos fora de ordem
         ordenam-se pela hora do ponto do meio; se > 2 % saem por hora, avisa «horas fora de ordem: pode estar incompleta». Pontos com
         posição absurda saem como em runStats (aviso «posição impossível», só números).
     runParseTime(str) → {ms, naive} | null    ISO 8601 (Z, ±hh:mm, ±hhmm, ±hh, ou sem fuso → naive:true, tratado como UTC).

   Linhas da tabela runs
     runNormalizeRow(row) → obj | null      linha de runs (colunas snake_case) → {id, studentId, startedAtMs, startedAt, source,
         distM, durationS, movingS, gaps, gapS, hiddenS, splitsS[], rpe|null, notes, consentV|null, createdBy, paceSPerKm|null}
         com tipos e tetos; null se faltar id ou data válida. runNormalizeRows(arr) → array (ignora as inválidas).
     runBuildInsert(run, nowMs) → row | null   run = {id(uuid), studentId, source, startedAtMs, durationS, movingS, distM, gaps,
         gapS, hiddenS, splitsS, rpe, notes, consentV} (os nomes de runStats + as escolhas do aluno; consentV = versão do aviso aceite, que
         TEM de existir em run_consents: chave estrangeira). row tem EXATAMENTE as colunas
         id, student_id, started_at, source, duration_s, moving_s, distance_m, gaps, gap_s, hidden_s, splits_s, rpe, notes,
         consent_v (created_by e created_at ficam ao servidor: auth.uid() e now()). Valores arredondados e limitados aos CHECK;
         null se não houver forma de cumprir (ex.: duração 0, ritmo impossível, data inválida, sem consentimento, uuid mau).
     runCheckRun(run, nowMs) → {ok:true} | {ok:false, error, code}   a mesma validação, com a razão em PT-PT para o ecrã.
     runDupCheck(existingRuns, candidate) → corrida parecida | null   mesma hora ±60 s e distância ±2 % (aceita linhas
         normalizadas {startedAtMs,distM} ou de BD {started_at,distance_m}). Só avisa; quem chama decide.
     runUuid() → string uuid v4 (crypto.getRandomValues quando existe; senão Math.random: serve só como identificador).

   Formatação PT-PT e entradas do registo à mão
     runPaceOf(distM, movingS) → s/km | null      runPaceStr(sPorKm) → «5:30» (ou «–»)
     runDurStr(s) → «42:10» | «1:02:10»            runDistStr(m) → «5,23 km»
     runParseKm(str) → metros inteiros | NaN       aceita «5,23», «5.23», «5,23 km» (até 3 decimais, 0 < km <= 300)
   runParseQuick(texto, nowMs) → {ok:true, distM, durS, date, time} | {ok:false, error}   o registo à mão numa só linha («5,2 km 28:30», «ontem 18:30 5,23 km 27:58»)
     runParseDuration(str) → segundos | NaN        aceita «mm:ss» e «h:mm:ss»

   Desenho
     runTrackSvg(segments, opts) → string SVG | ""   opts {width:320, height:200, pad:14, scale:true, ariaLabel}. Projeção
         equiretangular local (x = (lon-lon0)·cos(lat0), y = lat); sem mapa de fundo; uma polilinha por segmento, linha
         tracejada a ligar segmentos separados, ponto cheio = partida, círculo = chegada, barra de escala. role="img" e
         aria-label PT-PT. Aceita {lat,lon} ou [lat,lon,...]. "" se houver < 2 pontos válidos ou todos iguais. Nenhum texto
         vindo dos dados entra no SVG (só números, validados como finitos, e o texto da escala).

   ---------------------------------------------------------------------------------------------------------------------
   O que está verificado e o que NÃO está
   ---------------------------------------------------------------------------------------------------------------------
   Verificado (tests/corrida-core.test.js e tests/corrida-import-browser.test.js), SÓ com dados sintéticos e Chromium:
     a aritmética (haversine, âncora, parciais, aparo, simplificação, limites do SQL), o reducer com séries sintéticas, a
     leitura de GPX/TCX normais e hostis no Chromium (não nos outros motores) e o desempenho do DOMParser nesta máquina.
   NÃO verificado: qualquer valor de RUN_CFG com GPS real (são HIPÓTESES do desenho, a calibrar com um percurso de distância
     conhecida e com ficheiros reais, fase F2); a conversão de coords.accuracy; o DOMParser em WebKit/Firefox/iPhone (segurança e
     velocidade); ficheiros reais de relógios; se o erro de distância fica dentro de 2 % (meta de desenho, não facto).
   Limites conhecidos (medidos em séries sintéticas, não com GPS real): a distância importada de um GPS de telemóvel com muito ruído
     (minStepImportM = 8 m) sobrestima de uns % a dezenas de % — por isso existe declaredDistM; uma série de >= spikeK pontos absurdos
     seguidos conta como trecho novo e não como ruído; saltos < spikeMinM não se limpam; o aparo com folga aleatória e a partida
     partilhada em várias corridas continuam a permitir deduzir a zona (ver runPrepareTrack).
   ===================================================================================================================== */

var RUN_CFG = {
  // ---- HIPÓTESES de desenho (nenhuma foi medida com GPS real; calibrar na fase F2) ----
  accMaxM: 30,            // precisão máxima aceite (m); rejeita fixes piores
  gapS: 15,               // ao vivo: sem fix bom há mais de N s = lacuna
  minStepLiveM: 15,       // ao vivo: um ponto só conta se estiver a >= N m da âncora
  minStepImportM: 8,      // importação: idem
  vMaxMs: 12,             // velocidade implícita máxima desde a âncora (m/s); acima disto é salto e o ponto é ignorado.
                          // Só visto em séries SINTÉTICAS: com ruído branco de 3–5 m a 1 Hz este teste, medido desde a âncora (dt curto),
                          // chega a rejeitar fixes legítimos (σ 5 m: ~5 % dos fixes e distância +28 %). GPS real não medido: rever na F2.
  vMoveMin: 0.5,          // velocidade mínima (m/s) para o intervalo contar como tempo em movimento
  importGapS: 60,         // importação: intervalo > N s entre pontos seguidos do mesmo segmento = lacuna (nunca menos de 3× o intervalo
                          // típico do ficheiro: um registo a 61 s por ponto não é «tudo lacunas»)
  importJoinS: 10,        // importação: dois segmentos seguidos (Track/trkseg) a menos de N s e com velocidade possível ligam-se (laps)
  spikeMinM: 30,          // pontos soltos: um salto só conta se passar de N m (abaixo disso é ruído, não se mexe)
  spikeMaxS: 30,          // pontos soltos: um trecho com menos de N s entre dois saltos é «curto» e sai se houver um trecho maior
  spikeK: 3,              // pontos soltos: N pontos seguidos, coerentes entre si e incoerentes com o resto, abrem um trecho novo
  orderWindow: 50,        // importação: quantos pontos à frente se olha para apanhar uma hora adiantada (ponto isolado ou série curta)
  timeBackS: 5,           // ao vivo: um fix que recua mais de N s em relação ao fix que abriu o segmento desfaz esse fix (hora adiantada)
  trimM: 200,             // privacidade: metros aparados à partida e à chegada (por omissão, e valor usado se trimM for inválido)
  trimChoices: [0, 100, 200, 500, 1000, 2000],   // valores aceites para trimM; qualquer outro (NaN, texto, negativo) cai em trimM
  trimSlack: 0.5,         // aparo: raio efetivo = trimM × (1 + trimSlack × rnd), com rnd ∈ [0,1) dado por quem chama
  simplifyEps: [4, 8, 15], // Douglas-Peucker: eps (m) por ordem; depois dobra até caber
  maxTrackPoints: 3000,   // pontos do percurso guardado (todos os segmentos)
  maxFilePoints: 60000,   // pontos lidos de um ficheiro
  maxFileBytes: 15 * 1024 * 1024,
  futureSlackMs: 24 * 3600 * 1000,   // um início até 24 h no futuro ainda passa (fusos e relógios desacertados)
  // ---- espelho do SQL (supabase/migrations/0032_corrida.sql): factos, não hipóteses ----
  maxDurationS: 86400,    // runs.duration_s / moving_s / gap_s / hidden_s <= 86400
  maxDistM: 300000,       // runs.distance_m <= 300000
  maxGaps: 1000,          // runs.gaps <= 1000
  maxSplits: 300,         // jsonb_array_length(splits_s) <= 300
  maxNotes: 300,          // char_length(notes) <= 300
  maxAvgSpeedMs: 12,      // distance_m / duration_s <= 12
  maxSegments: 200,       // jsonb_array_length(run_tracks.points) <= 200
  maxTrackBytes: 200000,  // octet_length(run_tracks.points::text) <= 200000
  maxTrimM: 2000,         // run_tracks.trim_m <= 2000
  minStartedAtMs: 946684800000   // 2000-01-01T00:00:00Z (CHECK de runs.started_at)
};
var RUN_SOURCES = ["live", "gpx", "tcx", "fit", "manual", "native"];
var RUN_EARTH_R = 6371008.8;   // raio médio da Terra (m), IUGG

var RUN_MSG = {
  unreadable: "Não consegui ler este ficheiro. Usa um GPX ou um TCX exportado da app do teu relógio ou de corrida.",
  toobig: "Este ficheiro é demasiado grande (máximo 15 MB).",
  fit: "Ficheiros FIT ainda não são suportados. Exporta em GPX ou TCX.",
  notime: "Este ficheiro não tem horas, por isso não dá para calcular o ritmo. Podes registar a corrida à mão.",
  route: "É um percurso planeado, não uma corrida gravada.",
  doctype: "Por segurança, não aceitamos este tipo de ficheiro XML.",
  bike: "Este ficheiro parece ciclismo; a Corrida só guarda corridas e caminhadas.",
  naive: "O ficheiro não tinha fuso horário: assumimos hora UTC.",
  multi: "O ficheiro tem várias atividades: importámos só a primeira.",
  empty: "Este ficheiro não tem nenhum percurso gravado. Se foi um treino interior, podes registar a corrida à mão.",
  points: "Este ficheiro tem pontos a mais (máximo 60 000).",
  long: "Esta corrida dura mais de 24 horas e não pode ser importada.",
  date: "A data desta corrida não é válida (antes de 2000 ou no futuro).",
  short: "Este ficheiro tem pontos a menos para calcular uma corrida.",
  order: "O ficheiro tem horas fora de ordem: a corrida pode estar incompleta.",
  noparser: "Este navegador não consegue ler ficheiros GPX ou TCX."
};

/* ---------- auxiliares internos ---------- */
function runCfg(cfg){
  if (!cfg || cfg === RUN_CFG) return RUN_CFG;
  var o = {}, k;
  for (k in RUN_CFG) if (Object.prototype.hasOwnProperty.call(RUN_CFG, k)) o[k] = RUN_CFG[k];
  for (k in cfg) if (Object.prototype.hasOwnProperty.call(cfg, k) && cfg[k] !== undefined) o[k] = cfg[k];
  return o;
}
function runIFin(v){ return typeof v === "number" && isFinite(v); }
// número a partir de número ou de texto numérico (como finiteNum de app.js); null se não for
function runINum(v){
  var n = typeof v === "number" ? v : (typeof v === "string" && v.replace(/\s+/g, "") !== "" ? Number(v) : NaN);
  return isFinite(n) ? n : null;
}
// inteiro arredondado e limitado a [lo, hi]; dflt se não for número
function runIInt(v, lo, hi, dflt){
  var n = runINum(v);
  if (n == null) return dflt;
  n = Math.round(n);
  return n < lo ? lo : n > hi ? hi : n;
}
function runIPad2(n){ return (n < 10 ? "0" : "") + n; }
function runILat(p){ return p.lat !== undefined ? p.lat : p[0]; }
function runILon(p){ return p.lon !== undefined ? p.lon : p[1]; }
function runIValidPt(p){
  if (!p) return false;
  var la = runILat(p), lo = runILon(p);
  return runIFin(la) && runIFin(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}
function runIEsc(s){
  return String(s).replace(/[&<>"']/g, function(c){ return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"; });
}
// texto curto e seguro para a BD: sem NUL/controlos (o Postgres recusa NUL), sem meios pares substitutos em NENHUMA posição
// (um \uD83D solto vira \ud83d no JSON e o Postgres recusa-o), sem meio par no corte por tamanho
function runIStr(v, max){
  if (typeof v !== "string") return "";
  var s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, function(m){ return m.length === 2 ? m : ""; }).replace(/^\s+|\s+$/g, "");
  if (s.length > max) {
    s = s.slice(0, max);
    var c = s.charCodeAt(s.length - 1);
    if (c >= 0xD800 && c <= 0xDBFF) s = s.slice(0, -1);
    s = s.replace(/\s+$/g, "");
  }
  return s;
}

/* ---------- distância ---------- */
// Haversine em metros entre (lat1,lon1) e (lat2,lon2), em graus.
function runHav(lat1, lon1, lat2, lon2){
  var k = Math.PI / 180, dp = (lat2 - lat1) * k, dl = (lon2 - lon1) * k;
  var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(lat1 * k) * Math.cos(lat2 * k) * Math.sin(dl / 2) * Math.sin(dl / 2);
  if (a > 1) a = 1;
  return 2 * RUN_EARTH_R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function runIDist(a, b){ return runHav(runILat(a), runILon(a), runILat(b), runILon(b)); }

/* ---------- acumulador de distância, tempo em movimento e parciais (partilhado pelo reducer e por runStats) ---------- */
function runIAccNew(){ return {distM: 0, movMs: 0, nextKm: 1000, kmMovMs: 0, splitsS: []}; }
// soma o passo da âncora a até ao ponto b (distância d, já calculada)
function runIAccStep(acc, a, b, d, cfg){
  var dtMs = b.t - a.t;
  var mov = (dtMs > 0 && d / (dtMs / 1000) > cfg.vMoveMin) ? dtMs : 0;
  var d0 = acc.distM, m0 = acc.movMs, d1 = d0 + d;
  while (d1 >= acc.nextKm && acc.splitsS.length < 1000) {
    var f = d > 0 ? (acc.nextKm - d0) / d : 1;
    var mk = m0 + f * mov;   // instante (em tempo de movimento) em que se cruza o km: interpolação linear no passo
    acc.splitsS.push(Math.round((mk - acc.kmMovMs) / 1000));
    acc.kmMovMs = mk;
    acc.nextKm += 1000;
  }
  acc.distM = d1;
  acc.movMs = m0 + mov;
}

/* ---------- registo ao vivo ---------- */
function runFeedInit(){
  return {
    v: 1, segs: [], open: false, paused: false, pauseAt: null, pausedMs: 0, brk: null, sus: null,
    maxT: null, lastGoodT: null, startedAtMs: null, nPts: 0, nFix: 0,
    distM: 0, movMs: 0, nextKm: 1000, kmMovMs: 0, splitsS: [], gaps: 0, gapMs: 0,
    rej: {invalid: 0, time: 0, acc: 0, jump: 0}
  };
}
// desfaz o fix que abriu o último segmento (ver «sus» em runFeed): devolve o state ao que era antes dele
function runIUndoOpen(state, sus){
  state.segs.pop();
  state.nPts = sus.nPts; state.gaps = sus.gaps; state.gapMs = sus.gapMs; state.open = sus.open; state.brk = sus.brk;
  state.lastGoodT = sus.lastGoodT; state.maxT = sus.maxT; state.startedAtMs = sus.startedAtMs;
  state.rej.time++;
}
function runFeed(state, fix, cfg){
  cfg = runCfg(cfg);
  var res = {reason: "ok", added: false, good: false, gap: false};
  state.nFix++;
  if (!fix || !runIFin(fix.lat) || !runIFin(fix.lon) || !runIFin(fix.t) || fix.t <= 0 || fix.lat < -90 || fix.lat > 90 || fix.lon < -180 || fix.lon > 180) {
    state.rej.invalid++; res.reason = "invalid"; return res;
  }
  if (state.paused) { res.reason = "paused"; return res; }
  var sus = state.sus;   // fica até haver outro fix ACEITE (um fix recusado por precisão não o esquece)
  if (state.maxT != null && fix.t <= state.maxT) {
    // maxT só avança com fixes ACEITES. Se o fix que abriu o segmento trazia uma hora adiantada (relógio errado) e este, com sinal
    // utilizável, recua mais de timeBackS em relação a ele mas cabe no tempo anterior, desfaz-se o fix adiantado em vez de rejeitar
    // tudo o que vem a seguir «até o relógio o apanhar».
    var back = sus && state.segs.length && state.segs[state.segs.length - 1].length === 1 && state.maxT - fix.t > cfg.timeBackS * 1000 &&
      (sus.maxT == null || fix.t > sus.maxT) && runIFin(fix.acc) && fix.acc >= 0 && fix.acc <= cfg.accMaxM;
    if (back) { runIUndoOpen(state, sus); state.sus = null; }
    else { state.rej.time++; res.reason = "time"; return res; }
  }
  if (!runIFin(fix.acc) || fix.acc < 0 || fix.acc > cfg.accMaxM) { state.rej.acc++; res.reason = "acc"; return res; }
  var pre = {open: state.open, brk: state.brk, lastGoodT: state.lastGoodT, maxT: state.maxT, startedAtMs: state.startedAtMs, gaps: state.gaps, gapMs: state.gapMs, nPts: state.nPts};
  // lacuna: sem fix bom há mais de gapS segundos (não se aplica logo a seguir a uma pausa: aí o segmento já está fechado)
  if (state.open && state.lastGoodT != null && (fix.t - state.lastGoodT) / 1000 > cfg.gapS) { state.open = false; state.brk = "gap"; }
  var pt = {lat: fix.lat, lon: fix.lon, t: fix.t, acc: Math.round(fix.acc * 10) / 10};
  if (!state.open) {
    if (state.segs.length) {
      if (state.brk === "pause") pt.b = "pause";
      else {
        pt.b = "gap";
        pt.g = Math.round((fix.t - state.lastGoodT) / 100) / 10;   // segundos sem posições, 1 casa
        state.gaps++;
        state.gapMs += pt.g * 1000;
        res.gap = true;
      }
    }
    state.segs.push([pt]);
    state.open = true; state.brk = null; state.lastGoodT = fix.t; state.maxT = fix.t; state.nPts++;
    if (state.startedAtMs == null) state.startedAtMs = fix.t;
    state.sus = pre;
    res.added = true; res.good = true;
    return res;
  }
  var seg = state.segs[state.segs.length - 1], anchor = seg[seg.length - 1];
  var d = runHav(anchor.lat, anchor.lon, fix.lat, fix.lon), dtS = (fix.t - anchor.t) / 1000;
  if (d / dtS > cfg.vMaxMs) { state.rej.jump++; res.reason = "jump"; return res; }
  state.lastGoodT = fix.t; state.maxT = fix.t; state.sus = null; res.good = true;
  if (d < cfg.minStepLiveM) { res.reason = "near"; return res; }
  seg.push(pt); state.nPts++;
  runIAccStep(state, anchor, pt, d, cfg);
  res.added = true;
  return res;
}
function runPause(state, tMs){
  if (state.paused) return state;
  state.paused = true;
  state.pauseAt = runIFin(tMs) ? tMs : null;
  state.open = false; state.brk = "pause"; state.sus = null;
  return state;
}
function runResume(state, tMs){
  if (!state.paused) return state;
  state.paused = false;
  if (state.startedAtMs != null && runIFin(tMs) && runIFin(state.pauseAt)) state.pausedMs += Math.max(0, tMs - Math.max(state.pauseAt, state.startedAtMs));
  state.pauseAt = null;
  return state;
}
function runFeedRestore(saved, cfg){
  cfg = runCfg(cfg);
  if (!saved || typeof saved !== "object" || !Array.isArray(saved.segs)) return null;
  var st = runFeedInit(), segs = [], lastT = -Infinity, i, j;
  for (i = 0; i < saved.segs.length; i++) {
    var src = saved.segs[i], out = [];
    if (!Array.isArray(src)) continue;
    for (j = 0; j < src.length; j++) {
      var p = src[j];
      if (!p || !runIValidPt(p) || !runIFin(p.t) || p.t <= 0 || !(p.t > lastT)) continue;
      lastT = p.t;
      var q = {lat: p.lat, lon: p.lon, t: p.t, acc: runIFin(p.acc) ? p.acc : null};
      if (!out.length && segs.length) {
        if (p.b === "pause") q.b = "pause";
        else { q.b = "gap"; if (runIFin(p.g) && p.g >= 0) q.g = p.g; }
      }
      out.push(q);
    }
    if (out.length) segs.push(out);
  }
  st.segs = segs;
  st.paused = saved.paused === true;
  st.pauseAt = st.paused && runIFin(saved.pauseAt) ? saved.pauseAt : null;
  st.pausedMs = runIFin(saved.pausedMs) && saved.pausedMs >= 0 ? saved.pausedMs : 0;
  if (saved.rej && typeof saved.rej === "object") {
    var keys = ["invalid", "time", "acc", "jump"];
    for (i = 0; i < keys.length; i++) if (runIFin(saved.rej[keys[i]]) && saved.rej[keys[i]] >= 0) st.rej[keys[i]] = Math.floor(saved.rej[keys[i]]);
  }
  if (segs.length) {
    var rp = runIReplay(segs, cfg, true), last = segs[segs.length - 1];
    st.distM = rp.acc.distM; st.movMs = rp.acc.movMs; st.nextKm = rp.acc.nextKm; st.kmMovMs = rp.acc.kmMovMs; st.splitsS = rp.acc.splitsS;
    st.gaps = rp.gaps; st.gapMs = rp.gapMs; st.nPts = rp.nPts;
    st.startedAtMs = segs[0][0].t;
    st.lastGoodT = last[last.length - 1].t;
    st.maxT = runIFin(saved.maxT) && saved.maxT > st.lastGoodT ? saved.maxT : st.lastGoodT;
  }
  st.open = false;
  st.brk = st.paused ? "pause" : "gap";
  return st;
}
function runLiveView(state, nowMs){
  var el = 0, dist = Math.round(state.distM), mov = Math.round(state.movMs / 1000);
  if (state.startedAtMs != null && runIFin(nowMs)) {
    var pausedNow = state.paused && runIFin(state.pauseAt) ? Math.max(0, nowMs - state.pauseAt) : 0;
    el = Math.max(0, (nowMs - state.startedAtMs - state.pausedMs - pausedNow) / 1000);
  }
  return {
    distM: dist, movingS: mov, elapsedS: Math.round(el), paceSPerKm: runPaceOf(dist, mov),
    gaps: state.gaps, gapS: Math.round(state.gapMs / 1000), splitsS: state.splitsS.slice(), points: state.nPts, paused: state.paused,
    sinceGoodS: state.lastGoodT != null && runIFin(nowMs) ? Math.max(0, Math.round((nowMs - state.lastGoodT) / 1000)) : null,
    rej: {invalid: state.rej.invalid, time: state.rej.time, acc: state.rej.acc, jump: state.rej.jump}
  };
}
function runReasonText(reason){
  return reason === "acc" ? "Sinal fraco" : reason === "jump" ? "Posição ignorada (salto)" : reason === "time" ? "Posição repetida" :
    reason === "invalid" ? "Posição inválida" : reason === "paused" ? "Em pausa" : "";
}

/* ---------- pontos soltos (saltos de posição) ---------- */
// Um passo a→b é coerente se a velocidade implícita não passa vMaxMs (ou se o salto é curto: isso é ruído, não se mexe).
function runIStepOk(a, b, cfg){
  var d = runHav(a.lat, a.lon, b.lat, b.lon);
  return d <= cfg.spikeMinM || d <= cfg.vMaxMs * (b.t - a.t) / 1000;
}
function runIJudgeable(p){ return !!p && p.lat !== undefined && runIValidPt(p) && runIFin(p.t); }
function runISpan(seg){
  var lo = Infinity, hi = -Infinity, i;
  for (i = 0; i < seg.length; i++) if (seg[i] && runIFin(seg[i].t)) { if (seg[i].t < lo) lo = seg[i].t; if (seg[i].t > hi) hi = seg[i].t; }
  return hi >= lo ? hi - lo : 0;
}
function runIEnd(seg, atEnd){
  var i;
  if (atEnd) { for (i = seg.length - 1; i >= 0; i--) if (runIJudgeable(seg[i])) return seg[i]; }
  else for (i = 0; i < seg.length; i++) if (runIJudgeable(seg[i])) return seg[i];
  return null;
}
// Limpa UM segmento: um ponto (ou até spikeK-1 seguidos) incoerente com o resto sai; spikeK ou mais pontos seguidos, coerentes entre si
// e incoerentes com o que vinha atrás, abrem um trecho novo (o intervalo não soma distância). Os pontos que não se podem avaliar
// (sem hora, hora que não cresce) passam sem mexer: quem usa trata deles (runStats conta-os em skipped).
function runICleanSeg(seg, cfg){
  var chains = [], cur = [], pend = [], last = null, dropped = 0, i, p, pl;
  for (i = 0; i < seg.length; i++) {
    p = seg[i];
    if (!runIJudgeable(p) || (last && !(p.t > last.t))) { cur.push(p); continue; }
    if (!last || runIStepOk(last, p, cfg)) { dropped += pend.length; pend = []; cur.push(p); last = p; continue; }
    pl = pend.length ? pend[pend.length - 1] : null;
    if (pl && p.t > pl.t && runIStepOk(pl, p, cfg)) pend.push(p);
    else { dropped += pend.length; pend = [p]; }
    if (pend.length >= cfg.spikeK) { chains.push(cur); cur = pend; pend = []; last = cur[cur.length - 1]; }
  }
  dropped += pend.length;   // o que ficou em espera no fim (menos de spikeK pontos) era um ponto solto
  if (cur.length) chains.push(cur);
  if (chains.length > 1) {
    var minMs = cfg.spikeMaxS * 1000, anyLong = false, kept = [];
    for (i = 0; i < chains.length; i++) if (runISpan(chains[i]) >= minMs) anyLong = true;
    for (i = 0; i < chains.length; i++) { if (anyLong && runISpan(chains[i]) < minMs) dropped += chains[i].length; else kept.push(chains[i]); }
    chains = kept;
  }
  return {chains: chains, dropped: dropped};
}
// Limpa todos os segmentos (cópia; não altera a entrada). → {segs, dropped}. Um segmento curto no início ou no fim do percurso, que não
// se liga (pela velocidade possível) ao vizinho, também sai: é o fix antigo/espúrio do arranque ou do fim.
function runIClean(segments, cfg){
  var out = [], dropped = 0, i, j, r, anyLong = false, minMs = cfg.spikeMaxS * 1000;
  for (i = 0; i < segments.length; i++) {
    if (!Array.isArray(segments[i]) || !segments[i].length) continue;
    r = runICleanSeg(segments[i], cfg);
    dropped += r.dropped;
    for (j = 0; j < r.chains.length; j++) if (r.chains[j].length) out.push(r.chains[j]);
  }
  for (i = 0; i < out.length; i++) if (runISpan(out[i]) >= minMs) anyLong = true;
  function loose(a, b){ var x = runIEnd(a, true), y = runIEnd(b, false); return !!x && !!y && y.t > x.t && !runIStepOk(x, y, cfg); }
  while (anyLong && out.length > 1 && runISpan(out[0]) < minMs && loose(out[0], out[1])) { dropped += out[0].length; out.shift(); }
  while (anyLong && out.length > 1 && runISpan(out[out.length - 1]) < minMs && loose(out[out.length - 2], out[out.length - 1])) { dropped += out[out.length - 1].length; out.pop(); }
  return {segs: out, dropped: dropped};
}

/* ---------- resultado final (qualquer fonte) ---------- */
// mediana dos intervalos (ms) entre pontos seguidos com hora a crescer; 0 se não houver
function runIMedDt(seg){
  var d = [], a = null, i, p;
  for (i = 0; i < seg.length; i++) {
    p = seg[i];
    if (!p || !runIFin(p.t)) continue;
    if (a && p.t > a.t) d.push(p.t - a.t);
    a = p;
  }
  if (!d.length) return 0;
  d.sort(function(x, y){ return x - y; });
  return d[d.length >> 1];
}
// Repete, sobre segmentos já feitos, as mesmas contas do reducer (em live dá o mesmo que o acumulado durante o registo).
// Em importação limpa primeiro os pontos soltos (runIClean: um ponto inicial/final/do meio com posição absurda sai SÓ ele) e liga
// segmentos seguidos a menos de importJoinS (um Lap/Track por km não perde um passo em cada fronteira).
function runIReplay(segments, cfg, live){
  var minStep = live ? cfg.minStepLiveM : cfg.minStepImportM;
  var r = {acc: runIAccNew(), gaps: 0, gapMs: 0, durMs: 0, skipped: 0, nPts: 0, first: null, last: null};
  var prevSegLast = null, prevAnchor = null, s, i;
  if (!live) { var cl = runIClean(segments, cfg); segments = cl.segs; r.skipped += cl.dropped; }
  for (s = 0; s < segments.length; s++) {
    var seg = segments[s];
    if (!seg || !seg.length) continue;
    var anchor = null, prev = null, segStart = 0, gapLimitMs = live ? 0 : Math.max(cfg.importGapS * 1000, 3 * runIMedDt(seg));
    for (i = 0; i < seg.length; i++) {
      var p = seg[i];
      if (!p || !runIFin(p.lat) || !runIFin(p.lon) || !runIFin(p.t)) { r.skipped++; continue; }
      r.nPts++;
      if (!anchor) {
        if (!r.first) r.first = p;
        if (!live && prevSegLast && prevAnchor && p.t > prevSegLast.t && p.t - prevSegLast.t <= cfg.importJoinS * 1000 &&
            runHav(prevSegLast.lat, prevSegLast.lon, p.lat, p.lon) <= cfg.vMaxMs * (p.t - prevSegLast.t) / 1000) {
          // fronteira de Lap/Track sem pausa de verdade: continua a mesma âncora e o intervalo conta no tempo
          r.durMs += p.t - prevSegLast.t;
          anchor = prevAnchor; prev = prevSegLast; segStart = p.t;
        } else {
          anchor = p; prev = p; segStart = p.t;
          if (prevSegLast && live && p.b !== "pause") {
            // lacuna entre segmentos (só ao vivo): conta no tempo total e nas lacunas; NÃO soma distância
            r.gaps++;
            r.gapMs += runIFin(p.g) && p.g >= 0 ? p.g * 1000 : Math.max(0, p.t - prevSegLast.t);
            r.durMs += Math.max(0, p.t - prevSegLast.t);
          }
          continue;
        }
      }
      if (!(p.t > prev.t)) { r.skipped++; continue; }   // tempo não crescente
      if (!live && p.t - prev.t > gapLimitMs) {
        r.gaps++; r.gapMs += p.t - prev.t;
        anchor = p; prev = p;
        continue;
      }
      var d = runHav(anchor.lat, anchor.lon, p.lat, p.lon), v = d / ((p.t - anchor.t) / 1000);
      prev = p;
      if (v > cfg.vMaxMs) { r.skipped++; continue; }
      if (d < minStep) continue;
      runIAccStep(r.acc, anchor, p, d, cfg);
      anchor = p;
    }
    if (anchor) {
      r.durMs += prev.t - segStart;
      prevSegLast = prev; prevAnchor = anchor; r.last = prev;
    }
  }
  return r;
}
function runStats(segments, cfg, mode){
  cfg = runCfg(cfg);
  var live = mode === "live" || mode === "native";
  var r = runIReplay(Array.isArray(segments) ? segments : [], cfg, live);
  var durationS = Math.round(r.durMs / 1000);
  return {
    distM: Math.round(r.acc.distM), durationS: durationS, movingS: Math.min(durationS, Math.round(r.acc.movMs / 1000)),
    gaps: r.gaps, gapS: Math.round(r.gapMs / 1000), splitsS: r.acc.splitsS.slice(0, cfg.maxSplits),
    startedAtMs: r.first ? r.first.t : null, endedAtMs: r.last ? r.last.t : null, points: r.nPts, skipped: r.skipped
  };
}
// «Terminar no último ponto bom»: tira o fim do percurso a partir da ÚLTIMA lacuna ao vivo de pelo menos minGapS segundos (b:"gap",
// g >= minGapS). Serve quando o aluno se esquece de terminar e a corrida «acorda» horas depois com um ponto parado em casa: a lacuna e o
// que vem depois somavam-se ao tempo (e acima de 24 h a corrida ficava inguardável). Não decide nada sozinha: quem chama escolhe
// quando a oferece. Devolve uma CÓPIA; sem essa lacuna devolve tudo e cutS = 0. cutS = segundos entre o último ponto mantido e o último
// ponto do percurso inteiro.
function runCutAtLastGap(segments, minGapS){
  var segs = Array.isArray(segments) ? segments : [], min = runIFin(minGapS) && minGapS >= 0 ? minGapS : Infinity, cut = -1, i, j, pts = 0;
  for (i = segs.length - 1; i >= 1; i--) {
    var f = Array.isArray(segs[i]) && segs[i].length ? segs[i][0] : null;
    if (f && f.b === "gap" && runIFin(f.g) && f.g >= min) { cut = i; break; }
  }
  var all = [];
  for (i = 0; i < segs.length; i++) all.push(Array.isArray(segs[i]) ? segs[i].slice() : []);
  if (cut < 0) return {segments: all, cutS: 0, cutPoints: 0};
  for (j = cut; j < all.length; j++) pts += all[j].length;
  var keepEnd = runIEnd(all[cut - 1], true), lastP = runIEnd(all[all.length - 1], true);
  return {segments: all.slice(0, cut), cutS: keepEnd && lastP ? Math.max(0, Math.round((lastP.t - keepEnd.t) / 1000)) : 0, cutPoints: pts};
}
function runManualStats(startedAtMs, distM, durationS){
  var d = Math.round(distM), t = Math.round(durationS);
  return {
    distM: d, durationS: t, movingS: t, gaps: 0, gapS: 0, splitsS: [],
    startedAtMs: startedAtMs, endedAtMs: runIFin(startedAtMs) ? startedAtMs + t * 1000 : null, points: 0, skipped: 0
  };
}

/* ---------- privacidade do percurso ---------- */
function runITrackEnds(segments){
  var first = null, last = null, i, seg;
  for (i = 0; i < segments.length && !first; i++) { seg = segments[i]; if (seg && seg.length) first = seg[0]; }
  for (i = segments.length - 1; i >= 0 && !last; i--) { seg = segments[i]; if (seg && seg.length) last = seg[seg.length - 1]; }
  return {first: first, last: last};
}
function runTrim(segments, R){
  var out = [], i, j;
  if (!Array.isArray(segments)) return out;
  R = +R;
  var ends = runITrackEnds(segments);
  if (!ends.first || !runIValidPt(ends.first) || !runIValidPt(ends.last)) R = 0;
  var f = ends.first, l = ends.last;
  for (i = 0; i < segments.length; i++) {
    var seg = segments[i], cur = [];
    if (!seg) continue;
    for (j = 0; j < seg.length; j++) {
      var p = seg[j];
      if (R > 0 && runIValidPt(p) && (runIDist(p, f) < R || runIDist(p, l) < R)) {
        if (cur.length) { out.push(cur); cur = []; }
      } else cur.push(p);
    }
    if (cur.length) out.push(cur);
  }
  return out;
}
// distância (m) de (px,py) ao segmento (ax,ay)-(bx,by), em coordenadas planas
function runIPtSeg(px, py, ax, ay, bx, by){
  var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = 0;
  if (l2 > 0) { t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; }
  var ex = ax + t * dx - px, ey = ay + t * dy - py;
  return Math.sqrt(ex * ex + ey * ey);
}
function runSimplify(points, eps){
  var n = points ? points.length : 0, i;
  if (n < 3 || !(eps > 0)) return n ? points.slice() : [];
  var mPerDeg = Math.PI / 180 * RUN_EARTH_R, sumLat = 0;
  for (i = 0; i < n; i++) sumLat += runILat(points[i]);
  var c = Math.cos(sumLat / n * Math.PI / 180), xs = new Array(n), ys = new Array(n);
  for (i = 0; i < n; i++) { xs[i] = runILon(points[i]) * c * mPerDeg; ys[i] = runILat(points[i]) * mPerDeg; }
  var keep = new Array(n), stack = [0, n - 1], ops = 0, budget = 200 * n + 2000000, out = [];
  for (i = 0; i < n; i++) keep[i] = false;
  keep[0] = true; keep[n - 1] = true;
  while (stack.length) {
    var hi = stack.pop(), lo = stack.pop(), dmax = -1, idx = -1;
    ops += hi - lo;
    // O Douglas-Peucker pode chegar a O(n²) em dados patológicos (ex.: dentes de serra de km com 60 000 pontos: ~7 s em Node):
    // passado este orçamento troca-se por uma passagem radial O(n) que mantém a mesma garantia (nenhum original a mais de eps).
    if (ops > budget) {
      var lk = 0;
      for (i = 0; i < n; i++) keep[i] = false;
      keep[0] = true; keep[n - 1] = true;
      for (i = 1; i < n - 1; i++) {
        var dx = xs[i] - xs[lk], dy = ys[i] - ys[lk];
        if (Math.sqrt(dx * dx + dy * dy) > eps) { keep[i] = true; lk = i; }
      }
      break;
    }
    for (i = lo + 1; i < hi; i++) {
      var d = runIPtSeg(xs[i], ys[i], xs[lo], ys[lo], xs[hi], ys[hi]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (idx >= 0 && dmax > eps) { keep[idx] = true; stack.push(lo, idx, idx, hi); }
  }
  for (i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}
// tamanho do texto jsonb equivalente a segs (o jsonb escreve «, » entre elementos)
function runTrackBytes(segs){
  var n = 2, i, j;
  for (i = 0; i < segs.length; i++) {
    if (i) n += 2;
    n += 2;
    for (j = 0; j < segs[i].length; j++) {
      var p = segs[i][j];
      if (j) n += 2;
      n += 6 + String(p[0]).length + String(p[1]).length + String(p[2]).length;
    }
  }
  return n;
}
function runICount(segs){ var n = 0, i; for (i = 0; i < segs.length; i++) n += segs[i].length; return n; }
// junta segmentos vizinhos, começando pelos mais próximos, até sobrarem no máximo maxSegs
function runIMerge(segs, maxSegs){
  if (segs.length <= maxSegs) return segs;
  var gaps = [], i, j;
  for (i = 0; i + 1 < segs.length; i++) gaps.push({i: i, d: runIDist(segs[i][segs[i].length - 1], segs[i + 1][0])});
  gaps.sort(function(a, b){ return a.d - b.d || a.i - b.i; });
  var need = segs.length - maxSegs, join = {};
  for (i = 0; i < need; i++) join[gaps[i].i] = true;
  var out = [];
  for (i = 0; i < segs.length; i++) {
    if (i > 0 && join[i - 1]) { var tail = out[out.length - 1]; for (j = 0; j < segs[i].length; j++) tail.push(segs[i][j]); }
    else out.push(segs[i].slice());
  }
  return out;
}
// arredonda a 5 casas, t em segundos inteiros desde t0, tira duplicados seguidos e segmentos com < 2 pontos
function runIFinalize(segs, t0){
  var out = [], i, j;
  for (i = 0; i < segs.length; i++) {
    var o = [];
    for (j = 0; j < segs[i].length; j++) {
      var p = segs[i][j], la = Math.round(p.lat * 1e5) / 1e5, lo = Math.round(p.lon * 1e5) / 1e5;
      var ts = runIFin(p.t) ? Math.max(0, Math.round((p.t - t0) / 1000)) : 0;
      if (la === 0) la = 0; if (lo === 0) lo = 0;   // tira o -0
      var q = o.length ? o[o.length - 1] : null;
      if (q && q[0] === la && q[1] === lo) continue;
      o.push([la, lo, ts]);
    }
    if (o.length >= 2) out.push(o);
  }
  return out;
}
// último recurso: ficar com 1 em cada k pontos (mantém o 1.º e o último de cada segmento)
function runIDecimate(segs, maxPts){
  var k = 2, out = segs, guard = 0;
  while (runICount(out) > maxPts && guard++ < 60) {
    out = segs.map(function(seg){ return seg.filter(function(p, idx){ return idx === 0 || idx === seg.length - 1 || idx % k === 0; }); });
    k *= 2;
  }
  while (runICount(out) > maxPts && out.length > 1) out = out.slice(0, -1);
  return out;
}
// aparo nominal (o que se guarda em trim_m): trimM tem de ser um dos valores de cfg.trimChoices; NaN, texto, negativo ou outro valor
// NÃO desligam o aparo: cai-se no valor por omissão (falha fechado)
function runITrimNominal(cfg){
  var n = runINum(cfg.trimM), ch = cfg.trimChoices, dflt = RUN_CFG.trimM;
  if (n == null || !Array.isArray(ch) || ch.indexOf(n) < 0 || n < 0 || n > cfg.maxTrimM) return dflt;
  return n;
}
function runPrepareTrack(segments, cfg){
  cfg = runCfg(cfg);
  if (!Array.isArray(segments)) return null;
  var clean = [], i, j, t0 = null;
  for (i = 0; i < segments.length; i++) {
    var seg = segments[i], o = [];
    if (!Array.isArray(seg)) continue;
    for (j = 0; j < seg.length; j++) if (runIValidPt(seg[j]) && seg[j].lat !== undefined) o.push(seg[j]);
    if (o.length) { clean.push(o); if (t0 == null && runIFin(o[0].t)) t0 = o[0].t; }
  }
  if (!clean.length) return null;
  if (t0 == null) t0 = 0;
  // o aparo centra-se no 1.º e no último ponto LIMPOS (sem fixes antigos/espúrios nas pontas) e o raio efetivo leva uma folga aleatória
  clean = runIClean(clean, cfg).segs;
  if (!clean.length) return null;
  var R = runITrimNominal(cfg), rnd = runIFin(cfg.rnd) ? Math.min(0.999999, Math.max(0, cfg.rnd)) : 0;
  var trimmed = runTrim(clean, R * (1 + cfg.trimSlack * rnd));
  if (!trimmed.length) return null;
  var eps = (cfg.simplifyEps && cfg.simplifyEps.length ? cfg.simplifyEps : [4, 8, 15]).filter(function(e){ return e > 0; });
  if (!eps.length) eps = [4];
  while (eps[eps.length - 1] < 2000) eps.push(eps[eps.length - 1] * 2);
  var limitBytes = cfg.maxTrackBytes - 2000, best = null, e;
  for (e = 0; e < eps.length; e++) {
    var simp = [];
    for (i = 0; i < trimmed.length; i++) { var sp = runSimplify(trimmed[i], eps[e]); if (sp.length >= 2) simp.push(sp); }
    var fin = runIFinalize(runIMerge(simp, cfg.maxSegments), t0);
    best = fin;
    if (runICount(fin) <= cfg.maxTrackPoints && runTrackBytes(fin) <= limitBytes) break;
    if (e === eps.length - 1) {
      fin = runIFinalize(runIDecimate(runIMerge(simp, cfg.maxSegments), cfg.maxTrackPoints), t0);
      while (fin.length > 1 && (runICount(fin) > cfg.maxTrackPoints || runTrackBytes(fin) > limitBytes)) fin = fin.slice(0, -1);
      best = fin;
    }
  }
  if (!best || runICount(best) < 2) return null;
  return {segments: best, trimM: R, points: runICount(best)};
}

/* ---------- exportação GPX ---------- */
function runIStartMs(run){
  if (!run) return NaN;
  if (runIFin(run.startedAtMs)) return run.startedAtMs;
  var iso = typeof run.started_at === "string" ? run.started_at : typeof run.startedAt === "string" ? run.startedAt : null;
  var t = iso ? runParseTime(iso) : null;
  return t ? t.ms : NaN;
}
function runIDeg(v){ return String(+v.toFixed(6)); }
function runIIso(ms){ return new Date(ms).toISOString().replace(".000Z", "Z"); }
function runToGpx(run, trackSegments){
  if (!Array.isArray(trackSegments)) return null;
  var base = runIStartMs(run), out = [], n = 0, i, j;
  for (i = 0; i < trackSegments.length; i++) {
    var seg = trackSegments[i], lines = [];
    if (!Array.isArray(seg)) continue;
    for (j = 0; j < seg.length; j++) {
      var p = seg[j];
      if (!runIValidPt(p)) continue;
      var ms = Array.isArray(p) ? (runIFin(p[2]) ? base + p[2] * 1000 : NaN) : (runIFin(p.t) ? p.t : NaN);
      if (!runIFin(ms) || ms < RUN_CFG.minStartedAtMs || ms > 253402300799999) continue;
      lines.push('<trkpt lat="' + runIDeg(runILat(p)) + '" lon="' + runIDeg(runILon(p)) + '"><time>' + runIIso(ms) + "</time></trkpt>");
    }
    if (lines.length) { out.push("<trkseg>\n" + lines.join("\n") + "\n</trkseg>"); n += lines.length; }
  }
  if (!n) return null;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="' + runIEsc("EVOLVE") + '" xmlns="http://www.topografix.com/GPX/1/1">\n<trk>\n' + out.join("\n") + "\n</trk>\n</gpx>\n";
}

/* ---------- leitura de ficheiros ---------- */
function runIFail(code, cfg){
  var msg = RUN_MSG[code] || RUN_MSG.unreadable;
  if (code === "toobig") msg = "Este ficheiro é demasiado grande (máximo " + Math.round(cfg.maxFileBytes / 1048576) + " MB).";
  if (code === "points") msg = "Este ficheiro tem pontos a mais (máximo " + String(cfg.maxFilePoints).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ").";
  return {ok: false, error: msg, code: code};
}
function runIOpts(opts){
  var cfg = runCfg(opts && opts.cfg);
  return {cfg: cfg, nowMs: opts && runIFin(opts.nowMs) ? opts.nowMs : Date.now()};
}
function runParseTime(str){
  var m = /^\s*(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?\s*(Z|z|[+-]\d{2}(?::?\d{2})?)?\s*$/.exec(typeof str === "string" ? str : "");
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  var ms = Date.UTC(y, mo - 1, d, h, mi, s), chk = new Date(ms);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
  if (m[7]) ms += Math.floor(Number("0." + m[7]) * 1000 + 1e-6);
  var z = m[8];
  if (z && z.toUpperCase() !== "Z") {
    var sign = z.charAt(0) === "-" ? -1 : 1, digits = z.slice(1).replace(":", ""), oh = +digits.slice(0, 2), om = digits.length > 2 ? +digits.slice(2, 4) : 0;
    if (oh > 23 || om > 59) return null;
    ms -= sign * (oh * 60 + om) * 60000;
  }
  return {ms: ms, naive: !z};
}
function runIKids(el, name){
  var out = [], c = el.childNodes, n = c.length, i;
  for (i = 0; i < n; i++) { var k = c[i]; if (k.nodeType === 1 && k.localName === name) out.push(k); }
  return out;
}
function runIKid(el, name){
  var c = el.childNodes, n = c.length, i;
  for (i = 0; i < n; i++) { var k = c[i]; if (k.nodeType === 1 && k.localName === name) return k; }
  return null;
}
function runIText(el){ return el ? String(el.textContent || "") : ""; }
function runIDec(s){
  if (s == null) return NaN;
  s = String(s).replace(/^\s+|\s+$/g, "");
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}
function runIIsFitBytes(b){ return b.length >= 12 && b[8] === 0x2E && b[9] === 0x46 && b[10] === 0x49 && b[11] === 0x54; }
function runIIsFitText(s){ return s.slice(0, 16).indexOf(".FIT") >= 0; }
// texto -> documento XML, com todas as guardas por esta ordem: tamanho, FIT, DTD/entidades, parsererror
function runIReadXml(text, cfg){
  if (typeof DOMParser === "undefined") return runIFail("noparser", cfg);
  if (typeof text !== "string") return runIFail("unreadable", cfg);
  if (text.length > cfg.maxFileBytes) return runIFail("toobig", cfg);
  var s = text.replace(/^[﻿\s]+/, "");
  if (!s) return runIFail("unreadable", cfg);
  if (runIIsFitText(s)) return runIFail("fit", cfg);
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) return runIFail("doctype", cfg);
  var doc;
  try { doc = new DOMParser().parseFromString(s, "application/xml"); } catch (e) { return runIFail("unreadable", cfg); }
  var root = doc && doc.documentElement;
  if (!root || root.localName === "parsererror" || doc.getElementsByTagNameNS("*", "parsererror").length) return runIFail("unreadable", cfg);
  return {ok: true, doc: doc, root: root};
}
// pontos crus [[{lat,lon,t(NaN se faltar),naive}]] -> resultado final com todas as validações.
// Ordem: coordenadas e hora válidas → segmentos por ordem de hora (a do ponto do meio) → pontos com hora adiantada (isolados ou
// em série curta: só eles saem, sem «envenenar» o máximo e apagar o que vem a seguir) → pontos soltos de posição (runIClean).
function runIFinish(source, raw, o, extra){
  var cfg = o.cfg, items = [], bad = 0, noTime = 0, order = 0, spike = 0, naive = false, valid = 0, total = 0, i, j, k;
  for (i = 0; i < raw.length; i++) {
    var pts = [];
    for (j = 0; j < raw[i].length; j++) {
      var p = raw[i][j];
      if (!runIValidPt(p) || (p.lat === 0 && p.lon === 0)) { bad++; continue; }
      if (!runIFin(p.t)) { noTime++; continue; }
      pts.push(p);
    }
    if (pts.length) { items.push({k: items.length, med: pts[pts.length >> 1].t, pts: pts}); valid += pts.length; }
  }
  if (!valid) return runIFail(noTime ? "notime" : "empty", cfg);
  items.sort(function(a, b){ return a.med - b.med || a.k - b.k; });
  var flat = [], owner = [], segs = [], lastT = -Infinity;
  for (i = 0; i < items.length; i++) { for (j = 0; j < items[i].pts.length; j++) { flat.push(items[i].pts[j]); owner.push(i); } segs.push([]); }
  for (i = 0; i < flat.length; i++) {
    var q = flat[i];
    if (!(q.t > lastT)) { order++; continue; }
    var below = 0;   // hora adiantada: mais à frente há 2 ou mais pontos com hora entre o último aceite e esta (seriam apagados por causa dela)
    for (k = i + 1; k < flat.length && k <= i + cfg.orderWindow && below < 2; k++) if (flat[k].t < q.t && flat[k].t > lastT) below++;
    if (below >= 2) { order++; continue; }
    lastT = q.t;
    if (q.naive) naive = true;
    segs[owner[i]].push({lat: q.lat, lon: q.lon, t: q.t, acc: null});
  }
  segs = segs.filter(function(sg){ return sg.length > 0; });
  var cl = runIClean(segs, cfg);
  segs = cl.segs; spike = cl.dropped;
  for (i = 0; i < segs.length; i++) total += segs[i].length;
  if (total < 2) return runIFail("short", cfg);
  var startMs = segs[0][0].t, endMs = segs[segs.length - 1][segs[segs.length - 1].length - 1].t;
  if (startMs < cfg.minStartedAtMs || startMs > o.nowMs + cfg.futureSlackMs) return runIFail("date", cfg);
  if (endMs - startMs > cfg.maxDurationS * 1000) return runIFail("long", cfg);
  var warnings = [];
  if (naive) warnings.push(RUN_MSG.naive);
  if (extra && extra.multi) warnings.push(RUN_MSG.multi);
  if (bad + order > 0) warnings.push("Ignorámos " + (bad + order) + (bad + order === 1 ? " ponto inválido ou com hora repetida." : " pontos inválidos ou com hora repetida."));
  if (order >= 5 && order > 0.02 * valid) warnings.push(RUN_MSG.order);
  if (spike > 0) warnings.push("Ignorámos " + spike + (spike === 1 ? " ponto com posição impossível (salto do GPS)." : " pontos com posição impossível (saltos do GPS)."));
  if (noTime > 0) warnings.push("Ignorámos " + noTime + (noTime === 1 ? " ponto sem hora." : " pontos sem hora."));
  var declared = extra && runIFin(extra.declaredDistM) && extra.declaredDistM > 0 && extra.declaredDistM <= 1e7 ? Math.round(extra.declaredDistM) : null;
  return {ok: true, source: source, segments: segs, warnings: warnings, startedAtMs: startMs, endedAtMs: endMs, points: total, declaredDistM: declared};
}
function runIGpx(root, o){
  var cfg = o.cfg;
  if (root.localName !== "gpx") return runIFail("unreadable", cfg);
  var trks = runIKids(root, "trk"), raw = [], n = 0, a, b, c;
  for (a = 0; a < trks.length; a++) {
    var ty = runIKid(trks[a], "type");
    if (ty && /bik|cycl/i.test(runIText(ty))) return runIFail("bike", cfg);   // só se o ficheiro o diz (<trk><type>); sem tipo, aceita-se
    var tsegs = runIKids(trks[a], "trkseg");
    for (b = 0; b < tsegs.length; b++) {
      var pts = runIKids(tsegs[b], "trkpt"), seg = [];
      n += pts.length;
      if (n > cfg.maxFilePoints) return runIFail("points", cfg);
      for (c = 0; c < pts.length; c++) {
        var pt = pts[c], tm = runIKid(pt, "time"), pr = tm ? runParseTime(runIText(tm)) : null;
        seg.push({lat: runIDec(pt.getAttribute("lat")), lon: runIDec(pt.getAttribute("lon")), t: pr ? pr.ms : NaN, naive: !!(pr && pr.naive)});
      }
      raw.push(seg);
    }
  }
  if (!n) return runIFail(runIKids(root, "rte").length || runIKids(root, "wpt").length ? "route" : "empty", cfg);
  return runIFinish("gpx", raw, o, null);
}
function runITcx(root, o){
  var cfg = o.cfg;
  if (root.localName !== "TrainingCenterDatabase") return runIFail("unreadable", cfg);
  var acts = root.getElementsByTagNameNS("*", "Activity");
  if (!acts.length) return runIFail(root.getElementsByTagNameNS("*", "Course").length ? "route" : "empty", cfg);
  var act = acts[0], sport = String(act.getAttribute("Sport") || "").toLowerCase();
  if (/bik|cycl/.test(sport)) return runIFail("bike", cfg);
  var tracks = act.getElementsByTagNameNS("*", "Track"), raw = [], n = 0, a, b;
  for (a = 0; a < tracks.length; a++) {
    var tps = runIKids(tracks[a], "Trackpoint"), seg = [];
    n += tps.length;
    if (n > cfg.maxFilePoints) return runIFail("points", cfg);
    for (b = 0; b < tps.length; b++) {
      var pos = runIKid(tps[b], "Position");
      if (!pos) continue;   // sem posição (treino interior, pausa): ignora
      var tm = runIKid(tps[b], "Time"), pr = tm ? runParseTime(runIText(tm)) : null;
      seg.push({lat: runIDec(runIText(runIKid(pos, "LatitudeDegrees"))), lon: runIDec(runIText(runIKid(pos, "LongitudeDegrees"))), t: pr ? pr.ms : NaN, naive: !!(pr && pr.naive)});
    }
    raw.push(seg);
  }
  return runIFinish("tcx", raw, o, {multi: acts.length > 1, declaredDistM: runIDeclared(act)});
}
// distância que a app de origem declara (só um número, nada de texto do ficheiro): soma de Lap/DistanceMeters ou, se não houver,
// o maior DistanceMeters acumulado dos Trackpoint; null se não houver. O GPX não tem campo normalizado para isto.
function runIDeclared(act){
  var laps = act.getElementsByTagNameNS("*", "Lap"), sum = 0, any = false, i, k, v, tps;
  for (i = 0; i < laps.length; i++) {
    k = runIKid(laps[i], "DistanceMeters");
    v = k ? runIDec(runIText(k)) : NaN;
    if (runIFin(v) && v >= 0) { sum += v; any = true; }
  }
  if (!any) {
    tps = act.getElementsByTagNameNS("*", "Trackpoint");
    for (i = 0; i < tps.length; i++) {
      k = runIKid(tps[i], "DistanceMeters");
      v = k ? runIDec(runIText(k)) : NaN;
      if (runIFin(v) && v >= 0 && v > sum) { sum = v; any = true; }
    }
  }
  return any && sum > 0 ? sum : null;
}
function runParseGpx(text, opts){
  var o = runIOpts(opts), rd;
  try { rd = runIReadXml(text, o.cfg); if (!rd.ok) return rd; return runIGpx(rd.root, o); } catch (e) { return runIFail("unreadable", o.cfg); }
}
function runParseTcx(text, opts){
  var o = runIOpts(opts), rd;
  try { rd = runIReadXml(text, o.cfg); if (!rd.ok) return rd; return runITcx(rd.root, o); } catch (e) { return runIFail("unreadable", o.cfg); }
}
function runParseFile(name, input, opts){
  var o = runIOpts(opts), text = input;
  try {
    if (typeof name === "string" && /\.fit\s*$/i.test(name)) return runIFail("fit", o.cfg);
    if (typeof input !== "string") {
      var bytes = null, tag = Object.prototype.toString.call(input);
      if (tag === "[object ArrayBuffer]") bytes = new Uint8Array(input);
      else if (input && input.buffer && typeof input.byteLength === "number") bytes = new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength);
      if (!bytes) return runIFail("unreadable", o.cfg);
      if (bytes.length > o.cfg.maxFileBytes) return runIFail("toobig", o.cfg);
      if (runIIsFitBytes(bytes)) return runIFail("fit", o.cfg);
      if (typeof TextDecoder === "undefined") return runIFail("unreadable", o.cfg);
      text = new TextDecoder("utf-8").decode(bytes);
    }
    var rd = runIReadXml(text, o.cfg);
    if (!rd.ok) return rd;
    if (rd.root.localName === "gpx") return runIGpx(rd.root, o);
    if (rd.root.localName === "TrainingCenterDatabase") return runITcx(rd.root, o);
    return runIFail("unreadable", o.cfg);
  } catch (e) { return runIFail("unreadable", o.cfg); }
}

/* ---------- linhas da tabela runs ---------- */
function runUuid(){
  var b = new Array(16), i;
  var c = typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function" ? crypto : null;
  if (c) { var u = new Uint8Array(16); c.getRandomValues(u); for (i = 0; i < 16; i++) b[i] = u[i]; }
  else for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  var h = [];
  for (i = 0; i < 16; i++) h.push((b[i] < 16 ? "0" : "") + b[i].toString(16));
  return h.slice(0, 4).join("") + "-" + h.slice(4, 6).join("") + "-" + h.slice(6, 8).join("") + "-" + h.slice(8, 10).join("") + "-" + h.slice(10).join("");
}
function runIIsUuid(s){ return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }
function runIRowFail(code, error){ return {ok: false, code: code, error: error}; }
function runIBuild(run, nowMs, cfg){
  if (!run || typeof run !== "object") return runIRowFail("run", "Corrida inválida.");
  if (!runIIsUuid(run.id)) return runIRowFail("id", "Identificador da corrida inválido.");
  var sid = typeof run.studentId === "string" ? run.studentId.replace(/^\s+|\s+$/g, "") : "";
  if (!sid || sid.length > 100) return runIRowFail("student", "Falta o aluno.");
  if (RUN_SOURCES.indexOf(run.source) < 0) return runIRowFail("source", "Origem da corrida inválida.");
  var startMs = runINum(run.startedAtMs);
  if (startMs == null || startMs < cfg.minStartedAtMs || startMs > nowMs + cfg.futureSlackMs) return runIRowFail("date", "A data da corrida não é válida.");
  var durRaw = runINum(run.durationS), dur = durRaw == null ? 0 : Math.round(durRaw);
  if (dur < 1) return runIRowFail("duration", "O tempo da corrida tem de ser de pelo menos 1 segundo.");
  if (dur > cfg.maxDurationS) return runIRowFail("duration", "O tempo da corrida não pode passar das 24 horas.");
  var distRaw = runINum(run.distM), dist = distRaw == null ? -1 : Math.round(distRaw);
  if (dist < 0) return runIRowFail("dist", "Falta a distância da corrida.");
  if (dist > cfg.maxDistM) return runIRowFail("dist", "A distância máxima é " + Math.round(cfg.maxDistM / 1000) + " km.");
  if (dist > cfg.maxAvgSpeedMs * dur) return runIRowFail("speed", "Confirma a distância e o tempo: este ritmo parece impossível.");
  var consentRaw = runINum(run.consentV), consent = consentRaw == null ? 0 : Math.round(consentRaw);
  if (consent < 1 || consent > 32767) return runIRowFail("consent", "Falta o consentimento da Corrida.");
  var mov = runIInt(run.movingS, 0, cfg.maxDurationS, dur);
  if (mov > dur) mov = dur;
  var splits = [], i;
  if (Array.isArray(run.splitsS)) {
    for (i = 0; i < run.splitsS.length && splits.length < cfg.maxSplits; i++) {
      var sp = runINum(run.splitsS[i]);
      if (sp != null && sp >= 0) splits.push(Math.min(cfg.maxDurationS, Math.round(sp)));
    }
  }
  var rpe = runINum(run.rpe), notes = runIStr(run.notes, cfg.maxNotes);
  return {ok: true, row: {
    id: run.id.toLowerCase(), student_id: sid, started_at: new Date(Math.round(startMs)).toISOString(), source: run.source,
    duration_s: dur, moving_s: mov, distance_m: dist,
    gaps: runIInt(run.gaps, 0, cfg.maxGaps, 0), gap_s: runIInt(run.gapS, 0, cfg.maxDurationS, 0), hidden_s: runIInt(run.hiddenS, 0, cfg.maxDurationS, 0),
    splits_s: splits.length ? splits : null,
    rpe: rpe != null && rpe >= 1 && rpe <= 10 ? Math.round(rpe) : null,
    notes: notes ? notes : null, consent_v: consent
  }};
}
function runBuildInsert(run, nowMs){
  var r = runIBuild(run, runIFin(nowMs) ? nowMs : Date.now(), RUN_CFG);
  return r.ok ? r.row : null;
}
function runCheckRun(run, nowMs){
  var r = runIBuild(run, runIFin(nowMs) ? nowMs : Date.now(), RUN_CFG);
  return r.ok ? {ok: true} : {ok: false, code: r.code, error: r.error};
}
function runNormalizeRow(row){
  if (!row || typeof row !== "object") return null;
  var id = typeof row.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(row.id) ? row.id : null;
  var st = typeof row.started_at === "string" ? runParseTime(row.started_at) : null;
  if (!id || !st || st.ms < RUN_CFG.minStartedAtMs) return null;
  if (RUN_SOURCES.indexOf(row.source) < 0) return null;
  var dur = runIInt(row.duration_s, 0, RUN_CFG.maxDurationS, 0), dist = runIInt(row.distance_m, 0, RUN_CFG.maxDistM, 0);
  var mov = Math.min(dur, runIInt(row.moving_s, 0, RUN_CFG.maxDurationS, 0));
  var splits = [], i, rpe = runINum(row.rpe), cv = runIInt(row.consent_v, 1, 32767, 0);
  if (Array.isArray(row.splits_s)) {
    for (i = 0; i < row.splits_s.length && splits.length < RUN_CFG.maxSplits; i++) {
      var sp = runINum(row.splits_s[i]);
      if (sp != null && sp >= 0) splits.push(Math.min(RUN_CFG.maxDurationS, Math.round(sp)));
    }
  }
  return {
    id: id, studentId: typeof row.student_id === "string" ? row.student_id.slice(0, 100) : "", startedAtMs: st.ms, startedAt: new Date(st.ms).toISOString(),
    source: row.source, distM: dist, durationS: dur, movingS: mov,
    gaps: runIInt(row.gaps, 0, RUN_CFG.maxGaps, 0), gapS: runIInt(row.gap_s, 0, RUN_CFG.maxDurationS, 0), hiddenS: runIInt(row.hidden_s, 0, RUN_CFG.maxDurationS, 0),
    splitsS: splits, rpe: rpe != null && rpe >= 1 && rpe <= 10 ? Math.round(rpe) : null,
    notes: runIStr(row.notes, RUN_CFG.maxNotes), consentV: cv > 0 ? cv : null,
    createdBy: typeof row.created_by === "string" ? row.created_by.slice(0, 40) : "", paceSPerKm: runPaceOf(dist, mov)
  };
}
function runNormalizeRows(arr){
  var out = [], i;
  if (!Array.isArray(arr)) return out;
  for (i = 0; i < arr.length; i++) { var r = runNormalizeRow(arr[i]); if (r) out.push(r); }
  return out;
}
function runDupCheck(existingRuns, candidate){
  if (!Array.isArray(existingRuns) || !candidate) return null;
  var cs = runIFin(candidate.startedAtMs) ? candidate.startedAtMs : (typeof candidate.started_at === "string" && runParseTime(candidate.started_at) ? runParseTime(candidate.started_at).ms : NaN);
  var cd = runINum(candidate.distM != null ? candidate.distM : candidate.distance_m);
  if (!runIFin(cs) || cd == null) return null;
  var i;
  for (i = 0; i < existingRuns.length; i++) {
    var r = existingRuns[i];
    if (!r) continue;
    var rs = runIFin(r.startedAtMs) ? r.startedAtMs : (typeof r.started_at === "string" && runParseTime(r.started_at) ? runParseTime(r.started_at).ms : NaN);
    var rd = runINum(r.distM != null ? r.distM : r.distance_m);
    if (!runIFin(rs) || rd == null) continue;
    if (Math.abs(rs - cs) <= 60000 && Math.abs(rd - cd) <= 0.02 * Math.max(rd, cd)) return r;
  }
  return null;
}

/* ---------- formatação PT-PT e entradas do registo à mão ---------- */
function runPaceOf(distM, movingS){
  if (!runIFin(distM) || !runIFin(movingS) || distM <= 0 || movingS <= 0) return null;
  return movingS / (distM / 1000);
}
function runPaceStr(sPerKm){
  if (!runIFin(sPerKm) || sPerKm <= 0 || sPerKm >= 3600) return "–";
  var s = Math.round(sPerKm);
  return Math.floor(s / 60) + ":" + runIPad2(s % 60);
}
function runDurStr(sec){
  if (!runIFin(sec) || sec < 0) return "–";
  var s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h > 0 ? h + ":" + runIPad2(m) : String(m)) + ":" + runIPad2(s % 60);
}
function runDistStr(m){
  if (!runIFin(m) || m < 0) return "–";
  var cents = Math.round(m / 10);
  return Math.floor(cents / 100) + "," + runIPad2(cents % 100) + " km";
}
function runParseKm(str){
  var s = String(str == null ? "" : str).replace(/\s*km\s*$/i, "").replace(/^\s+|\s+$/g, "");
  if (!/^\d+([.,]\d{1,3})?$/.test(s)) return NaN;
  var km = parseFloat(s.replace(",", "."));
  if (!(km > 0) || km > RUN_CFG.maxDistM / 1000) return NaN;
  return Math.round(km * 1000);
}
function runParseDuration(str){
  var m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*$/.exec(String(str == null ? "" : str));
  if (!m) return NaN;
  var h = m[1] != null ? +m[1] : 0, mi = +m[2], s = +m[3];
  if (s > 59 || (m[1] != null && mi > 59)) return NaN;
  var total = h * 3600 + mi * 60 + s;
  return total >= 1 && total <= RUN_CFG.maxDurationS ? total : NaN;
}

// Registo à mão numa só linha: «5,2 km 28:30», «ontem 18:30 5,23 km 27:58», «22/10 às 20:17 5 km 1h05», «5,2km 28min 30s».
// Devolve {ok:true, distM, durS, date:"aaaa-mm-dd"|"", time:"hh:mm"|""} ou {ok:false, error}. Não adivinha: sem distância e tempo claros recusa.
// nowMs opcional (para «hoje»/«ontem»): por omissão Date.now(). Ritmos («5:30/km») são ignorados, não confundidos com o tempo.
function runParseQuick(text, nowMs){
  var bad = {ok: false, error: "Escreve, por exemplo: 5,2 km 28:30  (ou: ontem 18:30 5,23 km 27:58)."};
  var t = String(text == null ? "" : text).toLowerCase().replace(/\s+/g, " ").replace(/^ | $/g, "");
  if (!t || t.length > 200) return bad;
  var date = "", time = "", distM = NaN, durS = NaN, m;
  function pad(n){ return (n < 10 ? "0" : "") + n; }
  function iso(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  var now = new Date(typeof nowMs === "number" && isFinite(nowMs) ? nowMs : Date.now());
  t = t.replace(/\d{1,2}:\d{2}\s*(?:min\s*)?\/\s*km/g, " ");                      // ritmo
  if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t))) { date = m[1] + "-" + m[2] + "-" + m[3]; t = t.replace(m[0], " # "); }
  else if ((m = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/.exec(t))) {
    var yy = m[3] ? (m[3].length === 2 ? 2000 + (+m[3]) : +m[3]) : now.getFullYear(), dd = +m[1], mm = +m[2];
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) { date = yy + "-" + pad(mm) + "-" + pad(dd); if (!m[3] && date > iso(now)) date = (yy - 1) + "-" + pad(mm) + "-" + pad(dd); t = t.replace(m[0], " # "); }
  } else if (/\bontem\b/.test(t)) { date = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)); t = t.replace(/\bontem\b/, " # "); }
  else if (/\bhoje\b/.test(t)) { date = iso(now); t = t.replace(/\bhoje\b/, " # "); }
  var atMark = /(?:^|\s)(?:às|as|@)\s*(\d{1,2}):(\d{2})\b/.exec(t);
  // distância
  if ((m = /(\d+(?:[.,]\d{1,3})?)\s*(?:km|kms|quil[oó]metros?)\b/.exec(t))) { distM = runParseKm(m[1]); t = t.replace(m[0], " "); }
  else if ((m = /\b(\d{3,6})\s*(?:m|metros)\b/.exec(t))) { distM = +m[1]; t = t.replace(m[0], " "); }
  else if ((m = /(?:^|\s)(\d{1,3}[.,]\d{1,3})(?=\s|$)/.exec(t))) { distM = runParseKm(m[1]); t = t.replace(m[1], " "); }
  // hora de início explícita («às 20:17») e tempo
  if (atMark) { time = pad(+atMark[1]) + ":" + atMark[2]; t = t.replace(atMark[0], " "); }
  var cols = [], re = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  while ((m = re.exec(t))) cols.push({txt: m[0], idx: m.index, a: +m[1], b: +m[2], c: m[3] != null ? +m[3] : null});
  var durTok = null, i;
  if (cols.length >= 2 && !time) {                                                  // duas horas: a que vem logo a seguir à data (ou a primeira) é a hora de início
    var startTok = cols[0]; time = pad(startTok.a) + ":" + pad(startTok.b); durTok = cols[1];
    if (startTok.c != null || startTok.a > 23 || startTok.b > 59) return bad;
  } else if (cols.length >= 1) durTok = cols[cols.length - 1];
  if (durTok) {
    var dv = runParseDuration(durTok.txt);
    if (isNaN(dv) && durTok.c == null) dv = runParseDuration(durTok.txt.replace(/^(\d{1,2}):(\d{2})$/, "$1:$2"));
    durS = dv;
  } else if ((m = /(\d+)\s*h\s*(\d{1,2})?\s*(?:min|m)?/.exec(t)) && (m[1] !== undefined)) {
    durS = (+m[1]) * 3600 + (m[2] ? (+m[2]) * 60 : 0); var ms2 = /(\d+)\s*s\b/.exec(t); if (ms2) durS += +ms2[1];
  } else if ((m = /(\d+)\s*(?:min|mins|minutos?)\b\s*(?:(\d+)\s*(?:s|seg)\b)?/.exec(t))) {
    durS = (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  }
  if (!(distM > 0) || !(durS >= 1) || durS > RUN_CFG.maxDurationS) return bad;
  if (distM < 100 || distM > RUN_CFG.maxDistM) return {ok: false, error: "A distância tem de estar entre 0,1 e 300 km."};
  return {ok: true, distM: Math.round(distM), durS: Math.round(durS), date: date, time: time};
}

/* ---------- percurso em SVG (sem mapa de fundo, sem pedidos a terceiros) ---------- */
function runTrackSvg(segments, opts){
  opts = opts || {};
  var W = runIInt(opts.width, 80, 2000, 320), H = runIInt(opts.height, 60, 2000, 200), pad = runIInt(opts.pad, 0, 100, 14);
  var showScale = opts.scale !== false, segs = [], n = 0, sumLat = 0, i, j;
  if (!Array.isArray(segments)) return "";
  for (i = 0; i < segments.length; i++) {
    var seg = segments[i], pts = [];
    if (!Array.isArray(seg)) continue;
    for (j = 0; j < seg.length; j++) if (runIValidPt(seg[j])) { pts.push([runILat(seg[j]), runILon(seg[j])]); sumLat += runILat(seg[j]); n++; }
    if (pts.length) segs.push(pts);
  }
  if (n < 2) return "";
  var c = Math.cos(sumLat / n * Math.PI / 180), minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (i = 0; i < segs.length; i++) for (j = 0; j < segs[i].length; j++) {
    var x = segs[i][j][1] * c, y = segs[i][j][0];
    segs[i][j] = [x, y];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  var spanX = maxX - minX, spanY = maxY - minY, bottom = showScale ? 16 : 0;
  var bw = W - 2 * pad, bh = H - 2 * pad - bottom;
  if (!(bw > 0) || !(bh > 0) || !(spanX > 0 || spanY > 0)) return "";
  var k = Math.min(spanX > 0 ? bw / spanX : Infinity, spanY > 0 ? bh / spanY : Infinity);
  if (!runIFin(k) || k <= 0) return "";
  var ox = pad + (bw - spanX * k) / 2, oy = pad + (bh - spanY * k) / 2, bad = false;
  function px(v){ if (!runIFin(v)) { bad = true; return "0"; } return String(Math.round(v * 10) / 10); }
  var parts = [], first = null, last = null, prevEnd = null;
  for (i = 0; i < segs.length; i++) {
    var xy = [];
    for (j = 0; j < segs[i].length; j++) {
      var sx = ox + (segs[i][j][0] - minX) * k, sy = oy + (maxY - segs[i][j][1]) * k;
      xy.push([sx, sy]);
    }
    if (prevEnd) parts.push('<line class="run-svg-link" x1="' + px(prevEnd[0]) + '" y1="' + px(prevEnd[1]) + '" x2="' + px(xy[0][0]) + '" y2="' + px(xy[0][1]) + '" stroke="currentColor" stroke-width="2" stroke-dasharray="4 5" opacity="0.55"/>');
    if (xy.length > 1) parts.push('<polyline class="run-svg-line" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="' + xy.map(function(q){ return px(q[0]) + "," + px(q[1]); }).join(" ") + '"/>');
    if (!first) first = xy[0];
    last = xy[xy.length - 1]; prevEnd = last;
  }
  parts.push('<circle class="run-svg-start" cx="' + px(first[0]) + '" cy="' + px(first[1]) + '" r="5" fill="currentColor"/>');
  parts.push('<circle class="run-svg-end" cx="' + px(last[0]) + '" cy="' + px(last[1]) + '" r="6" fill="none" stroke="currentColor" stroke-width="3"/>');
  if (showScale) {
    var mPerPx = 1 / (k / (Math.PI / 180 * RUN_EARTH_R)), nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000], chosen = 0;
    for (i = 0; i < nice.length; i++) if (nice[i] / mPerPx <= W * 0.4 && nice[i] / mPerPx >= 18) chosen = nice[i];
    if (chosen) {
      var len = chosen / mPerPx, by = H - 8;
      parts.push('<line class="run-svg-scale" x1="' + px(pad) + '" y1="' + px(by) + '" x2="' + px(pad + len) + '" y2="' + px(by) + '" stroke="currentColor" stroke-width="2"/>');
      parts.push('<text class="run-svg-scale-text" x="' + px(pad + len + 6) + '" y="' + px(by + 3.5) + '" font-size="10" fill="currentColor">' + (chosen >= 1000 ? chosen / 1000 + " km" : chosen + " m") + "</text>");
    }
  }
  if (bad) return "";
  var label = typeof opts.ariaLabel === "string" && opts.ariaLabel ? opts.ariaLabel : "Percurso da corrida, desenhado sem mapa. O ponto cheio é a partida e o círculo é a chegada.";
  return '<svg class="run-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + runIEsc(label) + '">' + parts.join("") + "</svg>";
}
