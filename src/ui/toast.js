/**
 * 轻量 toast 提示（避开底部导航栏）。
 */
let container = null

function ensureContainer() {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

export function showToast(message, type = 'info', duration = 2600) {
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.setAttribute('role', 'status')
  el.textContent = message
  ensureContainer().appendChild(el)
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.remove(), 400)
  }, duration)
}
