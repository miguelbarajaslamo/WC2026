import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WORLD CUP PICKS",
    short_name: "WC PICKS",
    description: "A private World Cup prediction pool.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#064e3b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
