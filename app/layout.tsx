import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sahaanstudio.com'),
  title: 'Sahaan Hyderabad | Find Beauty Professionals by PIN Code',
  description: 'Search nearby nail salons and beauty professionals across Hyderabad by PIN code. Compare Google Maps ratings and Sahaan verification clearly.',
  icons: { icon: '/brand/sahaan-icon-cherry-v1.png' },
  openGraph: { title: 'Sahaan Hyderabad | Beauty, one PIN code away.', description: 'Search nearby beauty professionals across Hyderabad and compare local listings.', type: 'website', images: [{ url: '/og.png', width: 1536, height: 864, alt: 'Sahaan — Trusted beauty, brought home.' }] },
  twitter: { card: 'summary_large_image', title: 'Sahaan Hyderabad | Beauty, one PIN code away.', description: 'Search nearby beauty professionals across Hyderabad and compare local listings.', images: ['/og.png'] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
