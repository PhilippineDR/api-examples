// Builds the static GitHub Pages site in docs/ from the cached Revolut data (no server or API call needed).
// Run: npm run build:pages   (refresh the data first with /api/revolut-mafia-1gw5ua?refresh=1 if you want newer numbers)
// The page lives under an unguessable folder, so its address is https://philippinedr.github.io/api-examples/revolut-mafia-1gw5ua/
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

const SLUG = "revolut-mafia-1gw5ua";
const DATA = "data/revolut-mafia.json";
if (!existsSync(DATA)) {
  console.error(`Missing ${DATA}. Start the server and open /api/${SLUG} once to build it.`);
  process.exit(1);
}

rmSync("docs", { recursive: true, force: true });
mkdirSync(`docs/${SLUG}`, { recursive: true });
copyFileSync(DATA, `docs/${SLUG}/revolut-mafia.json`);

const html = readFileSync(`public/${SLUG}.html`, "utf8");
const call = `fetch("/api/${SLUG}")`;
if (!html.includes(call)) throw new Error("Could not find the data fetch in the page");
writeFileSync(`docs/${SLUG}/index.html`, html.replace(call, 'fetch("revolut-mafia.json")'));
writeFileSync("docs/.nojekyll", "");
console.log(`docs/${SLUG}/ ready: index.html + revolut-mafia.json`);
