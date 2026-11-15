import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ration Saathi — Find your next step',
  description:
    'Find ration guidance in plain English and Hindi, with links to official sources.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
