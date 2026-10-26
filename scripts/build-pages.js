// Builds the static GitHub Pages site in docs/ from the cached data (no server or API call needed).
// Run: npm run build:pages   (refresh the data first with /api/<slug>?refresh=1 if you want newer numbers)
// Each page lives under an unguessable folder, e.g. https://philippinedr.github.io/api-examples/revolut-mafia-1gw5ua/
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

const PAGES = [
  { slug: "revolut-mafia-1gw5ua", data: "data/revolut-mafia.json", file: "revolut-mafia.json" },
  { slug: "pfas-europe-9qntdi", data: "data/pfas-europe.json", file: "pfas-europe.json" },
];

rmSync("docs", { recursive: true, force: true });
for (const { slug, data, file } of PAGES) {
  if (!existsSync(data)) {
    console.error(`Missing ${data}. Start the server and open /api/${slug} once to build it.`);
    process.exit(1);
  }
  mkdirSync(`docs/${slug}`, { recursive: true });
  copyFileSync(data, `docs/${slug}/${file}`);

  const html = readFileSync(`public/${slug}.html`, "utf8");
  const call = `fetch("/api/${slug}")`;
  if (!html.includes(call)) throw new Error(`Could not find the data fetch in ${slug}`);
  writeFileSync(`docs/${slug}/index.html`, html.replace(call, `fetch("${file}")`));
  console.log(`docs/${slug}/ ready: index.html + ${file}`);
}
writeFileSync("docs/.nojekyll", "");
