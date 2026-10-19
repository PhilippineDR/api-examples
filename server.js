import express from "express";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { buildReport, refreshUniversities } from "./marseille-aix.js";
import { buildCgtReport } from "./cgt-europe.js";

dotenv.config();

const { DEALROOM_CLIENT_ID, DEALROOM_CLIENT_SECRET, PORT = 3000 } = process.env;

if (!DEALROOM_CLIENT_ID || !DEALROOM_CLIENT_SECRET) {
  console.error("[startup] Missing DEALROOM_CLIENT_ID or DEALROOM_CLIENT_SECRET in .env");
  process.exit(1);
}

const API_BASE = "https://api.beta.dealroom.app";
const USER_AGENT = "api-training/1.0";
const TOKEN_FILE = ".token";

// --- Token -------------------------------------------------------------------
// Cached in .token and reused until 5 minutes before it expires (tokens last 24h).
let cached = existsSync(TOKEN_FILE) ? JSON.parse(readFileSync(TOKEN_FILE, "utf8")) : null;

async function getToken(force = false) {
  if (!force && cached && cached.expiresAt - 300_000 > Date.now()) return cached.token;
  const res = await fetch("https://accounts.dealroom.co/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      client_id: DEALROOM_CLIENT_ID,
      client_secret: DEALROOM_CLIENT_SECRET,
      audience: "https://api.beta.dealroom.app",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
  const body = await res.json();
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  writeFileSync(TOKEN_FILE, JSON.stringify(cached), { mode: 0o600 });
  return cached.token;
}

// GET a path on the Dealroom API (e.g. "/data/companies?limit=5"). Refreshes the token once on 401.
async function dealroomGet(pathAndQuery) {
  const call = async (token) =>
    fetch(API_BASE + pathAndQuery, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Client-Id": DEALROOM_CLIENT_ID,
        "User-Agent": USER_AGENT,
      },
    });
  let res = await call(await getToken());
  if (res.status === 401) res = await call(await getToken(true));
  return res;
}

// Top 10 VC-backed companies launched since 2020, by valuation (the setup guide's first request).
async function topCompanies() {
  const q = new URLSearchParams({
    sort: "-latest_valuation",
    limit: "10",
    include_total: "true",
    filter: "and(classification[in_any]:vc_backed,launch_date[gte]:2020)",
  });
  const res = await dealroomGet(`/data/companies?${q}`);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${await res.text()}`);
  const body = await res.json();
  return {
    total: body.page?.total ?? null,
    creditsUsed: res.headers.get("x-credits-used"),
    companies: body.data.map((c) => ({
      name: c.name,
      hq_country: c.locations?.find((l) => l.role === "hq")?.country?.name ?? null,
      launch_date: c.launch_date,
      valuation: c.valuation?.value ?? null,
    })),
  };
}

// --- CLI: `npm run verify` prints the top-10 table and exits -------------------
if (process.argv[2] === "verify") {
  const { total, creditsUsed, companies } = await topCompanies();
  console.table(companies);
  console.log(`Total matches: ${total} | credits used: ${creditsUsed}`);
  process.exit(0);
}

// --- Server ------------------------------------------------------------------
const app = express();

app.use((req, res, next) => {
  res.on("finish", () =>
    console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode}`),
  );
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/companies/top", async (req, res) => {
  try {
    res.json(await topCompanies());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Pass any GET on /data/..., /reference/... or /analytics/... through to the Dealroom API, auth added.
app.get(/^\/(data|reference|analytics)\//, async (req, res) => {
  try {
    const upstream = await dealroomGet(req.originalUrl);
    const credits = upstream.headers.get("x-credits-used");
    if (credits) res.set("X-Credits-Used", credits);
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") ?? "application/json")
      .send(await upstream.text());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Challenge 2: Aix-Marseille-Provence ecosystem report. Cached on disk because a full build costs credits;
// add ?refresh=1 to rebuild.
const REPORT_FILE = "data/marseille-aix.json";
app.get("/api/marseille-aix", async (req, res) => {
  try {
    if (!req.query.refresh && existsSync(REPORT_FILE)) return res.type("json").send(readFileSync(REPORT_FILE, "utf8"));
    const report = await buildReport(dealroomGet);
    mkdirSync("data", { recursive: true });
    writeFileSync(REPORT_FILE, JSON.stringify(report));
    res.json(report);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Challenge 3: European cell & gene therapy report, cached the same way.
const CGT_FILE = "data/cgt-europe.json";
app.get("/api/cgt-europe", async (req, res) => {
  try {
    if (!req.query.refresh && existsSync(CGT_FILE)) return res.type("json").send(readFileSync(CGT_FILE, "utf8"));
    const report = await buildCgtReport(dealroomGet);
    mkdirSync("data", { recursive: true });
    writeFileSync(CGT_FILE, JSON.stringify(report));
    res.json(report);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
app.get("/api/marseille-aix/refresh-universities", async (req, res) => {
  try {
    const next = await refreshUniversities(dealroomGet, JSON.parse(readFileSync(REPORT_FILE, "utf8")));
    writeFileSync(REPORT_FILE, JSON.stringify(next));
    res.json({ universities: next.universities.length, creditsUsed: next.creditsUsed, warnings: next.warnings });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
app.use(express.static("public", { extensions: ["html"] }));

app.use((req, res) => res.status(404).json({ error: "Not found. Try /health, /companies/top, /data/... or /reference/..." }));

app.listen(PORT, () => {
  console.log("Phillippine's server is running");
  console.log(`[startup] Dealroom server on http://localhost:${PORT}`);
});
