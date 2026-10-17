// Challenge 2: innovation ecosystem report for the Aix-Marseille-Provence Metropole.
// buildReport(dealroomGet) collects everything from the Dealroom API and returns one JSON object.
// server.js caches it in data/marseille-aix.json and serves it to the page in public/.

const LOC = 3075; // location id of "Aix-Marseille-Provence Metropolis"
const FROM_YEAR = 2021; // "last 5 years"
const IN_TERRITORY = `founding_or_hq_location[in_any]:${LOC}`;
const HQ = `hq_location[in_any]:${LOC}`;

// Sector focus: taxonomy ids found with /reference/filters/taxonomy_id/values?q=...
const SECTORS = {
  "Deeptech": "602|10402",
  "Biotech and health": "3004|359001|125403",
  "Marine and maritime": "483401|2126701|2212001",
  "Space and aerospace": "10015903|2103601|77501",
  "Digital and cyber": "1998401|2189301",
};

const hqCity = (e) => e.locations?.find((l) => l.role === "hq")?.city?.name ?? null;

export async function buildReport(dealroomGet) {
  let credits = 0;
  const warnings = [];

  // The API rate-limits bursts (429): run calls one at a time and retry with backoff.
  let queue = Promise.resolve();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function get(path, params) {
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        const res = await dealroomGet(`${path}?${new URLSearchParams(params)}`);
        if (res.status === 429 && attempt < 6) {
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
  // A failing block must not sink the whole report: record it and keep going.
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
    city: hqCity(c),
    founded: c.launch_date,
    tagline: c.tagline,
    employees: c.employees_count,
    growth1y: c.employee_count_1y_growth,
    funding: c.funding?.total ?? null,
    valuation: c.valuation?.value ?? null,
    status: c.status,
    classifications: c.classifications,
    url: c.dealroom_url,
    exitDate: c.exit_date,
  });
  const list = (params) => get("/data/companies", { view: "summary", ...params }).then((b) => b.data.map(company));

  const [
    totals, creation, closedByYear, fundingByYear, leakage, unicorns, exitedCount,
  ] = await Promise.all([
    safe("totals", () => agg("companies", { metric: "count,sum:total_funding", group_by: "hq_country", filter: IN_TERRITORY, limit: 1 }), []),
    safe("creation", () => agg("companies", { metric: "count,sum:total_funding", group_by: "launch_year", sort: "dimension", limit: 30, filter: `and(${IN_TERRITORY},launch_year[gte]:2015)` }), []),
    safe("closed", () => agg("companies", { metric: "count", group_by: "launch_year", sort: "dimension", limit: 30, filter: `and(${IN_TERRITORY},launch_year[gte]:2015,company_status[eq]:closed)` }), []),
    safe("fundingByYear", () => agg("funding-rounds", { metric: "count,sum:amount,count_distinct:entity_id", group_by: "year", sort: "dimension", limit: 20, filter: `and(${HQ},year[gte]:${FROM_YEAR},is_vc_round[eq]:true)` }), []),
    safe("leakage", () => agg("companies", { metric: "count", group_by: "hq_country", limit: 1, filter: `and(founding_location[in_any]:${LOC},hq_location[nin_any]:${LOC})` }), []),
    safe("unicorns", () => agg("companies", { metric: "count", group_by: "hq_country", limit: 1, filter: `and(${IN_TERRITORY},classification[in_any]:unicorn|thoroughbred)` }), []),
    safe("exited", () => agg("companies", { metric: "count", group_by: "hq_country", limit: 1, filter: `and(${IN_TERRITORY},classification[in_any]:exited)` }), []),
  ]);

  const byYear = {};
  for (const r of creation) byYear[r.dimension] = { year: r.dimension, created: r.count, funding: r.sum_total_funding ?? 0, closed: 0 };
  for (const r of closedByYear) if (byYear[r.dimension]) byYear[r.dimension].closed = r.count;

  // --- Sectors -----------------------------------------------------------------
  const sectors = await Promise.all(
    Object.entries(SECTORS).map(([name, ids]) =>
      safe(`sector ${name}`, async () => {
        const [all, recent] = await Promise.all([
          agg("companies", { metric: "count,sum:total_funding", group_by: "hq_country", limit: 1, filter: `and(${IN_TERRITORY},taxonomy_id[in_any]:${ids})` }),
          agg("companies", { metric: "count", group_by: "hq_country", limit: 1, filter: `and(${IN_TERRITORY},taxonomy_id[in_any]:${ids},launch_year[gte]:${FROM_YEAR})` }),
        ]);
        return { name, companies: all[0]?.count ?? 0, funding: all[0]?.sum_total_funding ?? 0, createdSince: recent[0]?.count ?? 0 };
      }, { name, companies: 0, funding: 0, createdSince: 0 }),
    ),
  );

  // --- Universities: alumni founders and spin-outs ------------------------------
  const universities = await safe("universities", async () => {
    const b = await get("/data/universities", { limit: 30, sort: "-alumni_founders_count", filter: `any_location[in_any]:${LOC}` });
    return b.data
      .filter((u) => u.alumni || u.spinouts_count)
      .map((u) => ({
        name: u.name,
        city: hqCity(u),
        url: u.dealroom_url,
        alumni: u.alumni?.count ?? 0,
        founders: u.alumni?.founders_count ?? 0,
        foundedCompanies: u.alumni?.founded_companies_count ?? 0,
        unicorns: u.alumni?.unicorn_companies_count ?? 0,
        spinouts: u.spinouts_count ?? 0,
        patents: u.patents?.count ?? null,
      }));
  }, []);

  // --- Accelerators and incubators ----------------------------------------------
  const accelerators = await safe("accelerators", async () => {
    const b = await get("/data/investors", { limit: 30, filter: `and(${IN_TERRITORY},investor_type[in_any]:accelerator|incubator)` });
    const rows = await Promise.all(
      b.data.map(async (a) => {
        // Outcomes of what each structure backed: funding raised, jobs, exits.
        const p = await safe(`portfolio ${a.name}`, () => get(`/data/investors/${a.uuid}/portfolio`, { view: "summary", limit: 100 }), { data: [], page: {} });
        const pc = (p.data ?? []).map((x) => x.company ?? x);
        return {
          name: a.name,
          city: hqCity(a),
          url: a.dealroom_url,
          kind: (a.types ?? []).map((t) => t.name).join(" / "),
          founded: a.launch_date,
          about: a.tagline,
          investments: a.investments?.count ?? 0,
          invested: a.investments?.total_invested ?? 0,
          lastRound: a.investments?.last_round_date ?? null,
          portfolio: pc.length,
          portfolioFunding: pc.reduce((s, c) => s + (c.funding?.total ?? 0), 0),
          portfolioJobs: pc.reduce((s, c) => s + (c.employees_count ?? 0), 0),
          portfolioExits: pc.filter((c) => c.status === "acquired" || c.classifications?.includes("exited")).length,
          portfolioActive: pc.filter((c) => c.status === "operational").length,
        };
      }),
    );
    return rows.sort((x, y) => y.portfolioFunding - x.portfolioFunding);
  }, []);

  // --- Investors: who writes the cheques (VC rounds into the territory) ----------
  const investorsBlock = await safe("investors", async () => {
    const rounds = [];
    let cursor;
    do {
      const b = await get("/data/transactions", {
        view: "summary", limit: 100, sort: "-date", include_total: "true", ...(cursor ? { cursor } : {}),
        filter: `and(${HQ},year[gte]:${FROM_YEAR},is_vc_round[eq]:true)`,
      });
      rounds.push(...b.data);
      cursor = b.page?.next_cursor;
    } while (cursor && rounds.length < 600);
    const tally = new Map();
    for (const r of rounds) {
      for (const { investor: inv, is_lead } of r.investors ?? []) {
        if (!inv) continue;
        const t = tally.get(inv.uuid) ?? { name: inv.name, uuid: inv.uuid, person: inv.type === "person", url: inv.dealroom_url, deals: 0, leads: 0, companies: new Set(), amount: 0 };
        t.deals += 1;
        if (is_lead) t.leads += 1;
        t.companies.add(r.company?.name);
        t.amount += r.amount ?? 0;
        tally.set(inv.uuid, t);
      }
    }
    return { rounds, tally: [...tally.values()] };
  }, { rounds: [], tally: [] });

  // Enrich the most active investors with their HQ and type (one batch call).
  const top = investorsBlock.tally.sort((a, b) => b.deals - a.deals).slice(0, 25);
  const invInfo = new Map();
  await safe("investor details", async () => {
    const ids = top.filter((t) => !t.person).map((t) => t.uuid);
    if (!ids.length) return;
    const b = await get("/data/investors", { view: "summary", limit: 100, filter: `id[in_any]:${ids.join("|")}` });
    for (const i of b.data) invInfo.set(i.uuid, i);
  }, null);
  const investors = top.map((t) => {
    const i = invInfo.get(t.uuid);
    const hq = i?.locations?.find((l) => l.role === "hq");
    return {
      name: t.name,
      url: i?.dealroom_url ?? t.url ?? null,
      person: t.person,
      leads: t.leads,
      deals: t.deals,
      companies: t.companies.size,
      amount: t.amount,
      city: hq?.city?.name ?? null,
      country: hq?.country?.name ?? null,
      local: !!hq && ["Marseille", "Aix-en-Provence", "Aubagne", "La Ciotat", "Gémenos", "Vitrolles", "Martigues", "Meyreuil"].includes(hq.city?.name),
      types: t.person ? ["business angel"] : (i?.types ?? []).map((x) => x.name),
    };
  });

  // --- Success stories -----------------------------------------------------------
  const [topFunded, topJobs, fastGrowers, scaleUps, spinouts, patents] = await Promise.all([
    safe("topFunded", () => list({ limit: 12, sort: "-total_funding", filter: `and(${IN_TERRITORY},classification[in_any]:vc_backed)` }), []),
    safe("topJobs", () => list({ limit: 12, sort: "-employees_count", filter: `and(${IN_TERRITORY},classification[in_any]:vc_backed|funded,launch_year[gte]:2000,total_funding[gte]:1000000)` }), []),
    safe("fastGrowers", () => list({ limit: 10, sort: "-employee_count_1y_growth", filter: `and(${IN_TERRITORY},launch_year[gte]:2012,employees_count[gte]:20,company_status[eq]:operational)` }), []),
    safe("scaleUps", () => list({ limit: 10, sort: "-total_funding", filter: `and(${IN_TERRITORY},launch_year[gte]:2012,classification[in_any]:rising_star|colt|titan|thoroughbred|unicorn)` }), []),
    safe("spinouts", () => list({ limit: 12, sort: "-total_funding", filter: `and(${IN_TERRITORY},classification[in_any]:spinout)` }), []),
    safe("patents", () => list({ limit: 10, sort: "-patents_count", filter: `and(${IN_TERRITORY},has_patents[eq]:true,launch_year[gte]:2000)` }), []),
  ]);
  const exits = await safe("exits", async () => {
    const b = await get("/data/transactions", {
      view: "summary", limit: 40, sort: "-date", include_total: "true",
      filter: `and(${HQ},is_exit[eq]:true,year[gte]:${FROM_YEAR})`,
    });
    return {
      total: b.page?.total ?? b.data.length,
      items: b.data.map((t) => ({
        company: t.company?.name, url: t.company?.dealroom_url, date: t.announced_date, type: t.round_type,
        amount: t.amount || null, valuation: t.valuation ?? null, acquirers: (t.investors ?? []).map((i) => i.name),
        tagline: t.company?.tagline, funding: t.company?.funding?.total ?? null,
      })),
    };
  }, { total: 0, items: [] });

  // --- Infrastructure: parks, clusters, institutes (gov/NGO) and the digital backbone
  const [institutions, dataCenters] = await Promise.all([
    safe("institutions", async () => {
      const b = await get("/data/gov-ngo", { view: "summary", limit: 50, filter: `any_location[in_any]:${LOC}` });
      return b.data.map((g) => ({ name: g.name, city: hqCity(g), tagline: g.tagline, employees: g.employees_count, url: g.dealroom_url }));
    }, []),
    safe("dataCenters", () => list({ limit: 10, sort: "-employees_count", filter: `and(${IN_TERRITORY},taxonomy_id[in_any]:2234201)` }), []),
  ]);

  const vcRounds = fundingByYear.reduce((s, r) => s + r.count, 0);
  const vcAmount = fundingByYear.reduce((s, r) => s + (r.sum_amount ?? 0), 0);
  const created5y = Object.values(byYear).filter((y) => y.year >= FROM_YEAR);

  return {
    generatedAt: new Date().toISOString(),
    territory: { name: "Aix-Marseille-Provence Metropole", locationId: LOC, fromYear: FROM_YEAR },
    creditsUsed: credits,
    warnings,
    kpis: {
      companies: totals[0]?.count ?? null,
      totalFunding: totals[0]?.sum_total_funding ?? null,
      createdSince: created5y.reduce((s, y) => s + y.created, 0),
      vcRounds, vcAmount,
      vcCompanies: Math.max(0, ...fundingByYear.map((r) => r.count_distinct_entity_id ?? 0)),
      unicorns: unicorns[0]?.count ?? 0,
      exited: exitedCount[0]?.count ?? 0,
      exits5y: exits.total,
      foundedHereLeft: leakage[0]?.count ?? 0,
      accelerators: accelerators.length,
      universities: universities.length,
    },
    creation: Object.values(byYear),
    fundingByYear: fundingByYear.map((r) => ({ year: r.dimension, rounds: r.count, amount: r.sum_amount ?? 0, companies: r.count_distinct_entity_id })),
    sectors,
    universities,
    accelerators,
    investors,
    exits,
    success: { topFunded, topJobs, fastGrowers, scaleUps, spinouts, patents },
    infrastructure: { institutions, dataCenters },
  };
}
