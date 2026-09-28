import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sahaan request inbox', robots: { index: false, follow: false } };

export default function RequestAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
