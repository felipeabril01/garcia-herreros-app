import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "García Herreros FC",
    short_name: "García Herreros FC",
    description: "Gestión administrativa del Club García Herreros FC",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#f4f7fc",
    theme_color: "#124bdf",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}