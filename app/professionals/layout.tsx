import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Hyderabad Nail Salons & Request a Match | Sahaan',
  description: 'Explore Google-listed nail and beauty businesses by Hyderabad PIN code. Ask Sahaan about an independent artist match; listings are not automatically partners.',
  openGraph: { title: 'Explore Hyderabad Nail Salons | Sahaan', description: 'Compare Google-listed businesses and request a Sahaan artist match.', images: [] },
  twitter: { title: 'Explore Hyderabad Nail Salons | Sahaan', description: 'Compare Google-listed businesses and request a Sahaan artist match.', images: [] },
};

export default function ProfessionalsLayout({ children }: { children: React.ReactNode }) { return children; }
