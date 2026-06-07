# NPB Stats Explorer

Mobile-first React app for browsing Nippon Professional Baseball team/player stats.

## Data Flow

- `public/data/npb-batting.json`
- `public/data/npb-pitching.json`

The app reads these local JSON files. GitHub Actions can refresh them from ProEyeKyuu downloadable tables.

## Local Development

```bash
npm install
npm run dev
```

## Update Data

```bash
npm run update:npb
```

## Deploy

Connect this repository to Netlify.

- Build command: `npm run build`
- Publish directory: `dist`

