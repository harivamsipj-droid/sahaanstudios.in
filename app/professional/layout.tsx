import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Professional Profile | Sahaan',
  description: 'Explore Hyderabad beauty listings and send Sahaan an appointment enquiry.',
  openGraph: { title: 'Professional Profile | Sahaan', description: 'Explore Hyderabad beauty listings and request a Sahaan match.', images: [] },
  twitter: { title: 'Professional Profile | Sahaan', description: 'Explore Hyderabad beauty listings and request a Sahaan match.', images: [] },
};

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) { return children; }
