import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import "dotenv/config";

export default defineConfig({
  vite: () => ({
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    plugins: [tailwindcss()],
  }),
  browser: "chrome",
  manifestVersion: 3,
  srcDir: "src",
  outDir: ".output",
  manifest: {
    name: "Puda Palafito",
    version: "0.1.0",
    description: "Chrome-first browser extension scaffold with WXT + React + TypeScript",
    permissions: ["storage", "sidePanel", "tabs", "identity"],
    host_permissions: ["<all_urls>"],
    action: {},
    ...(process.env.WXT_OAUTH_CLIENT_ID
      ? {
          oauth2: {
            client_id: process.env.WXT_OAUTH_CLIENT_ID,
            scopes: ["https://www.googleapis.com/auth/drive.file"],
          },
        }
      : {}),
    browser_specific_settings: {
      gecko: {
        id: "puda-palafito@example.com",
      },
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  },
});
