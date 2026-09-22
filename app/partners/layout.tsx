import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Sahaan Professional',
  description: 'Join Sahaan’s Hyderabad professional network, find your Google Business Profile and grow your independent beauty business.',
  openGraph: { title: 'Grow Your Hyderabad Beauty Business with Sahaan', description: 'Apply to join Sahaan’s verified network of independent beauty professionals.', images: [] },
  twitter: { title: 'Grow Your Hyderabad Beauty Business with Sahaan', description: 'Apply to join Sahaan’s verified network of independent beauty professionals.', images: [] },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) { return children; }
