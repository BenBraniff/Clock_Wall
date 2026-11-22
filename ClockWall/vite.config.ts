import { copyFile, mkdir } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/Clock_Wall/",
  plugins: [react(), staticPageRoutes()],
});

function staticPageRoutes(): Plugin {
  return {
    name: "static-page-routes",
    apply: "build",
    async closeBundle() {
      const outputDirectory = new URL("./dist/", import.meta.url);
      const indexFile = new URL("index.html", outputDirectory);

      await Promise.all(
        ["Planetary_Postions", "Earth_View"].map(async (route) => {
          const routeDirectory = new URL(`${route}/`, outputDirectory);
          await mkdir(routeDirectory, { recursive: true });
          await copyFile(indexFile, new URL("index.html", routeDirectory));
        }),
      );
    },
  };
}
