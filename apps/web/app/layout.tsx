import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'CareerĀsanā', description: 'Your Career Operating System' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
