import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import {
  isConfigObject,
  readRequestBody,
  readStoredConfig as loadConfig,
  writeStoredConfig,
} from "./server/config-store.mjs";
import { resolveRuntimeOptions } from "./server/index.mjs";

const { adminPassword } = resolveRuntimeOptions(process.argv.slice(2), process.env, {
  requirePassword: false,
});

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function configApiPlugin() {
  return {
    name: "kiries-config-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestPath = request.url?.split("?")[0];
        if (requestPath !== "/api/config") return next();
        if (!adminPassword && request.method === "PUT") {
          sendJson(response, 503, {
            error: "管理密码未配置，请设置 ADMIN_PASSWORD 或 --admin-password",
          });
          return;
        }
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }
        try {
          if (request.method === "GET") {
            if (
              request.headers["x-admin-password"] &&
              request.headers["x-admin-password"] !== adminPassword
            ) {
              sendJson(response, 401, { error: "管理密码不正确" });
              return;
            }
            sendJson(response, 200, await loadConfig());
            return;
          }
          if (request.method !== "PUT") {
            sendJson(response, 405, { error: "method not allowed" });
            return;
          }
          if (request.headers["x-admin-password"] !== adminPassword) {
            sendJson(response, 401, { error: "管理密码不正确" });
            return;
          }
          const body = JSON.parse(await readRequestBody(request));
          if (!isConfigObject(body)) {
            sendJson(response, 400, { error: "配置必须是 JSON 对象" });
            return;
          }
          await writeStoredConfig(body);
          sendJson(response, 200, body);
        } catch (error) {
          sendJson(response, 400, { error: error.message || "配置请求失败" });
        }
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), vue(), configApiPlugin()],
});
