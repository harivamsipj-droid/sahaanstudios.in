# Sahaan Studios logo assets

## Current three-part lockup

The `three-parts/` folder contains the user-supplied 4K symbol, SAHAAN STUDIOS wordmark, and “YOUR EXPRESSION. OUR ESSENCE.” tagline in both original PNG and web-optimized WebP formats. The website uses the WebP files; the PNGs are retained as high-resolution source files.

Compact headers pair the symbol and wordmark. The tagline is displayed separately at a readable width in desktop footers, with accessible text at small phone widths. Do not squeeze all three images into a narrow navigation bar.

## Earlier full-image logo (kept for rollback)

- `sahaan-studios-final.webp` — final website logo supplied on 23 September 2026, optimized from the attached 3840 × 3200 image. It carries the line “YOUR EXPRESSION. OUR ESSENCE.”
- `sahaan-studios-final-master.png` — unaltered full-resolution PNG supplied by the user.
- `sahaan-studios-final-icon.png` — square crop of the emblem for the site icon.
- `sahaan-studios-final-wordmark.webp` — proportional crop of the lettering and tagline from the same master for narrow headers.

These files are no longer used by the current headers or footers. They remain available for rollback. Update the responsive site, desktop HTML reference, and mobile HTML reference together for future logo changes.

## Previous logo files (kept for rollback)

- `sahaan-studios-approved-4k.webp` — earlier website logo.
- `sahaan-studios-approved-4k-master.png` — earlier PNG master.

- `sahaan-primary-cherry-v1.png` — full vertical logo for large placements.
- `sahaan-horizontal-cherry-v1.png` — earlier transparent horizontal logo.
- `sahaan-icon-cherry-v1.png` — earlier square symbol.

Verify `app/globals.css`, `public/desktop/index.html`, and `public/mobile/mobile.html` at phone and desktop widths after any logo update.

## Hero photo

- `sahaan-hero-clean-v1.png` — the site hero photo without lettering baked into the image. The original `/og.png` remains for social sharing.
- Built-in image edit prompt: “Remove only the baked-in ‘SAHAAN’ and ‘Trusted beauty, brought home.’ lettering from the left wall; reconstruct the wall and light naturally; preserve the two women, manicure action, furniture, framing, colors and lighting; add no text or logos.”
- Keep website captions as HTML text, not part of the photo, so they remain readable on mobile.
