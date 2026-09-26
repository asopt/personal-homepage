import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_FILE,
  isConfigObject,
  readRequestBody,
  readStoredConfig,
  writeStoredConfig,
} from "./config-store.mjs";

// 生产静态资源目录及扩展名对应的响应 MIME 类型。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "dist", "client");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** 以 JSON 格式发送响应，并设置禁止缓存的响应头。 */
function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

/** 使用统一的 JSON 错误结构结束当前响应。 */
function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

/** 处理站点配置接口的读取、鉴权、校验与持久化。 */
async function handleConfig(request, response, { configFile, password }) {
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET") {
    const suppliedPassword = request.headers["x-admin-password"];
    if (suppliedPassword && suppliedPassword !== password) {
      sendError(response, 401, "管理密码不正确");
      return;
    }
    try {
      sendJson(response, 200, await readStoredConfig(configFile));
    } catch {
      sendError(response, 500, "配置读取失败");
    }
    return;
  }

  if (request.method !== "PUT") {
    sendError(response, 405, "method not allowed");
    return;
  }
  if (request.headers["x-admin-password"] !== password) {
    sendError(response, 401, "管理密码不正确");
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request));
    if (!isConfigObject(body)) {
      sendError(response, 400, "配置必须是 JSON 对象");
      return;
    }
    await writeStoredConfig(body, configFile);
    sendJson(response, 200, body);
  } catch (error) {
    sendError(
      response,
      error.message === "payload too large" ? 413 : 400,
      error.message || "配置保存失败",
    );
  }
}

/** 安全地解析静态请求路径并拒绝根目录之外的目标。 */
function resolvePublicFile(publicDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^[/\\]+/, "");
  const target = path.resolve(publicDir, relative);
  const root = path.resolve(publicDir);
  return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
}

/** 提供构建产物静态文件及单页应用路由回退。 */
async function serveStatic(request, response, publicDir) {
  if (!["GET", "HEAD"].includes(request.method)) {
    sendError(response, 405, "method not allowed");
    return;
  }

  const pathname = new URL(request.url, "http://localhost").pathname;
  const requested = resolvePublicFile(publicDir, pathname);
  let file = requested;
  try {
    if (!file || !(await stat(file)).isFile()) throw new Error("missing");
  } catch {
    file = path.join(publicDir, "index.html");
  }

  try {
    const info = await stat(file);
    response.writeHead(200, {
      "cache-control":
        path.basename(file) === "index.html" || file.endsWith("config.json")
          ? "no-store"
          : "public, max-age=31536000, immutable",
      "content-length": info.size,
      "content-type": MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    sendError(response, 500, "静态文件读取失败");
  }
}

/** 创建带有配置 API 与静态资源路由的 HTTP 服务实例。 */
export function createServer({ publicDir = PUBLIC_DIR, configFile = CONFIG_FILE, password } = {}) {
  if (typeof password !== "string" || !password)
    throw new Error("管理密码未配置，请设置 ADMIN_PASSWORD 或 --admin-password");
  return http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/api/config")
        await handleConfig(request, response, { configFile, password });
      else await serveStatic(request, response, publicDir);
    } catch {
      if (!response.headersSent) sendError(response, 500, "服务器内部错误");
      else response.destroy();
    }
  });
}

/** 按环境变量和命令行参数解析选项并启动生产服务。 */
export function startServer() {
  const options = resolveRuntimeOptions();
  const server = createServer({ password: options.adminPassword });
  const { port, host } = options;
  server.listen(port, host, () => {
    console.log(`Application running at http://${host}:${port}`);
  });
  return server;
}

/** 按命令行、环境变量的优先级解析服务运行参数。 */
export function resolveRuntimeOptions(
  args = process.argv.slice(2),
  env = process.env,
  { requirePassword = true } = {},
) {
  const cli = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) continue;
    const separator = argument.indexOf("=");
    const name = separator === -1 ? argument : argument.slice(0, separator);
    const value = separator === -1 ? args[index + 1] : argument.slice(separator + 1);
    if (separator === -1 && value && !value.startsWith("--")) index += 1;
    if (["--port", "--host", "--admin-password"].includes(name) && value) cli.set(name, value);
  }

  const portValue = cli.get("--port") ?? env.PORT ?? "9908";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("端口必须是 1 到 65535 的整数");

  const host = cli.get("--host") ?? env.HOST ?? "127.0.0.1";
  const adminPassword = cli.get("--admin-password") ?? env.ADMIN_PASSWORD;
  if (requirePassword && !adminPassword)
    throw new Error("管理密码未配置，请设置 ADMIN_PASSWORD 或 --admin-password");

  return { port, host, adminPassword };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
)
  startServer();
