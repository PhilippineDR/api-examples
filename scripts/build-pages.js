// Builds the static GitHub Pages site in docs/ from the cached Revolut data (no server or API call needed).
// Run: npm run build:pages   (refresh the data first with /api/revolut-mafia?refresh=1 if you want newer numbers)
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const DATA = "data/revolut-mafia.json";
if (!existsSync(DATA)) {
  console.error(`Missing ${DATA}. Start the server and open /api/revolut-mafia once to build it.`);
  process.exit(1);
}

mkdirSync("docs/data", { recursive: true });
copyFileSync(DATA, "docs/data/revolut-mafia.json");

const html = readFileSync("public/revolut-mafia.html", "utf8");
if (!html.includes('fetch("/api/revolut-mafia")')) throw new Error("Could not find the data fetch in the page");
writeFileSync("docs/index.html", html.replace('fetch("/api/revolut-mafia")', 'fetch("data/revolut-mafia.json")'));
writeFileSync("docs/.nojekyll", "");
console.log("docs/ ready: index.html + data/revolut-mafia.json");
