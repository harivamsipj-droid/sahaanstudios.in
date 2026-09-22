import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find Beauty Professionals in Hyderabad | Sahaan',
  description: 'Search nearby nail salons and beauty professionals by Hyderabad PIN code. Compare Google Maps ratings and review counts.',
  openGraph: { title: 'Find Hyderabad Beauty Professionals | Sahaan', description: 'Search by PIN code and compare nearby Google-listed beauty businesses.', images: [] },
  twitter: { title: 'Find Hyderabad Beauty Professionals | Sahaan', description: 'Search by PIN code and compare nearby Google-listed beauty businesses.', images: [] },
};

export default function ProfessionalsLayout({ children }: { children: React.ReactNode }) { return children; }
