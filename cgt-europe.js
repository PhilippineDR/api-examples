// Challenge 3: cell & gene therapy (CGT) sub-sector analysis for Europe.
// buildCgtReport(dealroomGet) collects everything from the Dealroom API and returns one JSON object.
// server.js caches it in data/cgt-europe.json and serves it to the page in public/cgt-europe.html.

const EUROPE = 76; // location id of region/europe
const FROM_YEAR = 2021; // "last 5 years"
const HQ = `hq_location[in_any]:${EUROPE}`;

// Taxonomy ids found with /reference/filters/taxonomy_id/values?q=...
const SEGMENTS = {
  "Gene Therapy": 1544701,
  "Cell Therapy": 2199201,
  "CRISPR": 1382201,
  "T-Cell": 2246801,
  "Stem Cells": 771001,
  "Viral Vectors": 2297301,
  "RNA": 1634301,
  "mRNA Medicines": 2167701,
  "Antisense Nucleic Acid Drugs": 2199401,
};
const CORE = Object.values(SEGMENTS).join("|");
// "Genome Engineering" (1860901) is left out: it is a broad genomics/tools tag (diagnostics, sequencing, big pharma).
// "Cell Manufacturers" (2265201) is left out: it means battery cells (Northvolt).
const ENABLERS = "2279801"; // Biomanufacturing (also covers synthetic biology and industrial biotech)

const hq = (e) => e.locations?.find((l) => l.role === "hq");

export async function buildCgtReport(dealroomGet) {
  let credits = 0;
  const warnings = [];

  // The API rate-limits bursts (429): run calls one at a time and retry with backoff.
  let queue = Promise.resolve();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function get(path, params) {
    const run = async () => {
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
    };
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  }
  async function safe(label, fn, fallback) {
    try {
      return await fn();
    } catch (err) {
      warnings.push(`${label}: ${err.message}`);
      return fallback;
    }
  }
  const agg = (source, params) => get(`/analytics/aggregate/${source}`, params).then((b) => b.data);
  const company = (c) => ({
    name: c.name,
    city: hq(c)?.city?.name ?? null,
    country: hq(c)?.country?.name ?? null,
    founded: c.launch_date,
    tagline: c.tagline,
    employees: c.employees_count,
    funding: c.funding?.total ?? null,
    valuation: c.valuation?.value ?? null,
    status: c.status,
    classifications: c.classifications ?? [],
    url: c.dealroom_url,
  });
  const list = (params) => get("/data/companies", { view: "summary", ...params }).then((b) => b.data.map(company));
  const inCore = `and(${HQ},taxonomy_id[in_any]:${CORE}`;

  // --- Size and funding -----------------------------------------------------------
  const [coreByCountry, createdByCountry, enablersByCountry, creation, fundingByYear, fundingByCountry, unicornCount] = [
    await safe("core by country", () => agg("companies", { metric: "count,sum:total_funding", group_by: "hq_country", sort: "-count", limit: 80, filter: `${inCore})` }), []),
    await safe("created by country", () => agg("companies", { metric: "count", group_by: "hq_country", sort: "-count", limit: 80, filter: `${inCore},launch_year[gte]:${FROM_YEAR})` }), []),
    await safe("enablers by country", () => agg("companies", { metric: "count,sum:total_funding", group_by: "hq_country", sort: "-count", limit: 80, filter: `and(${HQ},taxonomy_id[in_any]:${ENABLERS})` }), []),
    await safe("creation", () => agg("companies", { metric: "count,sum:total_funding", group_by: "launch_year", sort: "dimension", limit: 30, filter: `${inCore},launch_year[gte]:2015)` }), []),
    await safe("funding by year", () => agg("funding-rounds", { metric: "count,sum:amount,count_distinct:entity_id", group_by: "year", sort: "dimension", limit: 20, filter: `${inCore},year[gte]:${FROM_YEAR},is_vc_round[eq]:true)` }), []),
    await safe("funding by country", () => agg("funding-rounds", { metric: "count,sum:amount", group_by: "hq_country", sort: "-sum_amount", limit: 15, filter: `${inCore},year[gte]:${FROM_YEAR},is_vc_round[eq]:true)` }), []),
    await safe("unicorns", () => agg("companies", { metric: "count", group_by: "hq_country", limit: 1, filter: `${inCore},classification[in_any]:unicorn|thoroughbred)` }), []),
  ];

  // --- Sub-segments ---------------------------------------------------------------
  const segments = [];
  for (const [name, id] of Object.entries(SEGMENTS)) {
    segments.push(await safe(`segment ${name}`, async () => {
      const [all, recent] = [
        await agg("companies", { metric: "count,sum:total_funding", group_by: "hq_country", limit: 80, filter: `and(${HQ},taxonomy_id[in_any]:${id})` }),
        await agg("companies", { metric: "count", group_by: "hq_country", limit: 80, filter: `and(${HQ},taxonomy_id[in_any]:${id},launch_year[gte]:${FROM_YEAR})` }),
      ];
      const t = (rows, k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
      return { name, companies: t(all, "count"), funding: t(all, "sum_total_funding"), createdSince: t(recent, "count") };
    }, { name, companies: 0, funding: 0, createdSince: 0 }));
  }

  // --- Company leaderboards -------------------------------------------------------
  const lists = {
    topFunded: await safe("top funded", () => list({ limit: 25, sort: "-total_funding", filter: `${inCore})` }), []),
    topPrivate: await safe("top private", () => list({ limit: 25, sort: "-total_funding", filter: `${inCore},classification[in_any]:vc_backed)` }), []),
    newcomers: await safe("newcomers", () => list({ limit: 15, sort: "-total_funding", filter: `${inCore},launch_year[gte]:${FROM_YEAR})` }), []),
    unicorns: await safe("unicorn list", () => list({ limit: 15, sort: "-total_funding", filter: `${inCore},classification[in_any]:unicorn|thoroughbred)` }), []),
    enablers: await safe("enablers", () => list({ limit: 12, sort: "-total_funding", filter: `and(${HQ},taxonomy_id[in_any]:${ENABLERS})` }), []),
  };

  // --- Investors: capital deployed (each round's amount split equally between its investors)
  const rounds = [];
  await safe("rounds", async () => {
    let cursor;
    do {
      const b = await get("/data/transactions", {
        view: "summary", limit: 100, sort: "-date", ...(cursor ? { cursor } : {}),
        filter: `${inCore},year[gte]:${FROM_YEAR},is_vc_round[eq]:true)`,
      });
      rounds.push(...b.data);
      cursor = b.page?.next_cursor;
    } while (cursor && rounds.length < 1500);
  }, null);
  const tally = new Map();
  let roundsWithAmount = 0;
  for (const r of rounds) {
    const invs = (r.investors ?? []).filter((x) => x.investor);
    if (r.amount) roundsWithAmount += 1;
    for (const { investor: inv, is_lead } of invs) {
      const t = tally.get(inv.uuid) ?? { name: inv.name, uuid: inv.uuid, person: inv.type === "person", url: inv.dealroom_url, deals: 0, leads: 0, companies: new Set(), capital: 0 };
      t.deals += 1;
      if (is_lead) t.leads += 1;
      t.companies.add(r.company?.name);
      t.capital += r.amount && invs.length ? r.amount / invs.length : 0;
      tally.set(inv.uuid, t);
    }
  }
  const top = [...tally.values()].filter((t) => !t.person).sort((a, b) => b.capital - a.capital).slice(0, 30);
  const invInfo = new Map();
  await safe("investor details", async () => {
    const b = await get("/data/investors", { view: "summary", limit: 100, filter: `id[in_any]:${top.map((t) => t.uuid).join("|")}` });
    for (const i of b.data) invInfo.set(i.uuid, i);
  }, null);
  const investors = top.map((t) => {
    const i = invInfo.get(t.uuid);
    return {
      name: t.name,
      url: i?.dealroom_url ?? t.url ?? null,
      city: hq(i ?? {})?.city?.name ?? null,
      country: hq(i ?? {})?.country?.name ?? null,
      types: (i?.types ?? []).map((x) => x.name),
      capital: Math.round(t.capital),
      deals: t.deals,
      leads: t.leads,
      companies: t.companies.size,
    };
  });

  const vcRounds = fundingByYear.reduce((s, r) => s + r.count, 0);
  const vcAmount = fundingByYear.reduce((s, r) => s + (r.sum_amount ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    scope: { name: "Cell & gene therapy, Europe", locationId: EUROPE, fromYear: FROM_YEAR, segments: SEGMENTS, enablers: ENABLERS },
    creditsUsed: credits,
    warnings,
    kpis: {
      companies: coreByCountry.reduce((a, r) => a + r.count, 0),
      totalFunding: coreByCountry.reduce((a, r) => a + (r.sum_total_funding ?? 0), 0),
      createdSince: createdByCountry.reduce((s, r) => s + r.count, 0),
      vcRounds, vcAmount,
      vcCompanies: fundingByYear.reduce((m, r) => Math.max(m, r.count_distinct_entity_id ?? 0), 0),
      unicorns: unicornCount.reduce((a, r) => a + r.count, 0),
      enablers: enablersByCountry.reduce((s, r) => s + r.count, 0),
      roundsAnalysed: rounds.length,
      roundsWithAmount,
    },
    countries: coreByCountry.map((r) => ({
      country: r.dimension, companies: r.count, funding: r.sum_total_funding ?? 0,
      createdSince: createdByCountry.find((c) => c.dimension === r.dimension)?.count ?? 0,
      vcSince: fundingByCountry.find((c) => c.dimension === r.dimension)?.sum_amount ?? 0,
    })),
    enablersByCountry: enablersByCountry.map((r) => ({ country: r.dimension, companies: r.count, funding: r.sum_total_funding ?? 0 })),
    creation: creation.map((r) => ({ year: r.dimension, created: r.count, funding: r.sum_total_funding ?? 0 })),
    fundingByYear: fundingByYear.map((r) => ({ year: r.dimension, rounds: r.count, amount: r.sum_amount ?? 0, companies: r.count_distinct_entity_id })),
    segments,
    companies: lists,
    investors,
  };
}
