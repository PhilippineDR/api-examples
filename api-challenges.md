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

- **Status:** Done (v1: page live at http://localhost:3000/marseille-aix, data refreshed with `?refresh=1`)
- **City:** Marseille-Aix-Provence (Aix-Marseille-Provence Metropole, 92 communes)
- **Where in the code:** `marseille-aix.js` (collects all data via the API, throttled with 429 retry), `server.js` (route `GET /api/marseille-aix`, cached in `data/marseille-aix.json`, plus static serving of `public/`), `public/marseille-aix.html` (dashboard page)
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
  - Technopoles, science parks and subsea cables are not in Dealroom; the page says so and needs another source.
  - No benchmark against other territories (not requested). Dealroom under-records closures and the newest companies.

---

## 3. Sub-sector analysis

**Challenge:** Build an analysis of a sub sector of Defense, Deep Tech or Biotech.

- **Status:** Scoped, not started
- **Sub sector:** Biotech > Cell & gene therapy (CGT), Europe
- **Where in the code:** _not yet_
- **Idea / plan:** Dashboard page (same style as challenge 2: KPI tiles, charts, ranked tables, short narrative).
  - Definition (confirmed): CGT core = taxonomy ids `1544701|2199201|1382201|1860901|2246801|771001|2297301|1634301|2167701|2199401` (Gene Therapy, Cell Therapy, CRISPR, Genome Engineering, T-Cell, Stem Cells, Viral Vectors, RNA, mRNA Medicines, Antisense Nucleic Acid Drugs). Separate "enablers" segment = `2265201|2279801` (Cell Manufacturers, Biomanufacturing). Left out: Immunotherapy, Regenerative Medicine, Genetics and Genomics, Oncology.
  - Europe filter: location id 76 (`region/europe`) via `hq_location[in_any]:76`
  - Geography: Europe, with a country breakdown
  - Time window: last 5 years (2021 to today) for funding and investor activity
  - Companies: all stages, leaderboard ranked by total funding, plus unicorns
  - Investors: ranked by capital deployed in European CGT over the window
  - Not in scope: exits/M&A, funding trend deep-dive, co-investment network (could be added later)
- **Endpoints used:**
- **Notes / problems:**

---

## Useful links

- Setup guide: https://developers.beta.dealroom.co/getting-started/agent-setup.md
- Full docs index: https://developers.beta.dealroom.co/llms.txt
- Existing server routes: see `server.js` and `README.md` in this folder
