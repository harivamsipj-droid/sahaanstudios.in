# Desktop and mobile HTML views

The live homepage is the responsive React application in `app/page.tsx`, with shared styling in `app/globals.css`. The two folders below are standalone, easy-to-read HTML references for maintaining each screen size independently.

## Desktop

- File: `public/desktop/index.html`
- Live path: `/desktop/index.html`
- Designed for screens 1024 pixels and wider.

## Mobile

- File: `public/mobile/mobile.html`
- Live path: `/mobile/mobile.html`
- Shortcut: `/mobile.html`
- Designed and tested for screens 320–480 pixels wide.

## Editing rules

1. Change desktop-only layout or copy in `public/desktop/index.html`.
2. Change mobile-only layout or copy in `public/mobile/mobile.html`.
3. Change the main responsive production experience in `app/page.tsx` and `app/globals.css`.
4. Never edit the generated `dist` folder. It is recreated during deployment.
5. Keep search field names (`pin`, `service`, and `date`) unchanged so both files continue to open the professional results page correctly.
6. When the temporary WhatsApp number changes, update the links in both HTML files and the live React number in `lib/contact.ts`.
7. When the launch service menu, indicative price guides or pilot corridors change, update both standalone HTML views and the responsive pages in `app/`; do not assume one updates the others automatically.

The live homepage and standalone HTML views use `/brand/sahaan-hero-clean-v1.png` for the hero photo. `/og.png` remains the social-sharing image.

Customer pages keep discovery content only; the founding-professional offer and commission panel live on `app/partners/page.tsx`. The header still links to the professional site in one click. Headings use Georgia and interface text uses Segoe UI across the responsive and standalone views.
