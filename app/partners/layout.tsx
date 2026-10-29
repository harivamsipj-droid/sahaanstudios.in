import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Sahaan Professional',
  description: 'Join Sahaan’s Hyderabad professional network. Share your nail-work portfolio and service area on WhatsApp to apply as an independent artist.',
  openGraph: { title: 'Grow Your Hyderabad Beauty Business with Sahaan', description: 'Apply for Sahaan’s founding-professional review in Hyderabad.', url: '/partners', images: [{ url: '/og.png', width: 1536, height: 864, alt: 'Sahaan Studios' }] },
  twitter: { card: 'summary_large_image', title: 'Grow Your Hyderabad Beauty Business with Sahaan', description: 'Apply for Sahaan’s founding-professional review in Hyderabad.', images: ['/og.png'] },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) { return children; }
