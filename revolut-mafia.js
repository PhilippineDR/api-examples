// Challenge 4 (client: HV Capital): the "Revolut founder mafia".
// buildRevolutReport(dealroomGet) finds people who worked at Revolut, are founders and have since left,
// then adds the company each of them founded. server.js caches the result in data/revolut-mafia.json
// and serves it to public/revolut-mafia.html. A rebuild costs about 960 credits (~310 people at 2 each, ~340 companies at 1 each).

const REVOLUT = "bab26999-7eeb-4d42-ad8c-804d1da7b288"; // found with /reference/filters/employer_id/values?q=Revolut
const NOW = new Date("2026-10-26");

const hq = (e) => e.locations?.find((l) => l.role === "hq");
const year = (d) => (d ? Number(String(d).slice(0, 4)) : null);
const tag = (c, type) => (c.taxonomy ?? []).filter((t) => t.type === type).map((t) => t.name);
const money = (n) => (n == null ? null : n);

export async function buildRevolutReport(dealroomGet) {
  let credits = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The API rate-limits bursts (429): one call at a time, retry with backoff.
  async function get(path, params) {
    for (let attempt = 0; ; attempt++) {
      const res = await dealroomGet(`${path}?${new URLSearchParams(params)}`);
      if ((res.status === 429 || res.status === 500) && attempt < 6) {
        await sleep(Number(res.headers.get("retry-after") ?? 0) * 1000 || 1500 * (attempt + 1));
        continue;
      }
      credits += Number(res.headers.get("x-credits-used") ?? 0);
      const body = await res.json();
      if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(body.error ?? body)}`);
      await sleep(250);
      return body;
    }
  }

  // 1. Founders who worked at Revolut and no longer work there (best signal first, the API default).
  const filter = `and(employer_id[eq]:${REVOLUT},roles[in_any]:founder,current_employer_id[neq]:${REVOLUT})`;
  const people = [];
  let cursor;
  do {
    const b = await get("/data/people", { filter, limit: 100, include_total: "true", ...(cursor ? { cursor } : {}) });
    people.push(...b.data);
    cursor = b.page.next_cursor;
  } while (cursor && people.length < 500);

  // 2. The companies they founded (the career preview holds up to 5 roles, founding roles first).
  const ids = [...new Set(people.flatMap((p) => p.career.items.filter((i) => i.is_founder && i.company.uuid !== REVOLUT).map((i) => i.company.uuid)))];
  const companies = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const b = await get("/data/companies", { filter: `id[in_any]:${ids.slice(i, i + 40).join("|")}`, view: "summary", limit: 50 });
    for (const c of b.data) companies.set(c.uuid, c);
  }

  // 3. Shape each person + their main venture.
  const venture = (c, item) => ({
    id: c.uuid,
    name: c.name,
    image: c.image,
    tagline: c.tagline,
    url: c.dealroom_url,
    website: c.links?.website ?? null,
    city: hq(c)?.city?.name ?? null,
    country: hq(c)?.country?.name ?? null,
    launched: c.launch_date,
    status: c.status,
    stage: tag(c, "growth_stage")[0] ?? null,
    industry: tag(c, "industry")[0] ?? null,
    subIndustry: tag(c, "sub_industry")[0] ?? null,
    technology: tag(c, "technology"),
    sectorTags: tag(c, "sector"),
    ownership: tag(c, "ownership"),
    businessModel: tag(c, "business_model")[0] ?? null,
    employees: c.employees_count,
    employeeGrowth1y: c.employee_count_1y_growth,
    funding: money(c.funding?.total),
    rounds: c.funding?.rounds_count ?? 0,
    valuation: money(c.valuation?.value),
    stealth: tag(c, "sector").includes("Stealth Startup"),
    role: item.raw_title,
    current: !item.is_past,
  });

  const out = people.map((p) => {
    const rev = p.career.items.find((i) => i.company.uuid === REVOLUT);
    const ventures = p.career.items
      .filter((i) => i.is_founder && i.company.uuid !== REVOLUT && companies.has(i.company.uuid))
      .map((i) => venture(companies.get(i.company.uuid), i));
    // Main venture: a company they are still part of, the most recently launched one first.
    const main = [...ventures].sort((a, b) => (b.current - a.current) || String(b.launched).localeCompare(String(a.launched)))[0] ?? null;
    return {
      id: p.uuid,
      name: p.name,
      url: p.dealroom_url,
      linkedin: p.links?.linkedin ?? null,
      image: p.image,
      location: [hq(p)?.city?.name, hq(p)?.country?.name].filter(Boolean).join(", ") || null,
      country: hq(p)?.country?.name ?? null,
      signal: p.signal_rating,
      labels: p.classifications ?? [],
      backgrounds: (p.taxonomy ?? []).filter((t) => t.type === "background").map((t) => t.name),
      foundedCount: p.founded_companies?.count ?? null,
      foundedFunding: p.founded_companies?.total_funding ?? null,
      revolut: rev ? { title: rev.raw_title, titles: rev.titles, start: rev.start_date, end: rev.end_date } : null,
      education: (p.education?.items ?? []).slice(0, 2).map((e) => e.university?.name).filter(Boolean),
      careerTotal: p.career.total,
      main,
      ventures,
    };
  });

  return {
    generatedAt: NOW.toISOString().slice(0, 10),
    credits,
    totalFounders: people.length,
    people: out,
  };
}
