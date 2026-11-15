import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ration Saathi — Government schemes and ration help',
  description:
    'Explore government schemes, compare policy requirements and official sources, or find ration guidance in English and Hindi.',
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
