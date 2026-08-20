// 验证 GitHub Pages 模拟环境（vite preview + base 子路径）功能完整
import { chromium } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = path.join(process.env.USERPROFILE, '.agent-browser', 'browsers', 'chrome-152.0.7977.54', 'chrome.exe')
const BASE = 'http://127.0.0.1:4173/daily-300/'

const results = []
const pass = (n, note = '') => { results.push([n, true]); console.log(`  ✅ ${n}${note ? ' — ' + note : ''}`) }
const fail = (n, note = '') => { results.push([n, false]); console.log(`  ❌ ${n}${note ? ' — ' + note : ''}`) }

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  try {
    console.log('打开子路径站点…', BASE)
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForSelector('.ring-number .num', { timeout: 8000 })

    // 1) 页面加载且无 JS 错误
    if (errors.length === 0) pass('V1 页面无 JS 错误')
    else fail('V1 页面无 JS 错误', errors.join(' | '))

    // 2) 今日页数据正常（预览库为空 → 0/300）
    const r = await page.evaluate(() => ({
      num: document.querySelector('.ring-number .num')?.textContent?.trim(),
      denom: document.querySelector('.ring-number .denom')?.textContent?.trim()
    }))
    if (r.num && r.denom === '/ 300') pass('V2 今日页渲染', JSON.stringify(r))
    else fail('V2 今日页渲染', JSON.stringify(r))

    // 3) 快捷按钮工作
    await page.click('button[data-delta="50"]')
    await page.waitForFunction(() => document.querySelector('.ring-number .num')?.textContent === '50')
    pass('V3 +50 后 50/300')

    // 4) manifest 与 SW
    const pwa = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      const link = document.querySelector('link[rel="manifest"]')?.href || ''
      return { hasSW: !!reg, scope: reg?.scope || '', manifestHref: link }
    })
    if (pwa.hasSW && pwa.scope.includes('/daily-300/') && pwa.manifestHref.includes('/daily-300/manifest.json')) pass('V4 SW+manifest 子路径', JSON.stringify(pwa))
    else fail('V4 SW+manifest 子路径', JSON.stringify(pwa))

    // 5) manifest 内容可解析（相对路径 icons）
    const mf = await page.evaluate(async () => {
      const r = await fetch('manifest.json')
      return await r.json()
    })
    if (mf.start_url === './' && mf.icons?.length === 3) pass('V5 manifest 内容', `icons=${mf.icons.length}`)
    else fail('V5 manifest 内容', JSON.stringify(mf).slice(0, 150))

    // 6) 图标资源
    const iconOk = await page.evaluate(async () => {
      const r = await fetch('icons/icon-192.png')
      return r.ok
    })
    if (iconOk) pass('V6 图标可达')
    else fail('V6 图标可达')

    await page.screenshot({ path: 'shots/preview-subpath.png' })
  } catch (e) {
    fail('整体', e.message)
    console.log(e.stack)
  } finally {
    await context.close()
    await browser.close()
  }

  console.log(`\n结果: ${results.filter(r => r[1]).length}/${results.length} 通过`)
  if (results.some(r => !r[1])) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
