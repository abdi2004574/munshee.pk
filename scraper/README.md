# Munshee Scraper Service

Standalone Node.js service for merchant product page scraping. Built with Playwright and Express.

## Prerequisites

- Node.js 20+
- Playwright browsers

## Setup

```bash
cd scraper
npm install
npx playwright install chromium
```

## Run Locally

```bash
npm run dev
```

Server starts on `http://localhost:3001` by default.

## Deploy

Deployable on free tiers:
- [Render](https://render.com/docs)
- [Railway](https://docs.railway.app/)
- [Vercel](https://vercel.com/docs)

### Notes for Deployment

- On Render/Railway, set the build command to `cd scraper && npm install && npx playwright install chromium`
- Set the start command to `cd scraper && npm run start`
- Ensure the platform supports Chromium headless mode

## Environment Variables

None required for basic operation. `PORT` defaults to `3001`.

## Rate Limiting

Merchants should not scrape more than **1 page per 5 seconds** to avoid IP bans.
