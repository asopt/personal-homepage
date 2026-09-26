import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 配置文件根目录与服务端接受的最大 JSON 请求体大小。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_FILE = path.join(ROOT, "data", "site-config.json");
export const MAX_CONFIG_BYTES = 1024 * 1024;

/** 从指定 JSON 文件读取持久化站点配置。 */
export async function readStoredConfig(file = CONFIG_FILE) {
  return JSON.parse(await readFile(file, "utf8"));
}

/** 通过同目录临时文件原子替换持久化站点配置。 */
export async function writeStoredConfig(value, file = CONFIG_FILE) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.tmp`);
  await mkdir(directory, { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

/** 判断请求配置是否为非数组 JSON 对象。 */
export function isConfigObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 读取 UTF-8 HTTP 请求体并在超过字节上限时拒绝请求。 */
export function readRequestBody(request, limit = MAX_CONFIG_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) reject(new Error("payload too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
