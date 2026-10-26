# API example clients

A running log of what I'm building for each client's request using the Dealroom API.

## How to use this file

Copy the template below for each new request and fill it in. Newest requests go at the top of the log.

### Template

```markdown
### <Client name> · <short request title>

- **Date requested:** YYYY-MM-DD
- **Status:** Not started | In progress | Delivered | On hold
- **Contact:** name, email
- **Request:** what the client asked for, in their words
- **What I'm building:** the deliverable (page, dashboard, export, list, ...)
- **Dealroom endpoints / filters used:** endpoints, filters, fields
- **Files:** paths in this repo
- **Notes / open questions:**
```

## Log

### HV Capital · Revolut founder mafia

- **Date requested:** 2026-10-26
- **Status:** Delivered (first version, to review with the client)
- **Contact:** —
- **Request:** A clean visual of who from ex-Revolut staff is building what, where and how, plus a list of people with who they are, where they are now and any signal they are building something worth knowing about. Purpose: spot very early potential founders and deals.
- **What I'm building:** Page with KPIs, a bubble map of founded companies by industry (colour = stage, size = funding), founding-year and country charts, a scored "watchlist" of early signals with reasons, and a searchable list of all 311 people.
- **Dealroom endpoints / filters used:** `GET /data/people` with `and(employer_id[eq]:<Revolut id>,roles[in_any]:founder,current_employer_id[neq]:<Revolut id>)` (full view); `GET /data/companies` with `id[in_any]:...` (summary view) for the founded companies. Revolut id found via `/reference/filters/employer_id/values?q=Revolut`. About 960 credits per rebuild.
- **Files:** `revolut-mafia.js`, `public/revolut-mafia-1gw5ua.html`, route `/api/revolut-mafia-1gw5ua` in `server.js`, cache `data/revolut-mafia.json`. Page: http://localhost:3000/revolut-mafia-1gw5ua (add `?refresh=1` to the API route to rebuild).
- **Notes / open questions:** "Worked at Revolut" also includes advisers and board members. Profiles preview at most 5 roles, so some ventures may be missing. Ask HV whether they want non-founders (e.g. senior ex-Revolut staff who just left) as a second watch cohort.

### Bouygues Construction · PFAS sector landscape

- **Date requested:** 2026-10-26
- **Status:** Delivered (first version, to review with the client)
- **Contact:** —
- **Request:** Map the landscape of the PFAS sector.
- **What I'm building:** A single page in the style of https://aoife-dr.github.io/built-in-mayo/ with a map of companies, a segment breakdown and a top-companies table.
- **Scope:**
  - Segment: PFAS remediation and destruction (water treatment, soil cleanup, destruction tech)
  - Geography: Europe
  - Company types: startups and research spinouts
  - Angle: relevance to construction (water, soil remediation, infrastructure)
- **Dealroom endpoints / filters used:** `GET /data/companies` (view=summary) with `taxonomy_id[in_any]:2284101` (sector PFAS) and `hq_location[in_any]:76` (Europe); `/reference/filters/taxonomy_id/values?q=` to find the tag; adjacent tag counts for context. 29 credits.
- **Files:** `pfas-europe.js` (data builder), `public/pfas-europe-9qntdi.html` (page at http://localhost:3000/pfas-europe-9qntdi), cache `data/pfas-europe.json`. Static GitHub Pages copy: `docs/pfas-europe-9qntdi/` (build with `npm run build:pages`), to be published at https://philippinedr.github.io/api-examples/pfas-europe-9qntdi/
- **Notes / open questions:**
  - Funnel: 60 PFAS-tagged worldwide, 24 in Europe, 13 kept (the rest are PFAS-free alternatives or unrelated). Segments assigned by hand.
  - Small extract on purpose, to show what the API can do. Possible extension: screen Remediation, Water Purification and Soil Restoration companies for PFAS mentions.
  - No client contact or deadline yet.
