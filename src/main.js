/**
 * 应用入口：骨架布局（页面容器 + 底部导航）、页面切换、Service Worker 注册、跨天检测。
 */
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'
import { applyTheme } from './core/theme.js'
import { todayStr } from './core/date.js'
import { showToast } from './ui/toast.js'
import * as todayPage from './pages/today.js'
import * as historyPage from './pages/history.js'
import * as calendarPage from './pages/calendar.js'
import * as statsPage from './pages/stats.js'
import * as settingsPage from './pages/settings.js'

const ICONS = {
  today:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  stats:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20v-9M12 20V4M19 20v-6"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>'
}

const TABS = [
  { id: 'today', label: '今日', icon: ICONS.today, page: todayPage },
  { id: 'history', label: '历史', icon: ICONS.history, page: historyPage },
  { id: 'calendar', label: '日历', icon: ICONS.calendar, page: calendarPage },
  { id: 'stats', label: '统计', icon: ICONS.stats, page: statsPage },
  { id: 'settings', label: '设置', icon: ICONS.settings, page: settingsPage }
]

const app = document.getElementById('app')
app.innerHTML = `
  <main id="page" class="page-container"></main>
  <nav class="tabbar" aria-label="主导航">
    ${TABS.map((t) => `<button type="button" class="tab" data-tab="${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')}
  </nav>`

const pageEl = document.getElementById('page')
let current = null

const ctx = {
  switchPage,
  refresh: () => renderPage()
}

async function switchPage(id) {
  current = id
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id))
  await renderPage()
}

async function renderPage() {
  const tab = TABS.find((t) => t.id === current)
  if (!tab) return
  pageEl.innerHTML = '<div class="page-loading">加载中…</div>'
  try {
    await tab.page.render(pageEl, ctx)
    window.scrollTo(0, 0)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    pageEl.innerHTML = '<div class="page-error">页面加载出错，请刷新重试</div>'
  }
}

document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    if (t.dataset.tab !== current) switchPage(t.dataset.tab)
  })
)

/* 跨天检测：每 30 秒 + 页面重新可见时检查，跨天自动进入新的今天 */
let lastDay = todayStr()
function checkRollover() {
  const now = todayStr()
  if (now !== lastDay) {
    lastDay = now
    showToast('新的一天，继续加油！', 'info')
    switchPage('today')
  }
}
setInterval(checkRollover, 30000)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkRollover()
})

/* Service Worker 注册（localhost / HTTPS 下生效；局域网 HTTP 下静默跳过） */
function registerSW() {
  if (!('serviceWorker' in navigator)) return
  const doRegister = () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* 非安全上下文（如局域网 IP 直连）下无法注册，忽略 */
    })
  }
  if (document.readyState === 'complete') {
    doRegister()
  } else {
    window.addEventListener('load', doRegister, { once: true })
  }
}

async function init() {
  applyTheme()
  await switchPage('today')
  registerSW()
}

init()
