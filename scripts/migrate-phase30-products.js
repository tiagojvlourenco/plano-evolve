#!/usr/bin/env node
// Fase 34 — script pontual (corre uma vez): migra os 114 produtos de marca
// acrescentados na Fase 30 (commit "Fase 30: acrescenta 114 produtos de
// marca dos principais supermercados", e393fa9) de dentro do código
// (FOOD_DB/FOOD_GROUPS em index.html) para a tabela food_products.
//
// Corre localmente, nunca no browser: node scripts/migrate-phase30-products.js
// Não escreve na Supabase diretamente — gera scripts/output-migrate-phase30.sql
// para reveres e correres tu no SQL Editor, depois de aplicares 0018.
//
// Ajustes pedidos depois da primeira versão deste script:
//
//   1. Os 114 nomes NÃO dependem de "git diff" em tempo de execução — foram
//      extraídos uma única vez (via git diff e393fa9~1 e393fa9 -- index.html)
//      e ficam escritos aqui, na lista PHASE30_NAMES. O resultado gerado
//      (scripts/output-migrate-phase30.sql) é o registo versionado e
//      auditável a partir de agora — nem este script nem o histórico do git
//      precisam de ser corridos outra vez para repetir/confirmar a operação.
//
//   2. CORREÇÃO IMPORTANTE (a primeira versão deste script estava errada):
//      um commit do GitHub NÃO é uma fonte nutricional verificável de um
//      produto — é só o registo interno de quando/como o código foi
//      escrito. Por isso:
//        - source_url fica NULL para todos os 114 (não existe uma fonte
//          INDIVIDUAL verificável guardada por produto — a Fase 30 só
//          gravou nome/marca/kcal/macros já limpos, não a ficha de origem
//          de cada um; tentar voltar a encontrar cada produto na Open Food
//          Facts por pesquisa de texto foi testado e é pouco fiável,
//          arriscando associar a fonte errada);
//        - o link do commit (e393fa9) vai só em internal_note — uma nota de
//          auditoria interna, nunca mostrada ao aluno, nunca contada como
//          fonte nutricional;
//        - source_type = 'legacy_phase30' (não 'open_food_facts'), um tipo
//          de origem próprio para produtos migrados do código sem fonte
//          individual guardada;
//        - verification_status = 'pending' para todos os 114 — nenhum
//          fica "verified" só por ter uma nota de auditoria. Ficam por
//          aprovar no Catálogo, um a um, à medida que se confirmar uma
//          fonte real (página oficial, rótulo fotografado, ou uma ficha da
//          Open Food Facts corretamente associada a esse produto).
//
//   3. ean: não fica preenchido para nenhum dos 114 — melhor null do que um
//      código que não se tem a certeza que está correto.
//
//   4. Retalhista (food_product_retailers): NÃO é escrito por este script.
//      mergeFoodProduct() só acrescenta "· Retalhista" ao nome quando o
//      produto tem exatamente 1 retalhista associado — associar agora
//      mudaria o nome de ~70 destes produtos (os de marca própria de um só
//      retalhista óbvio), o que quebraria qualquer plano de aluno já
//      guardado com o nome atual. Prioriza-se "manter o nome atual" sobre
//      "associar o retalhista" nesta primeira migração.
//
//   5. O FOOD_DB atual (index.html/evolve-nutrition.html) continua
//      inalterado — nenhum destes 114 é removido do código nesta fase. Como
//      todos entram "pending" na base de dados (ver ponto 2), nenhum
//      alimento chega a FOOD_DB por loadFoodProducts() antes de ser
//      aprovado — o código continua a ser o único fallback ativo até lá,
//      garantindo que nenhum plano antigo deixa de funcionar.

const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(__dirname, "..");
const PHASE30_COMMIT = "e393fa9";
const PHASE30_SOURCE_URL = "https://github.com/tiagojvlourenco/plano-evolve/commit/" + PHASE30_COMMIT;

// Extraído uma única vez via:
//   git diff e393fa9~1 e393fa9 -- index.html | grep '{name:'
// e colado aqui — não é recalculado em cada execução (ver ponto 1 acima).
const PHASE30_NAMES = [
  "Pão de forma 100% integral (Mercadona)","Pão de forma com sementes e pevides (Hacendado)",
  "Pão de forma branco (Hacendado)","Penne Rigate (Barilla)","Esparguete integral (Milaneza)",
  "Esparguete (Milaneza)","Fusilli de trigo integral (Continente)","Esparguete de trigo integral (Continente)",
  "Arroz integral longo (Hacendado)","Arroz basmati (Hacendado)","Arroz carolino (Continente)",
  "Arroz vaporizado (Continente)","Arroz basmati (Pingo Doce)","Arroz integral (Pingo Doce)",
  "Flocos de aveia extra suaves (Brüggen)","Muesli crocante (Mercadona)","Farinha fina de milho (Hacendado)",
  "Farinha de milho branco pré-cozida (Hacendado)","Farinha branca de neve fina (Branca de Neve)",
  "Farinha de aveia integral (Seara)","Farinha de trigo tipo 55 sem fermento (Pingo Doce)",
  "Iogurte grego natural ligeiro (Continente Equilíbrio)","Iogurte grego natural (Oikos)",
  "Iogurte proteico de baunilha (YoPro Danone)","Iogurte proteico com manga e maracujá 0% (Mercadona)",
  "Iogurte com frutos do bosque (Mercadona)","Iogurte 0% com fruta (Mercadona)","Ricotta (Mercadona)",
  "Mozzarella (Hacendado)","Grana Padano (Hacendado)","Queijo feta (Mercadona)","Queijo creme suave (Mercadona)",
  "Leite meio-gordo (Mimosa)","Leite meio-gordo (Continente)","Leite magro (Continente Equilíbrio)",
  "Leite meio-gordo UHT (Pingo Doce)","Leite gordo (Mimosa)","Leite meio-gordo sem lactose (Mimosa)",
  "Bebida de aveia (Liquats Vegetals)","Bebida de soja (Mercadona)","Água de coco (Mercadona)",
  "Peito de peru fatiado (Continente)","Salsichas tipo Frankfurt (Nobre)","Peito de frango fatias finas (Campofrio)",
  "Bacon em tiras fumado (Dulano)","Fiambre de frango (Monells)","Salsichas de aves (Continente)",
  "Bacon fumado (Continente)","Fiambre da pá (Pingo Doce)","Asas de frango crocantes (PorSi)",
  "Peito de peru (Dia)","Bife de frango (Pingo Doce)","Sardinhas portuguesas em azeite (Ramirez)",
  "Atum posta ao natural (Pingo Doce)","Atum posta em óleo de girassol (Pingo Doce)",
  "Sardinha enlatada em azeite (Continente)","Varinhas de pescada (Ocean Sea)","Fatias de presunto (Nobre)",
  "Ovos frescos classe M (Pingo Doce)","Ovos frescos (Continente)","Clara de ovo (Continente)",
  "Ameixas secas sem caroço (Mercadona)","Tâmaras secas sem caroço (Mercadona)","Tâmara seca (Continente)",
  "Tâmara seca com caroço (Pingo Doce)","Bagas goji secas (Bio)","Mirtilos (Pingo Doce)",
  "Mistura de frutos vermelhos secos (Origens)","Tomate pelado em pedaços (Hacendado)","Cenouras (Continente)",
  "Polpa de tomate (Pingo Doce)","Polpa de tomate (Continente)","Tomate em pedaços (Pingo Doce)",
  "Feijão verde (Compal)","Tomate pelado inteiro (Pingo Doce)","Pimentos assados vermelhos e verdes (Hacendado)",
  "Azeite virgem extra (Hacendado)","Azeite virgem extra (Pingo Doce)","Azeite (Oliveira da Serra)",
  "Azeite Gallo (Gallo)","Azeite (Continente)","Azeite virgem extra (Herdade do Esporão)",
  "Óleo de coco virgem (Mercadona)","Óleo de girassol (Fula)","Óleo alimentar (Pingo Doce)",
  "Creme vegetal para barrar (Pingo Doce)","Creme vegetal para barrar (Continente)","Margarina vegetal (Vaqueiro)",
  "Nutella — creme de avelã e cacau (Nutella)","Manteiga de amendoim 100% (Mercadona)","Guacamole (Mercadona)",
  "Hummus clássico (Hacendado)","Manteiga de amendoim cremosa (Maribel)","Manteiga tradicional com sal (Mimosa)",
  "Nozes (Dia)","Caju (Continente)","Noz em metades (Continente)","Nuggets de frango (Mercadona)",
  "Pringles original (Pringles)","Sumol de laranja (Sumol)","Guaraná Antarctica (Guaraná Antarctica)",
  "Coca-Cola original (Coca-Cola)","Coca-Cola zero (Coca-Cola)","Chocolate de leite (Milka)",
  "Chocolate negro 72% (Mercadona)","Toblerone (Mondelez)","Bolachas Nutella de avelã e cacau (Ferrero)",
  "Bolacha Maria 100% integral (Mercadona)","Digestive de aveia (Mercadona)",
  "Batatas fritas ao forno com sal (Lay's)","Batatas fritas originais (Lay's)",
  "Rebuçados de eucalipto e mentol 0% açúcar (Hacendado)","Sortido de gomas (Pingo Doce)",
  "Compota de morango 0% açúcar (Mercadona)"
];

function splitNameBrand(displayName){
  var m = displayName.match(/^(.*) \(([^()]+)\)$/);
  if (!m) return null;
  return { name: m[1], brand: m[2] };
}
function sqlStr(s){ return s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'"; }

function main(){
  require(path.join(APP_DIR, "tests/setup"))();
  const appSource = require(path.join(APP_DIR, "tests/extract-app"))();
  eval(appSource);

  console.log("Nomes da Fase 30 (lista fixa embutida):", PHASE30_NAMES.length);

  const rows = [];
  const skipped = [];
  const seenKey = new Set();
  const duplicates = [];
  PHASE30_NAMES.forEach((displayName) => {
    const db = FOOD_DB[displayName];
    const split = splitNameBrand(displayName);
    if (!db || !split) { skipped.push(displayName); return; }
    const key = (split.name + "|" + split.brand).toLowerCase();
    if (seenKey.has(key)) { duplicates.push(displayName); return; }
    seenKey.add(key);
    const group = groupOfFood(displayName);
    rows.push({ name: split.name, brand: split.brand, group, kcal: db.kcal, p: db.p, c: db.c, f: db.f });
  });

  if (skipped.length) console.log("AVISO — não encontrados em FOOD_DB (não incluídos):", skipped);
  if (duplicates.length) console.log("AVISO — nome+marca duplicado dentro da própria lista (não incluídos 2x):", duplicates);

  const lines = [
    "-- Fase 34 — migração dos 114 produtos de marca da Fase 30 para food_products.",
    "-- Gerado por scripts/migrate-phase30-products.js — FICHEIRO VERSIONADO, não",
    "-- precisa de ser regenerado para repetir/auditar esta operação no futuro.",
    "--",
    "-- Todos entram como 'pending' — nenhum tem uma fonte INDIVIDUAL verificável",
    "-- guardada (página oficial, rótulo fotografado, ou ficha da Open Food Facts",
    "-- corretamente associada a esse produto específico), por isso source_url",
    "-- fica null em todos. O link do commit onde foram originalmente revistos",
    "-- (" + PHASE30_SOURCE_URL + ") vai só em",
    "-- internal_note, como nota de auditoria interna — NUNCA conta como fonte",
    "-- nutricional nem é mostrado ao aluno. source_type = 'legacy_phase30'.",
    "-- ean fica por preencher (melhor null do que um código incerto).",
    "-- Nenhum retalhista é associado nesta migração, para não mudar o nome de",
    "-- nenhum produto já usado em planos de alunos (ver ponto 4 no script).",
    "--",
    "-- Aprova cada um no Catálogo à medida que confirmares uma fonte real —",
    "-- até lá, o FOOD_DB atual no código continua a ser o fallback ativo (estes",
    "-- produtos só chegam à app via loadFoodProducts() depois de 'verified').",
    ""
  ];
  rows.forEach((r) => {
    const note = "Migrado do código (Fase 30) sem fonte individual guardada — ver " + PHASE30_SOURCE_URL;
    lines.push(
      "insert into food_products (name, brand, food_group, nutrition_basis, kcal, protein, carbs, fat, source_url, internal_note, source_type, verification_status) values (" +
      [sqlStr(r.name), sqlStr(r.brand), sqlStr(r.group), sqlStr("100g"), r.kcal, r.p, r.c, r.f, "null", sqlStr(note), sqlStr("legacy_phase30"), sqlStr("pending")].join(", ") +
      ");"
    );
  });

  const outPath = path.join(APP_DIR, "scripts", "output-migrate-phase30.sql");
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
  console.log("Guardado:", outPath);
  console.log("Produtos incluídos:", rows.length, "| todos 'pending' (0 com fonte individual verificável) | todos com internal_note | 0 com source_url | 0 com EAN");
}

main();
