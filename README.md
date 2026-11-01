# Safehouse v0.1

Covert ops in the real world, on foot. 18+. Ernakulam and Idukki.
Vite + React + Tailwind · Leaflet/OpenStreetMap · Supabase (anonymous auth, Postgres, Realtime) · installable PWA.

**In this build:** agent signup with an 18+ gate · HQ dossier (rank, XP, km walked, active minutes, ops) ·
**Dead Drop** solo op · **ShadowHunt** squad op · weekly leaderboard by district · admin page for drops.

## Run locally
```bash
npm i
npx supabase init                 # once; then in supabase/config.toml set [auth] enable_anonymous_sign_ins = true
npx supabase start                # applies supabase/migrations/001_safehouse.sql and supabase/seed.sql
cp .env.example .env              # paste the API URL + anon key that `supabase start` prints
npm run dev
```
Phones need HTTPS for GPS: deploy (below) or use an HTTPS tunnel such as `cloudflared tunnel --url http://localhost:5173`.

## Deploy
1. Supabase project → SQL editor → run `001_safehouse.sql`, then `seed.sql`. Authentication → enable **Anonymous sign-ins**.
2. Vercel → import the repo → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → deploy.

## Make yourself admin
Sign up in the app, then in the SQL editor:
```sql
update agents set is_admin = true where callsign = 'YOURCALLSIGN';
```
HQ then shows **HQ admin: manage drops**. Seeded Kochi drops are **inactive and approximate**: visit each, fix the pin,
confirm it's public, open and safe in daylight, then activate. Add Idukki drops the same way. Never place drops in
forests, reserves, dam areas, cliffs, water edges, roads or private property.

## How it works
- **Tracking** (`_track`): km and active minutes count only on-foot movement (≤ 25 km/h), ignoring GPS jitter.
- **Dead Drop:** drop coordinates are never sent to the phone. `start_drop` returns a fuzzy zone; `drop_ping`
  returns distance, bearing, and a hint within 200 m; `complete_drop` checks the server-side position (≤ 35 m).
  XP = 60 + distance/20 + up to 60 for time left.
- **ShadowHunt:** live positions sit in a private table; hunters see shadows only through `get_visible_pings`.
  `verify_catch` checks real distance. `award_hunt` pays XP once per agent per finished op
  (30 base, +40 per tag, +150 surviving shadow, +100/+40 winning hunters); ops under hide time + 3 min pay 0.
- **Leaderboard:** weekly XP, reset Monday 00:00 IST; filter by district.
- **Privacy:** date of birth is checked at signup and never stored; agents can only read their own row.

## Known limits (v0.1)
- Age is self-declared. Add a "report underage player" flow before public launch.
- GPS is trusted from the phone, so a spoofer can cheat. Fine for playtests, not for prizes.
- The squad host's phone drives ShadowHunt phases; if it closes, the op stalls.
- Browsers pause GPS when the screen locks. The app requests a wake lock; keep it in the foreground.
  The Capacitor store build (next) fixes this with native background location.
- iOS Safari has no vibration API.
