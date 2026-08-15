import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "デジタル会員証 店舗管理",
    short_name: "店舗管理",
    description: "デジタル会員証の店舗管理画面",
    start_url: "/admin",
    scope: "/admin",
    display: "browser",
    background_color: "#f6f8fb",
    theme_color: "#0f766e",
    icons: [],
  };
}
