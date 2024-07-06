import { defineConfig } from 'astro/config';
import { qrcode } from 'vite-plugin-qrcode';

import sanity from "@sanity/astro";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://test.com/",
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "./src/styles/vars.scss";`
        }
      }
    },
    plugins: [qrcode()]
  },
  integrations: [sanity({
    projectId: "nacdthna",
    dataset: "production",
    useCdn: false,
    apiVersion: "2024-07-02",
    studioBasePath: '/admin'
  }), react()]
});