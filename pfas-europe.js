// Bouygues Construction example: PFAS remediation and destruction startups in Europe.
// buildPfasReport(dealroomGet) returns one JSON object; server.js caches it in data/pfas-europe.json
// and serves it to the page in public/pfas-europe.html.

const EUROPE = 76; // location id of region/europe
const PFAS = 2284101; // taxonomy id of sector/pfas, found with /reference/filters/taxonomy_id/values?q=pfas
const HQ = `hq_location[in_any]:${EUROPE}`;

// Neighbouring tags, counted for context only (they are far broader than PFAS).
const ADJACENT = {
  "Remediation": 73001,
  "Soil Restoration": 2263801,
  "Water Purification": 2241601,
  "Wastewater Treatment": 2092301,
};

// The PFAS tag also covers PFAS-free alternatives (energy storage, coatings, membranes) and a few unrelated companies.
// We keep only companies that capture, destroy or clean up PFAS, and sort them into three segments by hand.
const SEGMENTS = {
  "Water capture and filtration": ["Puraffinity", "Porelio", "Cornelsen Umwelttechnologie", "Chromafora", "NX Filtration"],
  "Destruction and biological treatment": ["Oxyle", "PFASuiki", "Graphec", "TECTERO BV", "Cambiotics", "CellX Biosolutions"],
  "Soil and sediment": ["Haemers Technologies", "Blauwe Bagger"],
};

const hq = (e) => e.locations?.find((l) => l.role === "hq");

export async function buildPfasReport(dealroomGet) {
  let credits = 0;
  const warnings = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const total = async (label, filter) => {
    try {
      return (await get("/data/companies", { view: "summary", limit: 1, include_total: true, filter })).page?.total ?? null;
    } catch (err) {
      warnings.push(`${label}: ${err.message}`);
      return null;
    }
  };

  // The query funnel: how specific the search is at each step.
  const worldwide = await total("PFAS worldwide", `and(taxonomy_id[in_any]:${PFAS})`);
  const adjacent = {};
  for (const [name, id] of Object.entries(ADJACENT)) adjacent[name] = await total(name, `and(taxonomy_id[in_any]:${id},${HQ})`);

  const all = await get("/data/companies", {
    view: "summary", limit: 100, sort: "-total_funding", include_total: true,
    filter: `and(taxonomy_id[in_any]:${PFAS},${HQ})`,
  });

  const segmentOf = (name) => Object.keys(SEGMENTS).find((s) => SEGMENTS[s].includes(name)) ?? null;
  const company = (c) => ({
    name: c.name,
    segment: segmentOf(c.name),
    city: hq(c)?.city?.name ?? null,
    country: hq(c)?.country?.name ?? null,
    lat: hq(c)?.lat ?? null,
    lon: hq(c)?.lon ?? null,
    founded: c.launch_date,
    tagline: c.tagline,
    logo: c.image ? (c.image.startsWith("http") ? c.image : `https://${c.image}`) : null,
    employees: c.employees_count,
    funding: c.funding?.total ?? null,
    spinout: (c.taxonomy ?? []).some((t) => t.name === "Spinout"),
    url: c.dealroom_url,
  });
  const rows = all.data.map(company);
  const inScope = rows.filter((c) => c.segment);
  const outOfScope = rows.filter((c) => !c.segment).map((c) => ({ name: c.name, country: c.country, tagline: c.tagline, url: c.url }));

  const segments = Object.keys(SEGMENTS).map((name) => {
    const cs = inScope.filter((c) => c.segment === name);
    return { name, companies: cs.length, funding: cs.reduce((s, c) => s + (c.funding ?? 0), 0) };
  });
  const byCountry = new Map();
  for (const c of inScope) {
    const t = byCountry.get(c.country) ?? { country: c.country, companies: 0, funding: 0 };
    t.companies += 1;
    t.funding += c.funding ?? 0;
    byCountry.set(c.country, t);
  }

  return {
    generatedAt: new Date().toISOString(),
    creditsUsed: credits,
    warnings,
    scope: { locationId: EUROPE, pfasTaxonomyId: PFAS, adjacentTaxonomyIds: ADJACENT },
    funnel: { worldwide, europe: all.page?.total ?? rows.length, inScope: inScope.length },
    adjacent,
    kpis: {
      companies: inScope.length,
      countries: byCountry.size,
      totalFunding: inScope.reduce((s, c) => s + (c.funding ?? 0), 0),
      createdSince2020: inScope.filter((c) => (c.founded ?? "0") >= "2020").length,
      spinouts: inScope.filter((c) => c.spinout).length,
    },
    segments,
    countries: [...byCountry.values()].sort((a, b) => b.companies - a.companies || b.funding - a.funding),
    companies: inScope,
    outOfScope,
  };
}
