import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { GeistSans } from 'geist/font/sans';
import { cn } from "@/lib/utils";

const geist = GeistSans;

export const metadata: Metadata = {
  title: 'GeoDojo',
  description: '記憶科学に基づいたGeoGuessr（日本）学習プラットフォーム',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GeoDojo',
  },
};

export const viewport: Viewport = {
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={cn("dark", "font-sans", geist.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
