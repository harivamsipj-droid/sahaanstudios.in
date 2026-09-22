import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Professional Profile | Sahaan',
  description: 'Review a Sahaan-verified professional and request a home beauty appointment.',
  openGraph: { title: 'Professional Profile | Sahaan', description: 'Review a verified professional and request an appointment.', images: [] },
  twitter: { title: 'Professional Profile | Sahaan', description: 'Review a verified professional and request an appointment.', images: [] },
};

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) { return children; }
