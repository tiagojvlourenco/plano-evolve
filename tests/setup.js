// Configura o mínimo de "browser" (document/window/navigator) para que o código da app,
// escrito para correr num browser real, possa ser avaliado em Node sem rebentar.
// A app é uma única IIFE que, ao carregar, faz algumas chamadas inofensivas ao DOM a nível de
// topo (getElementById, querySelectorAll, addEventListener) — este stub cobre exatamente essas
// chamadas. Não simula um DOM completo: os testes correm sobre a lógica (cálculos, validações,
// gestão de estado), não sobre interações reais de UI.
function stubElement(){
  return {
    innerHTML: "",
    value: "",
    style: {},
    classList: {
      add: function () {},
      remove: function () {},
      toggle: function () {},
      contains: function () { return false; }
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    appendChild: function () {},
    remove: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    focus: function () {},
    setAttribute: function () {},
    getAttribute: function () { return null; }
  };
}

function setupDom(){
  global.window = global;
  global.document = {
    getElementById: function () { return stubElement(); },
    querySelectorAll: function () { return []; },
    createElement: function () { return stubElement(); },
    body: { appendChild: function () {} }
  };
  global.requestAnimationFrame = function (fn) { fn(); };
  global.navigator = {
    clipboard: { writeText: function () { return Promise.resolve(); } },
    credentials: { store: function () { return Promise.resolve(); } }
  };
}

module.exports = setupDom;
