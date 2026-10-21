// Música no treino: o aluno cola o link da playlist (só neste telemóvel); a app só abre o link na app de música.
// Parte 1 (Node): validação e armazenamento. Parte 2 (Chromium com Supabase simulado): o ecrã de treino.
// A reprodução e a continuidade da música ao sair da app dependem do iPhone/Android e da app de música: só se vê em dispositivo real.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();
var store = {};
global.localStorage = {getItem: function(k){ return k in store ? store[k] : null; }, setItem: function(k, v){ store[k] = String(v); }, removeItem: function(k){ delete store[k]; }};

// ---- validação ----
var ok = ["https://open.spotify.com/playlist/37i9dQZF1DXdPec7aLTmlC?si=abc", "https://music.apple.com/pt/playlist/treino/pl.123", "https://music.youtube.com/playlist?list=PL123", "https://www.youtube.com/playlist?list=PL123", "https://youtu.be/abc", "https://spotify.link/xyz"];
check.check("1. Aceita links https do Spotify, Apple Music e YouTube (Music)", ok.every(function(u){ var n = normalizePlaylistLink(u); return n.ok && n.url.indexOf("https://") === 0; }));
check.check("2. Diz de que serviço é o link", normalizePlaylistLink(ok[0]).service === "Spotify" && normalizePlaylistLink(ok[1]).service === "Apple Music" && normalizePlaylistLink(ok[2]).service === "YouTube Music" && normalizePlaylistLink(ok[3]).service === "YouTube");
check.check("3. Sem «https://» acrescenta-o (links colados da app de música)", normalizePlaylistLink("open.spotify.com/playlist/abc").ok && normalizePlaylistLink("open.spotify.com/playlist/abc").url === "https://open.spotify.com/playlist/abc");
var bad = ["", "   ", "javascript:alert(1)", "data:text/html,<script>1</script>", "http://open.spotify.com/playlist/a", "https://open.spotify.com.evil.com/playlist/a", "https://evil.com/open.spotify.com/a", "https://user:pw@open.spotify.com/a", "https://exemplo.pt/musica", "ftp://music.apple.com/a", "spotify:playlist:abc", "isto não é um link", "https://" + "a".repeat(500) + ".com"];
check.check("4. Recusa vazios, javascript:, data:, http, domínios parecidos, credenciais no link, outros sites e textos soltos", bad.every(function(u){ var n = normalizePlaylistLink(u); return !n.ok && n.error; }));
check.check("5. As mensagens de erro estão em português", /Cola o link/.test(normalizePlaylistLink("").error) && /Spotify, Apple Music ou YouTube Music/.test(normalizePlaylistLink("https://exemplo.pt/x").error));

// ---- armazenamento ----
var ana = {id: "ana"}, rui = {id: "rui"};
check.check("6. Sem playlist guardada não há nada", playlistLoad(ana) === null);
playlistSave(ana, "https://open.spotify.com/playlist/abc");
check.check("7. A playlist fica guardada para esse aluno e não aparece noutro", playlistLoad(ana).url === "https://open.spotify.com/playlist/abc" && playlistLoad(rui) === null);
store[playlistKey(rui)] = "javascript:alert(1)";
check.check("8. Um valor estranho no armazenamento é ignorado", playlistLoad(rui) === null);
playlistClear(ana);
check.check("9. Remover apaga-a", playlistLoad(ana) === null);
var html = (function(){ playlistSave(ana, "https://open.spotify.com/playlist/abc?x=1&y=\"2"); return playlistRowHtml(ana); })();
check.check("10. O botão abre noutro separador sem passar a página de origem e escapa o endereço", /target="_blank"/.test(html) && /rel="noopener noreferrer"/.test(html) && !/href="[^"]*"[^>]*"2/.test(html) && html.indexOf('y="2') < 0);
check.check("11. Sem playlist o ecrã só mostra «Música no treino»", /Música no treino/.test((playlistClear(ana), playlistRowHtml(ana))) && !/<a /.test(playlistRowHtml(ana)));
var src = appSource.slice(appSource.indexOf("Música no treino: a playlist do aluno"), appSource.indexOf("function shopStoreKey"));
check.check("12. O código da música não faz pedidos de rede, não incorpora leitores (iframe/áudio) nem usa o Supabase", !/\b(fetch|XMLHttpRequest|sendBeacon|iframe|<audio|<video|new Audio|sb\.)\b/.test(src));

// ---- ecrã (Chromium) ----
var pw = null;
["playwright", "/opt/node22/lib/node_modules/playwright"].some(function(m){ try { pw = require(m); return true; } catch (e) { return false; } });
var fs = require("fs"), path = require("path");
var chromiumPath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].filter(Boolean).filter(function(p){ return fs.existsSync(p); })[0];
if (!pw || !chromiumPath){ console.log("(ignorado o ecrã: Playwright/Chromium não disponíveis aqui)"); check.summarize(); }
var fakeSource = require("./helpers/fake-supabase");
var startStaticServer = require("./helpers/static-server");
(async function(){
  authRole = "professional";
  var s = buildFullDemoStudent(); s.id = "ana"; s.name = "Ana Treina"; s.isDemo = false; s.active = true; s.photos = []; s.nutritionPhase = null;
  var row = JSON.parse(JSON.stringify(studentToRow(s)));
  var srv = await startStaticServer(path.join(__dirname, ".."));
  var browser = await pw.chromium.launch({executablePath: chromiumPath});
  var errors = [];
  var ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(fakeSource({role: "student", userId: "user-ana", email: "ana@x.test", rows: [row]}));
  var pg = await ctx.newPage(); pg.setDefaultTimeout(6000); pg.on("pageerror", function(e){ errors.push(e.message); });
  var reqs = []; pg.on("request", function(r){ reqs.push(r.url()); });
  await pg.goto(srv.url);
  await pg.waitForSelector("#startWorkout, [data-start-day]");
  await pg.locator("#startWorkout, [data-start-day]").first().click();
  await pg.waitForSelector("#playlistAdd");
  check.check("13. O ecrã de treino mostra «Música no treino» enquanto não houver playlist", /música no treino/i.test(await pg.locator("#playlistAdd").innerText()));
  await pg.click("#playlistAdd");
  await pg.fill("#plLink", "https://exemplo.pt/musica"); await pg.click("#plSave");
  check.check("14. Um link de outro site é recusado com mensagem em português e nada fica guardado", /Spotify, Apple Music ou YouTube Music/.test(await pg.locator("#plErr").innerText()) && (await pg.evaluate(function(){ return Object.keys(localStorage).filter(function(k){ return /playlist/.test(k); }).length; })) === 0);
  await pg.fill("#plLink", "open.spotify.com/playlist/37i9dQZF1DXdPec7aLTmlC"); await pg.click("#plSave");
  await pg.waitForSelector("#playlistOpen");
  var a = await pg.evaluate(function(){ var e = document.getElementById("playlistOpen"); return {href: e.href, target: e.target, rel: e.rel, text: e.textContent}; });
  check.check("15. Guardada a playlist, aparece «Abrir Spotify» com o link certo, noutro separador e sem referência à EVOLVE", a.href === "https://open.spotify.com/playlist/37i9dQZF1DXdPec7aLTmlC" && a.target === "_blank" && /noopener/.test(a.rel) && /Abrir Spotify/.test(a.text));
  check.check("16. Fica avisado de que a música toca na app de música e o treino fica guardado", /podes sair da EVOLVE/.test(await pg.locator(".aluno-tabs").innerText()));
  await pg.reload(); await pg.waitForSelector("#startWorkout, [data-start-day]");
  await pg.locator("#startWorkout, [data-start-day]").first().click();
  await pg.waitForSelector("#playlistOpen");
  check.check("17. Depois de recarregar a app a playlist continua lá", (await pg.locator("#playlistOpen").count()) === 1);
  await pg.click("#playlistEdit"); await pg.waitForSelector("#plRemove");
  await pg.click("#plRemove");
  await pg.waitForSelector("#playlistAdd");
  check.check("18. «Alterar» → «Remover» tira a playlist e volta o convite a adicionar", (await pg.locator("#playlistOpen").count()) === 0);
  var external = reqs.filter(function(u){ return /spotify|apple|youtube/.test(u); });
  check.check("19. A EVOLVE nunca contacta os serviços de música (só abre o link quando o aluno toca)", external.length === 0);
  check.check("20. Nenhum erro de JavaScript", errors.length === 0);
  await browser.close(); srv.server.close();
  check.summarize();
})().catch(function(e){ console.log("FAIL: exceção", e.message.split("\n")[0]); process.exit(1); });
