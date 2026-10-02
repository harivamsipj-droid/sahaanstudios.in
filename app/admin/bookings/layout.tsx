import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sahaan booking desk',
  robots: { index: false, follow: false },
};

export default function BookingDeskLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
