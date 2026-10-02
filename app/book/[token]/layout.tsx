import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Private booking quote | Sahaan Studios',
  robots: { index: false, follow: false },
};

export default function PrivateQuoteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
