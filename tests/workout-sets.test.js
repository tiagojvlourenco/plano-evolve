// Registo do treino: carga e RIR passam para a série seguinte, esforço da sessão pela média do RIR, última série sem descanso.
require("./setup")();
var appSource = require("./extract-app")();
eval(appSource);
var check = require("./check")();

function fake(attrs, value, checked){
  var a = Object.assign({}, attrs), st = {};
  return {value: value == null ? "" : String(value), checked: !!checked, textContent: "",
    getAttribute: function(k){ return k in a ? a[k] : null; }, setAttribute: function(k, v){ a[k] = String(v); }, hasAttribute: function(k){ return k in a; },
    style: {setProperty: function(k, v){ st[k] = v; }}};
}
function form(){
  var els = [];
  ["e1:0", "e1:1", "e1:2", "e2:0"].forEach(function(k){
    els.push(fake({"data-wl-done": k}, "", false), fake({"data-wl-load": k}, k === "e1:0" ? 60 : ""), fake({"data-wl-rir": k}, ""));
  });
  els.push(fake({id: "wlRpe"}, 7), fake({id: "wlRpeVal"}, ""));
  function match(sel){
    var m = /^\[(data-wl-\w+)="([^"]+)"\]$/.exec(sel); if (m) return els.filter(function(e){ return e.getAttribute(m[1]) === m[2]; });
    if (sel === "#wlRpe") return els.filter(function(e){ return e.getAttribute("id") === "wlRpe"; });
    if (sel === "#wlRpeVal") return els.filter(function(e){ return e.getAttribute("id") === "wlRpeVal"; });
    if (sel === "[data-wl-done]") return els.filter(function(e){ return e.hasAttribute("data-wl-done"); });
    return [];
  }
  return {els: els, querySelector: function(s){ return match(s)[0] || null; }, querySelectorAll: function(s){ return match(s); }};
}
var drafts = [];
function rec(t){ drafts.push(t); }

var f = form(), b0 = f.querySelector('[data-wl-done="e1:0"]');
f.querySelector('[data-wl-rir="e1:0"]').value = "2"; b0.checked = true;
wlCopyToNextSet(f, b0, rec);
check.check("1. Ao fazer a série 1, a série 2 do mesmo exercício herda a carga (60) e o RIR (2)", f.querySelector('[data-wl-load="e1:1"]').value === "60" && f.querySelector('[data-wl-rir="e1:1"]').value === "2");
check.check("2. A série 3 e o outro exercício não são tocados", f.querySelector('[data-wl-load="e1:2"]').value === "" && f.querySelector('[data-wl-load="e2:0"]').value === "");
var f2 = form(), c0 = f2.querySelector('[data-wl-done="e1:0"]'), l1 = f2.querySelector('[data-wl-load="e1:1"]');
l1.value = "55"; l1.setAttribute("data-touched", "1"); c0.checked = true;
wlCopyToNextSet(f2, c0, rec);
check.check("3. Uma carga que o aluno já escreveu na série seguinte não é sobrescrita", l1.value === "55");
var f3 = form(), d0 = f3.querySelector('[data-wl-done="e1:0"]'), d1 = f3.querySelector('[data-wl-done="e1:1"]');
d1.checked = true; f3.querySelector('[data-wl-load="e1:1"]').value = "50"; d0.checked = true;
wlCopyToNextSet(f3, d0, rec);
check.check("4. Uma série seguinte já feita não é alterada", f3.querySelector('[data-wl-load="e1:1"]').value === "50");

var g = form(), gd = g.querySelectorAll("[data-wl-done]");
gd[0].checked = true; g.querySelector('[data-wl-rir="e1:0"]').value = "2";
gd[1].checked = true; g.querySelector('[data-wl-rir="e1:1"]').value = "1";
wlSuggestSessionRpe(g, rec);
check.check("5. Esforço da sessão = 10 − média do RIR (média 1,5 → 8,5 → 9 com arredondamento): 9", g.querySelector("#wlRpe").value === "9" && g.querySelector("#wlRpeVal").textContent === "9");
var h = form(); h.querySelectorAll("[data-wl-done]")[0].checked = true;
wlSuggestSessionRpe(h, rec);
check.check("6. Sem nenhum RIR preenchido o esforço fica como estava (7)", h.querySelector("#wlRpe").value === "7");
var k = form(); k.querySelector("#wlRpe").setAttribute("data-manual", "1");
var kd = k.querySelectorAll("[data-wl-done]"); kd[0].checked = true; k.querySelector('[data-wl-rir="e1:0"]').value = "0";
wlSuggestSessionRpe(k, rec);
check.check("7. Se o aluno mexeu no seletor do esforço, a app já não o muda", k.querySelector("#wlRpe").value === "7");
var src = appSource;
check.check("8. A última série do treino pára o descanso em vez de o iniciar", /allBoxes\[allBoxes\.length - 1\] === box\)\{ restTimerStop\(\); return; \}/.test(src));
check.check("9. O profissional tem os atalhos «Falha» e «Dropset» nas repetições", /data-reps-chip="Falha"/.test(src) && /data-reps-chip="Dropset"/.test(src));
check.check("10. «Falha» e «Dropset» ficam guardados nas repetições do exercício e não geram sugestão de carga", (function(){ var s = {}, d = addTrainingDay(s, "A"); var e = addProgramExercise(s, d.id, {name: "Supino", sets: "3", reps: "Falha"}), e2 = addProgramExercise(s, d.id, {name: "Remada", sets: "2", reps: "Dropset"}); return e.reps === "Falha" && e2.reps === "Dropset" && overloadSuggestion(s, e) === null; })());
check.summarize();
