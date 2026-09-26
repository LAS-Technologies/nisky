import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nisky",
    short_name: "Nisky",
    description: "Tu espacio para organizar el día, tareas, hábitos y notas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1f3d",
    theme_color: "#1e3a5f",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    lang: "es",
    icons: [
      { src: "/nisky-otter-approved.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/nisky-otter-approved.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nueva tarea", short_name: "Tarea", url: "/tasks?modal=create", icons: [{ src: "/nisky-otter-approved.png", sizes: "512x512" }] },
      { name: "Nueva captura", short_name: "Captura", url: "/quick-notes", icons: [{ src: "/nisky-otter-approved.png", sizes: "512x512" }] },
      { name: "Nueva nota permanente", short_name: "Nota", url: "/knowledge?modal=create", icons: [{ src: "/nisky-otter-approved.png", sizes: "512x512" }] },
    ],
  };
}
