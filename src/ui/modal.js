/**
 * 弹层：手机端底部上滑面板，桌面端居中卡片。
 * 提供 openModal / closeModal / showConfirmModal / showNumberModal。
 */
import { parseCount } from '../core/validate.js'

let active = null

function handleKey(e) {
  if (e.key === 'Escape') closeModal()
}

export function closeModal() {
  if (!active) return
  const { el, onClose } = active
  active = null
  document.removeEventListener('keydown', handleKey)
  el.classList.remove('show')
  setTimeout(() => {
    el.remove()
    if (!active) document.body.classList.remove('modal-open')
  }, 220)
  if (typeof onClose === 'function') onClose()
}

export function openModal(contentEl, opts = {}) {
  closeModal()
  const el = document.createElement('div')
  el.className = 'modal-overlay'
  const sheet = document.createElement('div')
  sheet.className = 'modal-sheet'
  sheet.appendChild(contentEl)
  el.appendChild(sheet)
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal()
  })
  document.body.appendChild(el)
  document.body.classList.add('modal-open')
  active = { el, onClose: opts.onClose }
  document.addEventListener('keydown', handleKey)
  requestAnimationFrame(() => el.classList.add('show'))
  const input = contentEl.querySelector('input')
  if (input) setTimeout(() => input.focus(), 260)
}

function buildBox() {
  const box = document.createElement('div')
  box.className = 'modal-box'
  return box
}

/** 确认弹层 */
export function showConfirmModal({ title, message, confirmText = '确定', cancelText = '取消', danger = false, onConfirm }) {
  const box = buildBox()
  const h = document.createElement('h3')
  h.className = 'modal-title'
  h.textContent = title
  const p = document.createElement('p')
  p.className = 'modal-message'
  p.textContent = message
  const actions = document.createElement('div')
  actions.className = 'modal-actions'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'btn btn-ghost'
  cancel.textContent = cancelText
  cancel.addEventListener('click', closeModal)
  const ok = document.createElement('button')
  ok.type = 'button'
  ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`
  ok.textContent = confirmText
  ok.addEventListener('click', () => {
    closeModal()
    if (typeof onConfirm === 'function') onConfirm()
  })
  actions.append(cancel, ok)
  box.append(h, p, actions)
  openModal(box)
}

/** 数字输入弹层（题量修改） */
export function showNumberModal({ title, label = '完成题数', value = 0, hint = '', onConfirm }) {
  const box = buildBox()
  const h = document.createElement('h3')
  h.className = 'modal-title'
  h.textContent = title
  const form = document.createElement('form')
  form.className = 'number-form'
  form.innerHTML = `
    <label class="number-label">${label}</label>
    <input class="number-input" type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${value}" />
    ${hint ? `<p class="number-hint">${hint}</p>` : ''}
    <p class="number-error" hidden></p>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-act="cancel">取消</button>
      <button type="submit" class="btn btn-primary">保存</button>
    </div>`
  const input = form.querySelector('.number-input')
  const errEl = form.querySelector('.number-error')

  form.querySelector('[data-act="cancel"]').addEventListener('click', closeModal)
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const parsed = parseCount(input.value)
    if (!parsed.ok) {
      errEl.textContent = parsed.message
      errEl.hidden = false
      input.focus()
      return
    }
    errEl.hidden = true
    const n = parsed.value
    closeModal()
    if (typeof onConfirm === 'function') onConfirm(n)
  })

  box.append(h, form)
  openModal(box)
}
