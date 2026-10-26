# Dealroom API (Node.js + Express)

## Getting started

- `npm install` once, then `npm start` runs the server on http://localhost:3000 (`PORT` in `.env` overrides it). `npm run verify` prints the top-10 table and exits.

## Routes

- `GET /health`, `GET /companies/top` (VC-backed companies launched since 2020, by valuation), and any `GET /data/...` or `/reference/...` passed through to `https://api.beta.dealroom.app` with auth added, e.g. `curl "localhost:3000/data/companies?limit=5&view=summary"`.

- Challenge 2 page: http://localhost:3000/marseille-aix-naecaj (data from `GET /api/marseille-aix-naecaj`, cached in `data/`, add `?refresh=1` to rebuild for about 780 credits). `/analytics/...` is also passed through.

- Challenge 3 page: http://localhost:3000/cgt-europe-nlbu17 (European cell & gene therapy; data from `GET /api/cgt-europe-nlbu17`, cached in `data/cgt-europe.json`, add `?refresh=1` to rebuild for about 440 credits).

- Challenge 4 page (HV Capital, Revolut founder mafia): http://localhost:3000/revolut-mafia-1gw5ua (data from `GET /api/revolut-mafia-1gw5ua`, cached in `data/revolut-mafia.json`, add `?refresh=1` to rebuild for about 960 credits).

- Bouygues Construction example (PFAS clean-up startups in Europe): http://localhost:3000/pfas-europe-9qntdi (data from `GET /api/pfas-europe-9qntdi`, cached in `data/pfas-europe.json`, add `?refresh=1` to rebuild for about 30 credits).

## Credentials and authentication

- Credentials live in `.env` in this folder (gitignored). Never commit the client secret or paste it anywhere.
- Tokens last 24 hours; the server caches one in `.token`, fetches a fresh one when needed, and retries once on 401.

## Response format and credits

- List rows are in `data`; HQ country is `locations[role=hq].country.name`, valuation is `valuation.value`. Every call costs credits (`X-Credits-Used` header).

## Documentation

- https://developers.beta.dealroom.co/getting-started/agent-setup.md and https://developers.beta.dealroom.co/llms.txt

## Continuing in a new chat

- "Read README.md in this folder and continue from there."
