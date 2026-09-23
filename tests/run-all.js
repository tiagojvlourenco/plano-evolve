// Corre todos os ficheiros *.test.js desta pasta, cada um no seu próprio processo Node
// (cada ficheiro chama process.exit() no fim, por isso não podem correr no mesmo processo).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith(".test.js")).sort();

let totalPassed = 0, totalFailed = 0;
let anyFileFailed = false;

files.forEach(function (file) {
  console.log("\n=== " + file + " ===");
  const result = spawnSync(process.execPath, [path.join(dir, file)], { encoding: "utf8" });
  const output = (result.stdout || "") + (result.stderr || "");
  process.stdout.write(output);

  const match = output.match(/(\d+) passaram, (\d+) falharam/);
  if (match) {
    totalPassed += parseInt(match[1], 10);
    totalFailed += parseInt(match[2], 10);
  } else {
    anyFileFailed = true;
    console.log("AVISO: não consegui interpretar o resultado de " + file);
  }
  if (result.status !== 0) anyFileFailed = true;
});

console.log("\n===================================");
console.log("TOTAL: " + totalPassed + " passaram, " + totalFailed + " falharam (em " + files.length + " ficheiros)");
process.exit(anyFileFailed || totalFailed > 0 ? 1 : 0);
