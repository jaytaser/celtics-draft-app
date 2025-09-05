# Celtics Draft Starter (Next.js + Tailwind)

**What this is:** a minimal, ready-to-deploy draft board that runs great on one host device for draft night.
- Reads games from `public/games.json` (you can replace with your own).
- Lets you set player names, randomize order, draft picks, and export CSV.
- Mobile-friendly UI, deploys free to Vercel.
- Includes stubs to upgrade to: room-code gate, multi-user backend, and AI suggestions.

## Quick Start
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel
1. Push this folder to a GitHub repo (e.g. `celtics-draft-starter`).
2. Go to https://vercel.com → New Project → Import your repo → Deploy.
3. Share the URL with your buddies (or run it on a single device for now).

## Replace the Game Data
- Edit `public/games.json` (array of rows). Each row = [Date, Time, Day, Opponent, Tier, Price].

## Upgrade Paths
- **Room Code Gate**: add a `middleware.ts` to check for a cookie set on `/join`.
- **Multi-user**:
    - Use Google Sheets as backend (recommended): a single sheet with columns (id, date, time, day, opponent, tier, price, picked_by).
    - Create API routes under `/pages/api/*` that read/write with a service account.
    - Swap `fetch('/games.json')` for `/api/games` and `/api/pick`.
- **AI Suggestions**:
    - Create `/pages/api/suggest.ts` that calls your LLM provider with remaining games + player prefs and returns top 3 suggestions.
- **Export PDFs**: Use `pdf-lib` or server-side HTML-to-PDF per player.

## Notes
- This starter keeps state in-memory on the page (best for a single shared laptop or screen).
- For fully live multi-user drafting, wire a backend (Google Sheets, Supabase, or Vercel KV).
