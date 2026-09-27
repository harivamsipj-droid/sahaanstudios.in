# Sahaan Studios

Hyderabad-first beauty marketplace connecting customers with independent nail and beauty professionals.

## Main journeys

- Customers choose a service and find nearby Google listings using browser-permitted approximate location; Hyderabad PIN-code search remains a fallback. Preferred date is optional.
- Professionals apply through a separate onboarding experience.
- Google-listed businesses remain clearly separate from Sahaan-verified professionals.
- Customers can send a manual Sahaan match request through WhatsApp; it is not a confirmed appointment.
- A private, feature-gated managed-payment flow is prepared. Sahaan issues an exact quote, the customer pays through Razorpay on the website, and Sahaan assigns and notifies the professional after verified payment. **It is disabled until the launch checklist is complete.**

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

For managed payments, see [the payment launch checklist](docs/payment-launch.md) and `.env.example`. Never commit payment or WhatsApp credentials. Payments remain unavailable unless all private settings and both launch switches are present.

Run the payment-flow smoke test with `npm test`. It uses fake Razorpay and WhatsApp responses and does not charge or contact anyone.

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

Google Places search is configured on the host. Public customer enquiries and professional applications still open a click-to-chat conversation with Sahaan's temporary launch number; they are not automatic bookings. The managed-payment flow is a separate private-quote journey and remains off until Razorpay, durable storage, approved WhatsApp templates and legal review are complete.

Sahaan accepts professional applications and customer enquiries across Hyderabad. This does not imply artist coverage or instant booking in every PIN code. Public starting prices are **indicative market guides**, not confirmed Sahaan prices; artist availability, treatment scope, travel and final quote must be checked manually. The founder's week-one operating checklist is in `docs/launch-week-one.md`.

To replace the temporary number later, update `SAHAAN_WHATSAPP_NUMBER` and `SAHAAN_WHATSAPP_DISPLAY` in `lib/contact.ts`, plus the links in both standalone HTML views (`public/desktop/index.html` and `public/mobile/mobile.html`). WhatsApp click-to-chat URLs use the full international number without a plus sign.

## Separate HTML view folders

- Desktop: `public/desktop/index.html`
- Mobile: `public/mobile/mobile.html`
- Maintenance guide: `HTML_VIEWS.md`

These standalone files make desktop-only and mobile-only presentation changes easy to review. The main live homepage remains the responsive React application so visitors automatically receive the correct layout for their screen.
