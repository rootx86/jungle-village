import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jungle Village',
  description: 'Every subscriber becomes a villager who builds a house in a growing pixel-art jungle.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
