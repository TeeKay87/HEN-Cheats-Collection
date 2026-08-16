# HEN Cheats Collection Website v2

React + TypeScript + Vite frontend for the HEN Cheats Collection website.

## Development

```bash
npm install
npm run dev
```

`npm run dev` regenerates `public/data/stats.json` first so the hero file count always follows the current exported website data.

## Production build

```bash
npm run build
```

The production build regenerates the site statistics, builds the Vite frontend and then creates the social/deep-link pages under `dist/game/`.

## Google AdSense

Public AdSense settings live in `.env`:

- `VITE_ADSENSE_ENABLED`
- `VITE_ADSENSE_CLIENT_ID`
- `VITE_ADSENSE_CATALOG_SLOT_ID`
- `VITE_ADSENSE_CATALOG_INTERVAL`

The catalog uses a responsive full-width ad placement after every configured number of game cards. Unfilled ad units collapse so they do not leave empty blocks in the catalog. `public/ads.txt` is copied to the site root during build, and the AdSense account meta tag plus loader script are included in the HTML head.

The site reads its generated collection data from `public/data/`. Cheat downloads are resolved against the HEN Cheats Collection GitHub repository using the base URL in `src/config.ts`.
