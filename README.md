# 每日300题 PWA 项目说明

## 启动

```bash
cd "D:\行测\进度"
npm install      # 首次需要
npm run dev      # 开发服务器，地址 http://localhost:5173
# 局域网访问（手机同 WiFi 下）
npm run dev -- --host 0.0.0.0
# 生产构建
npm run build    # 产物在 dist/
npm run preview  # 本地预览构建产物
```

## 手机访问
- 电脑和手机连同一 WiFi
- 终端启动后 Vite 会显示 `Network: http://192.168.x.x:5173/`
- 手机浏览器打开该地址即可
- 注意：手机走局域网 HTTP（非安全上下文）时，Service Worker / PWA 安装 / 离线访问无法生效。如需完整体验，请用 `vite preview --host` + Cloudflare Tunnel 等把本地映射到 HTTPS，或将 `dist/` 部署到任意免费静态托管（GitHub Pages、Vercel、Netlify、CloudStudio 等）。

## 添加到主屏幕

**Android（Chrome / Edge）**
1. 用手机浏览器打开应用
2. 右上角菜单 → "添加到主屏幕" / "安装应用"
3. 桌面会出现"300题"图标，独立窗口运行

**iPhone（Safari）**
1. 用 Safari 打开应用
2. 底部"分享"按钮 → "添加到主屏幕"
3. 桌面会出现"300题"图标，独立窗口运行

## 数据位置
- 浏览器本地 IndexedDB（数据库名 `daily300`，对象仓库 `records`）
- 不上传任何服务器，不依赖网络
- 跨设备 / 清缓存前请先在「设置 → 导出数据」备份为 JSON
- 备份文件名格式：`daily-question-backup-YYYY-MM-DD.json`

## 自动化测试
```bash
node scripts/e2e.mjs
```
- 用 playwright-core 驱动本地 Chrome（已下载在 `~/.agent-browser/browsers/`）
- 17 项断言覆盖需求 1-10
- 截图输出到 `shots/`
- 失败项会在末尾汇总并退出码 1
