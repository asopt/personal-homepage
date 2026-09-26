# 主页

一个用 React、Vue、Vite、Nodejs 等杂七杂八的东西堆出来的主页，
主页插画模仿的 [AliceNetwork](https://alice.ws) 做的，插图也是直接照搬的记得换，
背景使用的是 [LoliAPI](https://www.loliapi.com/acg) 的随机图，后台 UI 用的是 [shadcn-vue](https://github.com/unovue/shadcn-vue) 
各个图标用的是 https://iconify.design/
站点配置用 JSON 存储，保存在 `data/site-config.json` 目录下
默认值在 package.json 的 config 字段，自行修改或者命令行启动


## 预览
在线预览：[nia.wiki](https://nia.wiki/)
![首页](/public/Homepage.png "Homepage")
![后台](/public/dashboard.png "dashboard")

## 快速开始

```bash
npm install
npm run deploy
# npm run dev
# npm run dev -- --host 0.0.0.0 --port 5173 --admin-password "password"
# npm run deploy -- --host 127.0.0.1 --port 9908 --admin-password "password"
```

首页默认地址：`http://127.0.0.1:5173`
后台：`http://127.0.0.1:5173/admin`
默认密码： `LocalOnly`
正式环境必须设置自己的管理密码，并建议通过 Nginx/Caddy 以 HTTPS 反向代理

## 可选参数

`npm run dev` 和 `npm start` 均可不带参数使用 `package.json` 默认值。命令行优先于环境变量，环境变量优先于默认值。

| 参数               | 环境变量         | 默认值                                  |
| ------------------ | ---------------- | --------------------------------------- |
| `--host`           | `HOST`           | `127.0.0.1`                             |
| `--port`           | `PORT`           | 开发 `5173`，生产 `9908`                |
| `--admin-password` | `ADMIN_PASSWORD` | `package.json` 本地默认值；生产必须覆盖 |


## 许可

[MIT License](LICENSE)。
