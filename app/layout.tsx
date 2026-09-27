import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://sahaanstudios.in'),
  title: 'Sahaan Hyderabad | Find Beauty Professionals Near You',
  description: 'Explore Google-listed nail salons around your location in Hyderabad, or search by PIN code. Request a Sahaan artist match; listings are not automatically partners.',
  icons: { icon: '/brand/sahaan-studios-final-icon.png' },
  openGraph: { title: 'Sahaan Hyderabad | Beauty closer to you.', description: 'Search nearby beauty professionals across Hyderabad and compare local listings.', type: 'website', images: [{ url: '/og.png', width: 1536, height: 864, alt: 'Sahaan — Trusted beauty, brought home.' }] },
  twitter: { card: 'summary_large_image', title: 'Sahaan Hyderabad | Beauty closer to you.', description: 'Search nearby beauty professionals across Hyderabad and compare local listings.', images: ['/og.png'] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
