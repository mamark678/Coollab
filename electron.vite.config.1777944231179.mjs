// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { config } from "dotenv";
config();
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: "src/main/index.ts"
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: "src/preload/index.ts"
      }
    }
  },
  renderer: {
    plugins: [react()],
    server: {
      host: true,
      allowedHosts: true
    }
  }
});
export {
  electron_vite_config_default as default
};
