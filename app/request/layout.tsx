import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request a nail appointment | Sahaan Studios',
  description: 'See Sahaan nail-service prices with travel included in eligible Hyderabad areas, then request your preferred date and time.',
};

export default function RequestLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
