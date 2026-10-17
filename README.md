# Dealroom API (Node.js + Express)

## Getting started

- `npm install` once, then `npm start` runs the server on http://localhost:3000 (`PORT` in `.env` overrides it). `npm run verify` prints the top-10 table and exits.

## Routes

- `GET /health`, `GET /companies/top` (VC-backed companies launched since 2020, by valuation), and any `GET /data/...` or `/reference/...` passed through to `https://api.beta.dealroom.app` with auth added, e.g. `curl "localhost:3000/data/companies?limit=5&view=summary"`.

- Challenge 2 page: http://localhost:3000/marseille-aix (data from `GET /api/marseille-aix`, cached in `data/`, add `?refresh=1` to rebuild for about 780 credits). `/analytics/...` is also passed through.

## Credentials and authentication

- Credentials live in `.env` in this folder (gitignored). Never commit the client secret or paste it anywhere.
- Tokens last 24 hours; the server caches one in `.token`, fetches a fresh one when needed, and retries once on 401.

## Response format and credits

- List rows are in `data`; HQ country is `locations[role=hq].country.name`, valuation is `valuation.value`. Every call costs credits (`X-Credits-Used` header).

## Documentation

- https://developers.beta.dealroom.co/getting-started/agent-setup.md and https://developers.beta.dealroom.co/llms.txt

## Continuing in a new chat

- "Read README.md in this folder and continue from there."
