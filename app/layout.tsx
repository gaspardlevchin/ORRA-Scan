import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terrain Scan",
  description:
    "Lecture topographique 3D avec géolocalisation, terrain Mapbox et bâtiments extrudés.",
};

export const viewport: Viewport = {
  themeColor: "#030706",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
