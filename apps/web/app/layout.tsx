import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'CareerĀsanā — Career Diya', description: 'Turn a chosen career direction into a plan' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same fonts and stylesheets as the static Career Diya pages, so the CareerĀsanā
            routes share one look (see app/_components/CareerDiyaShell.tsx). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
        />
        <link rel="stylesheet" href="/assets/site.css" />
        <link rel="stylesheet" href="/assets/design-system-v2.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
