import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MySplitZ", description: "Simple shared trip expense records." };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
