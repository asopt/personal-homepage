import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...inputArgs] = process.argv.slice(2);

if (!["dev", "start"].includes(command)) {
  throw new Error("用法：npm run dev [-- 参数] 或 npm start -- [参数]");
}

const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const defaults = packageJson.config;
const options = {
  host: process.env.HOST || defaults.host,
  port: process.env.PORT || (command === "dev" ? defaults.devPort : defaults.port),
  adminPassword: process.env.ADMIN_PASSWORD || defaults.adminPassword,
};
const forwardedArgs = [];

for (let index = 0; index < inputArgs.length; index += 1) {
  const argument = inputArgs[index];
  const separator = argument.indexOf("=");
  const name = separator === -1 ? argument : argument.slice(0, separator);
  const value = separator === -1 ? inputArgs[index + 1] : argument.slice(separator + 1);

  if (["--host", "--port", "--admin-password"].includes(name)) {
    if (!value || (separator === -1 && value.startsWith("--"))) {
      throw new Error(`参数 ${name} 缺少值`);
    }
    options[name === "--admin-password" ? "adminPassword" : name.slice(2)] = value;
    if (separator === -1) index += 1;
    continue;
  }

  forwardedArgs.push(argument);
}

if (!options.adminPassword) {
  throw new Error("请在 package.json、ADMIN_PASSWORD 或 --admin-password 中配置管理密码");
}

const childEnvironment = {
  ...process.env,
  HOST: options.host,
  PORT: options.port,
  ADMIN_PASSWORD: options.adminPassword,
};
const entry =
  command === "dev"
    ? path.join(projectRoot, "node_modules", "vite", "bin", "vite.js")
    : path.join(projectRoot, "server", "index.mjs");
const childArgs =
  command === "dev"
    ? [entry, "--host", options.host, "--port", options.port, ...forwardedArgs]
    : [entry, "--host", options.host, "--port", options.port, ...forwardedArgs];
const child = spawn(process.execPath, childArgs, {
  cwd: projectRoot,
  env: childEnvironment,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
