# Sahaan Studios

Hyderabad-first beauty marketplace connecting customers with independent nail and beauty professionals.

## Main journeys

- Customers search by Hyderabad PIN code, service, and preferred date.
- Professionals apply through a separate onboarding experience.
- Google-listed businesses remain clearly separate from Sahaan-verified professionals.

## Local development

Requires Node.js 22 or newer.

```bash
pnpm install
pnpm dev
```

Create a local `.env` file when Google Places is enabled:

```bash
GOOGLE_PLACES_API_KEY=
```

## Production

```bash
pnpm build
pnpm start
```

The production entry point is `hostinger-server.mjs`, which runs the Vinext build on Hostinger's Node.js web-app hosting.

## Current deployment

- Website: https://sahaanstudios.in
- Hosting: Hostinger Web Apps
- Node.js: 22.x
- Build command: `npm run build`
- Output directory: `dist`
- Entry file: `hostinger-server.mjs`

WhatsApp Business and Google Places are intentionally pending until their production credentials are available.
