import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "あじ恋 管理画面",
    short_name: "あじ恋管理",
    description: "あじ恋デジタル会員証の管理画面",
    start_url: "/admin",
    scope: "/admin",
    display: "browser",
    background_color: "#f6f8fb",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/ajikoi-logo.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  };
}
