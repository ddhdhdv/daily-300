/**
 * 主题：浅色 / 深色 / 跟随系统（默认），持久化到 localStorage。
 */
const KEY = 'daily300-theme'
const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' || t === 'system' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function resolvedTheme() {
  const t = getTheme()
  if (t !== 'system') return t
  return mql && mql.matches ? 'dark' : 'light'
}

export function applyTheme() {
  const r = resolvedTheme()
  document.documentElement.dataset.theme = r
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', r === 'dark' ? '#12141c' : '#4f6ef7')
}

export function setTheme(t) {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* 隐私模式等：仅本次生效 */
  }
  applyTheme()
}

if (mql) {
  const onChange = () => {
    if (getTheme() === 'system') applyTheme()
  }
  if (mql.addEventListener) mql.addEventListener('change', onChange)
  else if (mql.addListener) mql.addListener(onChange)
}
