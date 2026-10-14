import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bakso Ibu - ERP Inventaris',
  description: 'Sistem Operasional & Multi-Outlet Bakso Ibu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}