import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata={title:"Saidhara NDC • Visitor & Asset Management",description:"Secure visitor, asset and gate pass management portal for Saidhara NDC."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}