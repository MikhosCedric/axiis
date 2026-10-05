import type { Metadata } from "next";
import { Besley, Hanken_Grotesk } from "next/font/google";
import { THEME_COOKIE } from "@/components/shell/cookies";
import "./globals.css";

const besley = Besley({ variable: "--font-besley", subsets: ["latin"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Axiis", template: "%s · Axiis" },
  description: "The one place where your tasks, time and notes meet.",
};

// Runs before first paint so a saved theme never flashes the other one.
// The string is a constant; no request data reaches it.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${besley.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
