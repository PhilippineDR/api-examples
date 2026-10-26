// Bouygues Construction example: PFAS remediation and destruction startups in Europe.
// buildPfasReport(dealroomGet) returns one JSON object; server.js caches it in data/pfas-europe.json
// and serves it to the page in public/pfas-europe-9qntdi.html.
//
// Two groups:
//  1. PFAS specialists: companies in Dealroom's PFAS sector tag, whose core business is PFAS;
//  2. broader players: European remediation and water-treatment companies screened for PFAS in their tagline and
//     description, to include those that have also developed a PFAS solution.
// A full rebuild costs about 730 credits, almost all of it the screening pages.

const EUROPE = 76; // location id of region/europe
const PFAS = 2284101; // taxonomy id of sector/pfas, found with /reference/filters/taxonomy_id/values?q=pfas
const HQ = `hq_location[in_any]:${EUROPE}`;
const PAGE_SIZE = 100;

// Remediation and water-treatment tags whose companies are screened for a PFAS solution in their tagline and description.
const ADJACENT = {
  "Remediation": 73001,
  "Soil Restoration": 2263801,
  "Water Purification": 2241601,
  "Wastewater Treatment": 2092301,
};
const PFAS_TERMS = /pfas|pfoa|pfos|per-? ?and poly|polyfluor|perfluor|forever chemical|fluorinated|micropollutant|emerging contaminant/i;

// Kept companies, by segment. Both sources were reviewed by hand: we keep companies that capture, destroy or
// clean up PFAS as a real part of their business, and leave out PFAS-free alternatives and passing mentions.
const SEGMENTS = {
  "Water capture and filtration": [
    "Puraffinity", "Porelio", "Cornelsen Umwelttechnologie", "Chromafora", "NX Filtration",
    "Molymem", "Mivanor", "HydroPhoX", "Mellagic", "LivingFilters", "Pure Capture Innovations Ltd", "Global Water Nanotechnologies s.r.o.", "Hydrogenium",
  ],
  "Destruction and biological treatment": [
    "Oxyle", "PFASuiki", "Graphec", "TECTERO BV", "Cambiotics", "CellX Biosolutions",
    "Tales of Land", "AquaPurify Solutions", "Daphne Water Solution",
  ],
  "Soil and sediment": ["Haemers Technologies", "Blauwe Bagger", "Intrapore GmbH", "Anthera Remediation Technologies", "Dekonta, a.s."],
};

// Why screened companies that mention PFAS were left out (anything not listed: "Mentions PFAS only in passing").
const HOUSEHOLD = "Household or tap-water filter";
const EXCLUDE_REASON = {
  "Mongalet": HOUSEHOLD, "Naturally": HOUSEHOLD, "Duryn": HOUSEHOLD, "Elvion Water Ireland": HOUSEHOLD,
  "Airspring GmbH": HOUSEHOLD, "Eternal-Water": HOUSEHOLD, "ECOfilter": HOUSEHOLD,
  "Life Neophyta": "Research project, not a company", "Luthy Group": "Research group, not a company",
};
const PASSING_MENTION = "Mentions PFAS only in passing";

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
  async function listAll(filter) {
    const rows = [];
    let cursor;
    do {
      const b = await get("/data/companies", { view: "summary", limit: PAGE_SIZE, filter, ...(cursor ? { cursor } : {}) });
      rows.push(...b.data);
      cursor = b.page?.next_cursor;
    } while (cursor);
    return rows;
  }

  const worldwide = await total("PFAS worldwide", `and(taxonomy_id[in_any]:${PFAS})`);
  const adjacent = {};
  for (const [name, id] of Object.entries(ADJACENT)) adjacent[name] = await total(name, `and(taxonomy_id[in_any]:${id},${HQ})`);

  // Source 1: the PFAS tag. Source 2: neighbouring tags, screened for PFAS terms.
  const tagged = await listAll(`and(taxonomy_id[in_any]:${PFAS},${HQ})`);
  const taggedNames = new Set(tagged.map((c) => c.name));
  const screened = await listAll(`and(taxonomy_id[in_any]:${Object.values(ADJACENT).join("|")},${HQ})`);
  const mentions = screened.filter((c) => PFAS_TERMS.test(`${c.tagline ?? ""} ${c.about ?? ""}`));
  const newMentions = mentions.filter((c) => !taggedNames.has(c.name));

  const segmentOf = (name) => Object.keys(SEGMENTS).find((s) => SEGMENTS[s].includes(name)) ?? null;
  const company = (c, source) => ({
    name: c.name,
    segment: segmentOf(c.name),
    source,
    city: hq(c)?.city?.name ?? null,
    country: hq(c)?.country?.name ?? null,
    founded: c.launch_date,
    tagline: c.tagline,
    logo: c.image ? (c.image.startsWith("http") ? c.image : `https://${c.image}`) : null,
    employees: c.employees_count,
    funding: c.funding?.total ?? null,
    spinout: (c.taxonomy ?? []).some((t) => t.name === "Spinout"),
    url: c.dealroom_url,
  });
  const fromTag = tagged.map((c) => company(c, "PFAS tag"));
  const fromScreening = newMentions.map((c) => company(c, "Description screening"));
  const inScope = [...fromTag, ...fromScreening].filter((c) => c.segment);
  const brief = (c) => ({ name: c.name, country: c.country, tagline: c.tagline, url: c.url });
  const outOfScope = fromTag.filter((c) => !c.segment).map(brief);
  const screenedOut = fromScreening.filter((c) => !c.segment).map((c) => ({ ...brief(c), reason: EXCLUDE_REASON[c.name] ?? PASSING_MENTION }));

  const missing = Object.values(SEGMENTS).flat().filter((n) => !inScope.some((c) => c.name === n));
  if (missing.length) warnings.push(`Not found in this build: ${missing.join(", ")}`);

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
    scope: { locationId: EUROPE, pfasTaxonomyId: PFAS, adjacentTaxonomyIds: ADJACENT, pfasTerms: PFAS_TERMS.source },
    funnel: {
      worldwide,
      europe: tagged.length,
      tagKept: fromTag.filter((c) => c.segment).length,
      screened: screened.length,
      mentions: mentions.length,
      newMentions: newMentions.length,
      screeningKept: fromScreening.filter((c) => c.segment).length,
      inScope: inScope.length,
    },
    adjacent,
    kpis: {
      companies: inScope.length,
      countries: byCountry.size,
      totalFunding: inScope.reduce((s, c) => s + (c.funding ?? 0), 0),
      spinouts: inScope.filter((c) => c.spinout).length,
    },
    segments,
    countries: [...byCountry.values()].sort((a, b) => b.companies - a.companies || b.funding - a.funding),
    companies: inScope,
    outOfScope,
    screenedOut,
  };
}
