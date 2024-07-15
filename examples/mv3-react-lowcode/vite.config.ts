import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import vitePluginImp from "vite-plugin-imp";
import crxHmrPlugin from "@bgafe/vite-plugin-crx-hmr";
import { resolve } from "path";

// https://cn.vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  console.log("process.env.NODE_ENV", mode, process.env.NODE_ENV);
  const isDev = process.env.NODE_ENV === "development";

  return {
    define: {
      __DEV__: isDev,
    },
    resolve: {
      alias: [{ find: /^~/, replacement: "" }],
    },
    plugins: [
      react(),
      vitePluginImp({
        libList: [
          {
            libName: "antd",
            style(name) {
              return `antd/es/${name}/style/index.js`;
            },
          },
        ],
      }),
      crxHmrPlugin({
        isDev,
        mode,
        pageInput: {
          "lowcode-editor": resolve(
            process.cwd(),
            "src/entries/lowcode-editor/lowcode-editor.html"
          ),
        },
      }),
    ],
  };
});
