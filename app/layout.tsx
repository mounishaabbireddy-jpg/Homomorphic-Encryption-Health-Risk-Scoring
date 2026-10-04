import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HE Health-Risk Demo",
  description:
    "Homomorphic Encryption demo: compute a health-risk score on encrypted data using CKKS (Microsoft SEAL / WebAssembly)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
