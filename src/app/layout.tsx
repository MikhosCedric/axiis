import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Besley, Hanken_Grotesk } from "next/font/google";
import { THEME_COOKIE } from "@/components/shell/cookies";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import { PAPER_DARK, PAPER_LIGHT } from "@/lib/theme-colors";
import "./globals.css";

const besley = Besley({ variable: "--font-besley", subsets: ["latin"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · Tasks and time, on one page`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · Tasks and time, on one page`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAPER_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: PAPER_DARK },
  ],
};

// Runs before first paint so a saved theme never flashes the other one.
// The string is a constant; no request data reaches it.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the request's nonce also makes every page render per request, which a nonce needs.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${besley.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-ink px-4 py-2.5 font-medium text-paper focus:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
