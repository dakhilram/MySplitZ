import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MySplitZ",
  description: "Simple shared trip expense records.",
  icons: { icon: "favicon.svg" },
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="icon" href="favicon.svg" type="image/svg+xml" /></head><body>{children}</body></html>}
