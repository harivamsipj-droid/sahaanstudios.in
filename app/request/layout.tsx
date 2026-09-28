import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request a nail appointment | Sahaan Studios',
  description: 'See indicative Hyderabad nail service prices and typical work times, then request your preferred date and time with Sahaan.',
};

export default function RequestLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
