import express from "express";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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

// Pass any GET on /data/... or /reference/... through to the Dealroom API, auth added.
app.get(/^\/(data|reference)\//, async (req, res) => {
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

app.use((req, res) => res.status(404).json({ error: "Not found. Try /health, /companies/top, /data/... or /reference/..." }));

app.listen(PORT, () => {
  console.log("Phillippine's server is running");
  console.log(`[startup] Dealroom server on http://localhost:${PORT}`);
});
