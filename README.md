# Sahaan Studios

Hyderabad-first beauty marketplace connecting customers with independent nail and beauty professionals.

## Main journeys

- Customers search by Hyderabad PIN code, service, and preferred date.
- Professionals apply through a separate onboarding experience.
- Google-listed businesses remain clearly separate from Sahaan-verified professionals.

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Create a local `.env` file when Google Places is enabled:

```bash
GOOGLE_PLACES_API_KEY=
```

## Production

```bash
npm run build
npm start
```

The production entry point is `hostinger-server.mjs`, which runs the Vinext build on Hostinger's Node.js web-app hosting.

## Current deployment

- Website: https://sahaanstudios.in
- Hosting: Hostinger Web Apps
- Node.js: 22.x
- Build command: `npm run build`
- Output directory: `dist`
- Entry file: `hostinger-server.mjs`

Google Places search is configured on the host. Customer enquiries and professional applications open a click-to-chat conversation with Sahaan's temporary launch number; they are not automated bookings or a WhatsApp Business API integration. The visitor must send the prepared message in WhatsApp.

To replace the temporary number later, update `SAHAAN_WHATSAPP_NUMBER` and `SAHAAN_WHATSAPP_DISPLAY` in `lib/contact.ts`, plus the links in both standalone HTML views (`public/desktop/index.html` and `public/mobile/mobile.html`). WhatsApp click-to-chat URLs use the full international number without a plus sign.

## Separate HTML view folders

- Desktop: `public/desktop/index.html`
- Mobile: `public/mobile/mobile.html`
- Maintenance guide: `HTML_VIEWS.md`

These standalone files make desktop-only and mobile-only presentation changes easy to review. The main live homepage remains the responsive React application so visitors automatically receive the correct layout for their screen.
