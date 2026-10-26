# API challenges

Tracker for what I'm building with the Dealroom API. Update the status and the "Where in the code" line as I go.

Status key: Not started / In progress / Done

---

## 1. Scouting agent

**Challenge:** Create a scouting agent using our next gen API (or existing one).

- **Status:** Not started
- **Where in the code:** _not yet, add file paths here (e.g. `api-training/scout.js`, a new route in `server.js`, a button in `api-training-web/src/App.jsx`)_
- **Idea / plan:**
- **Endpoints used:**
- **Notes / problems:**

---

## 2. City resource page

**Challenge:** Create a resource page for a city of your choice as if you were reporting about your performance to your mayor/government.

- **Status:** Done (v1: page live at http://localhost:3000/marseille-aix-naecaj, data refreshed with `?refresh=1`)
- **City:** Marseille-Aix-Provence (Aix-Marseille-Provence Metropole, 92 communes)
- **Where in the code:** `marseille-aix.js` (collects all data via the API, throttled with 429 retry), `server.js` (route `GET /api/marseille-aix-naecaj`, cached in `data/marseille-aix.json`, plus static serving of `public/`), `public/marseille-aix-naecaj.html` (dashboard page)
- **Idea / plan:** Report to the mayor on the innovation ecosystem, last 5 years (2021 to today).
  - Map: universities spinning out startups, accelerators, incubators, with performance per structure
  - Startup performance: funding raised, jobs and headcount growth, exits and unicorns, creation and survival
  - Investors: most active by deal count in the territory, local vs outside, by investor type (VC, angel, public, corporate)
  - Infrastructure: science and tech parks, competitiveness clusters, digital backbone (subsea cables, data centers), research institutes
  - Sector focus: deeptech, biotech/health, marine, space, digital/cyber
  - Success stories of the territory
  - Recommendations: data-backed gaps plus a prioritised action list for the mayor
  - Startup definition: HQ or founded in the metropole (also shows companies that left, i.e. leakage)
  - University link: founder alumni plus spin-offs from labs (CNRS, Inserm, CEA, Luminy, Cadarache)
  - Success stories: big exits, scale-ups, most jobs created by a local startup, technological breakthroughs
  - Page style: dashboard (KPI tiles, charts, ranked tables) with short narrative and recommendations
- **Endpoints used:** `/reference/filters/location/values` (metropole id 3075), `/reference/filters/taxonomy_id/values`, `/analytics/aggregate/{companies,funding-rounds}`, `/data/companies`, `/data/universities`, `/data/investors` and `/data/investors/{id}/portfolio`, `/data/transactions`, `/data/gov-ngo`
- **Notes / problems:**
  - A full build costs about 780 credits, hence the disk cache. The API returns 429 on bursts, so calls run one at a time.
  - Accelerators and incubators are investors with `investor_type` accelerator/incubator; there is no separate filter.
  - Sorting universities by `alumni_founded_companies_count` returns a 500, so I sort by `alumni_founders_count`.
  - Universities use `any_location`, which also returns multi-campus schools headquartered elsewhere (KEDGE, Epitech, ESSCA). They are kept, tagged "campus in territory", and ranked by local companies their alumni founded (`founder__university.id` + `founding_or_hq_location`), minimum 5. Dealroom's alumni totals are institution-wide, so they are shown only as context. Local spin-outs are a proxy (spin-out companies founded by the school's alumni). Refresh just this block with `GET /api/marseille-aix-naecaj/refresh-universities` (about 65 credits).
  - Technopoles, science parks and subsea cables are not in Dealroom; the page says so and needs another source.
  - No benchmark against other territories (not requested). Dealroom under-records closures and the newest companies.

---

## 3. Sub-sector analysis

**Challenge:** Build an analysis of a sub sector of Defense, Deep Tech or Biotech.

- **Status:** Done (v1: page live at http://localhost:3000/cgt-europe-nlbu17, data refreshed with `?refresh=1`)
- **Sub sector:** Biotech > Cell & gene therapy (CGT), Europe
- **Where in the code:** `cgt-europe.js` (collects all data via the API, throttled with 429/500 retry), `server.js` (route `GET /api/cgt-europe-nlbu17`, cached in `data/cgt-europe.json`), `public/cgt-europe-nlbu17.html` (dashboard page)
- **Idea / plan:** Dashboard page (same style as challenge 2: KPI tiles, charts, ranked tables, short narrative).
  - Definition (final): CGT core = taxonomy ids `1544701|2199201|1382201|2246801|771001|2297301|1634301|2167701|2199401` (Gene Therapy, Cell Therapy, CRISPR, T-Cell, Stem Cells, Viral Vectors, RNA, mRNA Medicines, Antisense Nucleic Acid Drugs). Separate "enablers" segment = Biomanufacturing `2279801`.
  - Dropped after checking the data: Genome Engineering `1860901` (broad genomics tools, diagnostics, AstraZeneca) and Cell Manufacturers `2265201` (means battery cells, e.g. Northvolt with $7.7B). Also left out: Immunotherapy, Regenerative Medicine, Genetics and Genomics, Oncology.
  - Europe filter: location id 76 (`region/europe`) via `hq_location[in_any]:76`
  - Time window: last 5 years (2021 to today) for funding and investor activity
  - Companies: all stages, leaderboard ranked by total funding, plus unicorns and newcomers
  - Investors: ranked by capital deployed in European CGT over the window
  - Not in scope: exits/M&A, co-investment network (could be added later)
- **Endpoints used:** `/reference/filters/taxonomy_id/values`, `/reference/filters/location/values`, `/analytics/aggregate/{companies,funding-rounds}`, `/data/companies`, `/data/transactions`, `/data/investors`
- **Notes / problems:**
  - A full build costs about 440 credits, hence the disk cache.
  - Result: 435 companies, $8.4B total funding, 191 founded since 2021, 183 VC rounds worth $2.8B since 2021.
  - Dealroom tags are broad: Oxford Nanopore, Mosa Meat, CELLINK and Ovo Labs are hidden from the lists (regex `NOT_CGT`) but still counted in the aggregate totals.
  - There is no aggregate by investor, so investor capital is built from `/data/transactions`, splitting each round equally between its investors. About 20% of rounds have no disclosed amount.
  - `/analytics/aggregate/companies` with `group_by=launch_year` plus a `launch_year[gte]` filter returns a 500, so the year filter is applied client side.
  - Biomanufacturing is a loose proxy for enablers: it also covers synthetic biology and industrial biotech.

---

## Useful links

- Setup guide: https://developers.beta.dealroom.co/getting-started/agent-setup.md
- Full docs index: https://developers.beta.dealroom.co/llms.txt
- Existing server routes: see `server.js` and `README.md` in this folder
