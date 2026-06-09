import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";


export const metadata: Metadata = {
  title: "Report Design",
  description: "TabApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
