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

The standalone HTML views use `/og.png`, so the same approved Sahaan hero artwork stays consistent across desktop and mobile.
