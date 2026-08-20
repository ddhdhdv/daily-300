// E2E 自动化测试：使用 playwright-core 驱动本地 Chrome，对 10 项需求逐项验证。
// 运行：node scripts/e2e.js
import { chromium } from 'playwright-core'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CHROME = path.join(process.env.USERPROFILE, '.agent-browser', 'browsers', 'chrome-152.0.7977.54', 'chrome.exe')
const URL = 'http://localhost:5173/'
const SHOT_DIR = path.join(ROOT, 'shots')
if (!existsSync(SHOT_DIR)) await mkdir(SHOT_DIR, { recursive: true })

const results = []
function pass(name, note = '') {
  results.push({ name, ok: true, note })
  console.log(`  ✅ ${name}${note ? ' — ' + note : ''}`)
}
function fail(name, note = '') {
  results.push({ name, ok: false, note })
  console.log(`  ❌ ${name}${note ? ' — ' + note : ''}`)
}

function today() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function dayStr(off) {
  const d = new Date()
  d.setDate(d.getDate() + off)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 通过 evaluate 拿数据库快照，便于断言
async function dbAll(page) {
  return await page.evaluate(async () => {
    const m = window.__daily300
    if (!m) return null
    const list = await m.getAllRecords()
    return list.map(r => ({ date: r.date, target: r.target, completed: r.completed }))
  })
}
async function dbSet(page, date, completed) {
  return await page.evaluate(async ({ d, c }) => {
    const m = window.__daily300
    return m.setCompleted(d, c, 300)
  }, { d: date, c: completed })
}
async function dbClear(page) {
  return await page.evaluate(async () => {
    return window.__daily300.clearAllRecords()
  })
}

async function getRing(page) {
  return await page.evaluate(() => {
    const num = document.querySelector('.ring-number .num')?.textContent?.trim()
    const pct = document.querySelector('.ring-pct')?.textContent?.trim()
    const denom = document.querySelector('.ring-number .denom')?.textContent?.trim()
    const text = document.querySelector('.progress-text')?.textContent?.trim()
    const status = document.querySelector('.status-line')?.textContent?.trim()
    return { num, pct, denom, text, status }
  })
}

async function main() {
  console.log('启动浏览器…')
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
  // 拦截文件下载：导出时让 browser 弹起下载
  const page = await context.newPage()
  page.on('console', msg => { if (msg.type() === 'error') console.log('  [console.error]', msg.text()) })
  page.on('pageerror', err => console.log('  [pageerror]', err.message))

  try {
    console.log('\n=== 准备：注入调试钩子 ===')
    // 首启注入调试钩子（让 __daily300 可在 evaluate 调用）
    await page.addInitScript(() => {
      // 等待 db.js 加载完成后挂载
      const tryMount = () => {
        import('/src/core/db.js').then(mod => {
          window.__daily300 = {
            getAllRecords: mod.getAllRecords,
            getRecord: mod.getRecord,
            setCompleted: mod.setCompleted,
            ensureRecord: mod.ensureRecord,
            clearAllRecords: mod.clearAllRecords,
            importRecords: mod.importRecords
          }
        })
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryMount)
      } else {
        tryMount()
      }
    })

    console.log('\n=== 测试 1：首次打开，今日应为 0 / 300 ===')
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('.ring-number .num')
    // 等待调试钩子就绪
    await page.waitForFunction(() => window.__daily300, null, { timeout: 5000 })
    let r = await getRing(page)
    if (r.num === '0' && r.denom === '/ 300' && r.pct === '0%') pass('T1 首次打开 0/300', JSON.stringify(r))
    else fail('T1 首次打开 0/300', JSON.stringify(r))
    await page.screenshot({ path: path.join(SHOT_DIR, 't1-initial.png') })

    console.log('\n=== 测试 2：点击 +10，应为 10/300 ===')
    await page.click('button[data-delta="10"]')
    await page.waitForFunction(() => document.querySelector('.ring-number .num')?.textContent === '10')
    r = await getRing(page)
    if (r.num === '10' && r.pct === '3.3%') pass('T2 +10 后 10/300', JSON.stringify(r))
    else fail('T2 +10 后 10/300', JSON.stringify(r))
    await page.screenshot({ path: path.join(SHOT_DIR, 't2-after-plus10.png') })

    console.log('\n=== 测试 3：修改为 300，应为 100% ===')
    await page.click('.btn-edit')
    await page.waitForSelector('.number-input', { state: 'visible' })
    await page.fill('.number-input', '300')
    await page.click('form.number-form button[type="submit"]')
    await page.waitForFunction(() => document.querySelector('.ring-number .num')?.textContent === '300')
    r = await getRing(page)
    if (r.num === '300' && r.pct === '100%' && r.text.includes('已完成 300')) pass('T3 修改为 300', JSON.stringify(r))
    else fail('T3 修改为 300', JSON.stringify(r))
    await page.screenshot({ path: path.join(SHOT_DIR, 't3-300.png') })

    console.log('\n=== 测试 4：修改为 350，应为 116.7% 超额 50 ===')
    await page.click('.btn-edit')
    await page.waitForSelector('.number-input', { state: 'visible' })
    await page.fill('.number-input', '350')
    await page.click('form.number-form button[type="submit"]')
    await page.waitForFunction(() => document.querySelector('.ring-number .num')?.textContent === '350')
    r = await getRing(page)
    if (r.num === '350' && r.pct === '116.7%' && r.text.includes('超额 50') && /超额完成 50 题/.test(r.status)) pass('T4 修改为 350 超额', JSON.stringify(r))
    else fail('T4 修改为 350 超额', JSON.stringify(r))
    await page.screenshot({ path: path.join(SHOT_DIR, 't4-350.png') })

    console.log('\n=== 测试 5：刷新页面后 350 仍存在（持久化） ===')
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector('.ring-number .num')
    await page.waitForFunction(() => document.querySelector('.ring-number .num')?.textContent === '350')
    r = await getRing(page)
    if (r.num === '350' && r.pct === '116.7%') pass('T5 刷新后仍为 350', JSON.stringify(r))
    else fail('T5 刷新后仍为 350', JSON.stringify(r))

    console.log('\n=== 测试 6：创建昨天记录 280，检查历史 ===')
    const y = yesterday()
    await dbSet(page, y, 280)
    // 进入历史页
    await page.click('.tab[data-tab="history"]')
    await page.waitForSelector('.history-list')
    const hist = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.history-item')]
      return items.map(it => ({
        date: it.dataset.date,
        sub: it.querySelector('.hi-sub')?.textContent?.trim(),
        tag: it.querySelector('.tag')?.textContent?.trim()
      }))
    })
    const yi = hist.find(h => h.date === y)
    if (yi && yi.sub.includes('280 / 300') && yi.sub.includes('93.3%') && yi.tag === '未完成') pass('T6 昨天 280 出现在历史', JSON.stringify(yi))
    else fail('T6 昨天 280 出现在历史', JSON.stringify(hist))
    await page.screenshot({ path: path.join(SHOT_DIR, 't6-history.png') })

    console.log('\n=== 测试 7：修改昨天 280→300，统计/连续重算 ===')
    await page.evaluate((d) => {
      const btn = [...document.querySelectorAll('.history-item')].find(b => b.dataset.date === d)
      btn?.click()
    }, y)
    await page.waitForSelector('.day-detail')
    await page.click('.day-detail .btn-outline')
    await page.waitForSelector('.number-input', { state: 'visible' })
    await page.fill('.number-input', '300')
    await page.click('form.number-form button[type="submit"]')
    await page.waitForTimeout(400)
    // 关闭详情弹层
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
    // 切到统计页
    await page.click('.tab[data-tab="stats"]')
    await page.waitForSelector('.stats-grid')
    const stats = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.stat-card')]
      const get = label => cards.find(c => c.querySelector('.stat-label')?.textContent?.includes(label))?.querySelector('.stat-value')?.textContent?.trim()
      return {
        streak: get('当前连续达标'),
        today: get('今日完成'),
        achieved: get('达成目标'),
        total: get('累计完成')
      }
    })
    // 今天=350 达标 + 昨天=300 达标 → 连续 2 天；累计=650；达成=2 天
    if (stats.streak === '2天' && stats.today === '350题' && stats.achieved === '2天' && stats.total === '650题') pass('T7 改昨天 300 后统计/连续重算', JSON.stringify(stats))
    else fail('T7 改昨天 300 后统计/连续重算', JSON.stringify(stats))
    await page.screenshot({ path: path.join(SHOT_DIR, 't7-stats.png') })

    console.log('\n=== 测试 8：连续打卡算法（用户给定场景） ===')
    // 场景 A: 8/14-8/20 序列，今天 350（实际今天是 8/20）
    // 构造 8/14=300, 8/15=320, 8/16=300, 8/17=280, 8/18=350, 8/19=300, 8/20=350
    // 从今天往前：8/20(350)✅, 8/19(300)✅, 8/18(350)✅, 8/17(280)❌ → 连续 3 天
    // 实际今天就是 8/20（8 月）。但我们不能保证今天是 8/20。
    // 改为通用：今天=达标 N，从昨天开始连续达标 K，从昨天往前中断 → 连续 K+1
    // 这里构造：今天 350 + 8/14~8/19 中前 4 天达标，第 5 天(8/17) 不达标 → 从今天往回数应得 3 天
    const base = new Date()
    // 用 dayStr(off) 取相对日期，今天是 dayStr(0)
    const seq = [-1, -2, -3, -4, -5, -6] // 昨天 ~ 6 天前
    const vals = [300, 300, 350, 280, 300, 320] // 昨天300, 前天300, 3天前350, 4天前280(断), 5天前300, 6天前320
    for (let i = 0; i < seq.length; i++) await dbSet(page, dayStr(seq[i]), vals[i])
    // 触发统计页刷新
    await page.click('.tab[data-tab="today"]')
    await page.waitForSelector('.ring-number .num')
    await page.click('.tab[data-tab="stats"]')
    await page.waitForSelector('.stats-grid')
    let stats2 = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.stat-card')]
      const get = label => cards.find(c => c.querySelector('.stat-label')?.textContent?.includes(label))?.querySelector('.stat-value')?.textContent?.trim()
      return { streak: get('当前连续达标') }
    })
    // 期望：今天350(达标) + 昨天300(达标) + 前天300(达标) + 3天前350(达标) + 4天前280(中断) → 连续 4 天
    if (stats2.streak === '4天') pass('T8a 今天达标场景连续 4 天', JSON.stringify(stats2))
    else fail('T8a 今天达标场景连续 4 天', JSON.stringify(stats2))
    // 场景 B：把今天改成 180，今天未达标，应从昨天往回数
    await dbSet(page, dayStr(0), 180)
    await page.click('.tab[data-tab="today"]')
    await page.waitForSelector('.ring-number .num')
    await page.click('.tab[data-tab="stats"]')
    await page.waitForSelector('.stats-grid')
    let stats3 = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.stat-card')]
      const get = label => cards.find(c => c.querySelector('.stat-label')?.textContent?.includes(label))?.querySelector('.stat-value')?.textContent?.trim()
      return { streak: get('当前连续达标') }
    })
    // 期望：今天 180 不达标，从昨天起：昨天300(✅)前天300(✅)3天前350(✅)4天前280(❌) → 连续 3 天
    if (stats3.streak === '3天') pass('T8b 今天未达标 → 连续 3 天', JSON.stringify(stats3))
    else fail('T8b 今天未达标 → 连续 3 天', JSON.stringify(stats3))
    await page.screenshot({ path: path.join(SHOT_DIR, 't8-streak.png') })

    console.log('\n=== 测试 9：导出 → 清空 → 导入 → 恢复 ===')
    // 先恢复今天为 350
    await dbSet(page, dayStr(0), 350)
    // 切到设置页
    await page.click('.tab[data-tab="settings"]')
    await page.waitForSelector('#btn-export')
    // 触发下载：监听 download 事件
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-export')
    ])
    const dlPath = path.join(SHOT_DIR, 'backup.json')
    await download.saveAs(dlPath)
    const backup = JSON.parse(await readFile(dlPath, 'utf8'))
    if (backup.records && backup.records.length >= 1) pass('T9a 导出 JSON', `${backup.records.length} 条记录`)
    else fail('T9a 导出 JSON', JSON.stringify(backup).slice(0, 200))
    // 清空数据库（通过 UI）
    await page.click('#btn-clear')
    await page.waitForSelector('.modal-box')
    await page.click('.modal-box .btn-danger')
    await page.waitForTimeout(500)
    let after = await dbAll(page)
    if (after.length === 0) pass('T9b 清空数据', '已清空')
    else fail('T9b 清空数据', JSON.stringify(after))
    // 切到今日页 → 重新创建今日 0
    await page.click('.tab[data-tab="today"]')
    await page.waitForSelector('.ring-number .num')
    // 导入：通过 file input 上传备份文件（hidden input 不需等待可见，直接设文件）
    await page.click('.tab[data-tab="settings"]')
    await page.waitForSelector('#btn-import')
    await page.setInputFiles('#file-import', dlPath)
    await page.waitForSelector('.modal-box')
    await page.click('.modal-box .btn-primary')
    await page.waitForTimeout(800)
    after = await dbAll(page)
    if (after.length === backup.records.length) pass('T9c 导入恢复记录', `${after.length} 条`)
    else fail('T9c 导入恢复记录', `备份 ${backup.records.length}, 当前 ${after.length}`)
    await page.screenshot({ path: path.join(SHOT_DIR, 't9-after-import.png') })

    console.log('\n=== 测试 10：手机尺寸适配 + PWA ===')
    // 当前已是 375x812 视口
    await page.click('.tab[data-tab="today"]')
    await page.waitForSelector('.ring-number .num')
    // 1) 无横向滚动
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }))
    if (overflow.scrollWidth <= overflow.innerWidth + 1) pass('T10a 无横向滚动', JSON.stringify(overflow))
    else fail('T10a 无横向滚动', JSON.stringify(overflow))
    // 2) 底部导航存在且可见
    const tabbar = await page.evaluate(() => {
      const tb = document.querySelector('.tabbar')
      const rect = tb.getBoundingClientRect()
      return { visible: rect.height > 0, top: rect.top, bottom: rect.bottom, wH: window.innerHeight }
    })
    if (tabbar.visible && tabbar.bottom <= tabbar.wH + 5 && tabbar.bottom > tabbar.wH - 100) pass('T10b 底部导航定位', JSON.stringify(tabbar))
    else fail('T10b 底部导航定位', JSON.stringify(tabbar))
    // 3) 按钮可点（点击区不小于 36px）
    const btnSize = await page.evaluate(() => {
      const b = document.querySelector('.btn-quick')
      const r = b.getBoundingClientRect()
      return { w: r.width, h: r.height }
    })
    if (btnSize.h >= 44) pass('T10c 快捷按钮可点 (h≥44px)', JSON.stringify(btnSize))
    else fail('T10c 快捷按钮可点', JSON.stringify(btnSize))
    // 4) PWA：manifest 可达、SW 注册
    const pwa = await page.evaluate(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        return { hasSW: !!reg, swScope: reg?.scope || '' }
      } catch { return { hasSW: false, error: 'n/a' } }
    })
    if (pwa.hasSW) pass('T10d Service Worker 已注册', JSON.stringify(pwa))
    else fail('T10d Service Worker 已注册', JSON.stringify(pwa))
    // manifest + 图标
    const mfRes = await page.evaluate(async () => {
      const r = await fetch('/manifest.json')
      return { ok: r.ok, type: r.headers.get('content-type') }
    })
    if (mfRes.ok) pass('T10e manifest.json 可达', JSON.stringify(mfRes))
    else fail('T10e manifest.json 可达', JSON.stringify(mfRes))
    await page.screenshot({ path: path.join(SHOT_DIR, 't10-mobile-today.png') })
    // 浅色 + 深色 截图
    await page.click('.tab[data-tab="settings"]')
    await page.waitForSelector('#theme-seg')
    await page.click('#theme-seg button[data-theme="dark"]')
    await page.waitForTimeout(300)
    await page.click('.tab[data-tab="today"]')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(SHOT_DIR, 't10-mobile-dark.png') })
    await page.click('.tab[data-tab="settings"]')
    await page.click('#theme-seg button[data-theme="light"]')
    await page.waitForTimeout(200)
    await page.click('.tab[data-tab="calendar"]')
    await page.waitForSelector('.cal-grid')
    await page.screenshot({ path: path.join(SHOT_DIR, 't10-mobile-calendar.png') })
    await page.click('.tab[data-tab="history"]')
    await page.waitForSelector('.history-list')
    await page.screenshot({ path: path.join(SHOT_DIR, 't10-mobile-history.png') })
  } catch (err) {
    console.log('\n!!! 测试过程中出错：', err.message)
    console.log(err.stack)
    fail('整体流程', err.message)
  } finally {
    await context.close()
    await browser.close()
  }

  console.log('\n=== 测试结果汇总 ===')
  const passN = results.filter(r => r.ok).length
  const failN = results.filter(r => !r.ok).length
  console.log(`通过 ${passN} / 失败 ${failN} / 总计 ${results.length}`)
  if (failN > 0) {
    console.log('\n失败项：')
    for (const r of results.filter(x => !x.ok)) console.log(`  - ${r.name}: ${r.note}`)
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
