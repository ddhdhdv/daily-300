import { defineConfig } from 'vite'

// GitHub Pages 部署在 https://<user>.github.io/daily-300/ 子路径下
const isCI = !!process.env.CI
const repoName = 'daily-300'

export default defineConfig({
  // CI 构建时使用子路径；本地 dev 保持根路径，两种环境都正常
  base: isCI ? `/${repoName}/` : '/',
  server: {
    // 允许局域网访问（手机同 WiFi 下可打开）
    host: true,
    port: 5173
  },
  build: {
    target: 'es2019'
  }
})
