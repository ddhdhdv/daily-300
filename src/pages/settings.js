/**
 * 设置页：主题切换、导出/导入 JSON 备份、清空数据、存储说明。
 */
import { getAllRecords, importRecords, clearAllRecords, isFallbackMode } from '../core/db.js'
import { getTheme, setTheme } from '../core/theme.js'
import { showConfirmModal } from '../ui/modal.js'
import { showToast } from '../ui/toast.js'
import { todayStr, isValidDateStr } from '../core/date.js'

const THEMES = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' }
]

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** 解析备份文件：兼容 {records:[...]} 与裸数组两种格式，逐条校验 */
function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, message: '导入失败：文件格式不正确' }
  }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.records) ? data.records : null
  if (!list) return { ok: false, message: '导入失败：文件格式不正确' }

  const items = []
  for (const it of list) {
    if (!it || typeof it !== 'object') continue
    const date = typeof it.date === 'string' ? it.date : null
    const completed = it.completed
    const target = Number.isInteger(it.target) && it.target > 0 ? it.target : 300
    if (!isValidDateStr(date)) continue
    if (!Number.isInteger(completed) || completed < 0) continue
    items.push({ date, target, completed })
  }
  if (items.length === 0) return { ok: false, message: '导入失败：文件中没有有效记录' }
  return { ok: true, items }
}

export async function render(el, ctx) {
  const theme = getTheme()
  const fallback = isFallbackMode()

  el.innerHTML = `
    <section class="page">
      <header class="page-head"><h1>设置</h1></header>

      <div class="set-group">
        <h2 class="set-group-title">主题</h2>
        <div class="card set-card">
          <div class="set-row">
            <span>外观</span>
            <div class="segmented" id="theme-seg">
              ${THEMES.map((t) => `<button type="button" data-theme="${t.id}" class="${t.id === theme ? 'active' : ''}">${t.label}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="set-group">
        <h2 class="set-group-title">数据管理</h2>
        <div class="card set-card">
          <div class="set-row">
            <div class="set-row-text">
              <span class="set-row-title">导出数据</span>
              <span class="set-row-sub">导出全部刷题记录为 JSON 备份文件</span>
            </div>
            <button type="button" class="btn btn-outline" id="btn-export">导出</button>
          </div>
          <div class="set-row">
            <div class="set-row-text">
              <span class="set-row-title">导入数据</span>
              <span class="set-row-sub">从之前导出的 JSON 备份恢复（同日期覆盖）</span>
            </div>
            <button type="button" class="btn btn-outline" id="btn-import">导入</button>
            <input type="file" id="file-import" accept=".json,application/json" hidden />
          </div>
          <div class="set-row">
            <div class="set-row-text">
              <span class="set-row-title">清空数据</span>
              <span class="set-row-sub">删除全部记录，操作不可恢复</span>
            </div>
            <button type="button" class="btn btn-danger-outline" id="btn-clear">清空</button>
          </div>
        </div>
      </div>

      <div class="set-group">
        <h2 class="set-group-title">存储说明</h2>
        <div class="card set-card">
          <div class="set-note">
            ${
              fallback
                ? '<p class="warn">⚠️ 当前浏览器 IndexedDB 不可用，已临时降级为 localStorage 存储，数据可能随浏览器数据清理丢失，请尽快导出备份。</p>'
                : '<p>数据保存在本设备的 IndexedDB 中（数据库名 daily300），不上传任何服务器。更换设备或清除浏览器数据前，请先导出备份。</p>'
            }
            <p>每日目标固定为 300 题。</p>
          </div>
        </div>
      </div>
    </section>`

  // 主题切换
  el.querySelector('#theme-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme]')
    if (!btn) return
    setTheme(btn.dataset.theme)
    el.querySelectorAll('#theme-seg button').forEach((b) => b.classList.toggle('active', b === btn))
  })

  // 导出
  el.querySelector('#btn-export').addEventListener('click', async () => {
    try {
      const records = await getAllRecords()
      const data = {
        app: 'daily-300-questions',
        version: 1,
        exportedAt: new Date().toISOString(),
        records: records.map(({ date, target, completed }) => ({ date, target, completed }))
      }
      downloadJSON(`daily-question-backup-${todayStr()}.json`, data)
      showToast(`已导出 ${records.length} 条记录`, 'success')
    } catch {
      showToast('导出失败，请重试', 'error')
    }
  })

  // 导入
  const fileInput = el.querySelector('#file-import')
  el.querySelector('#btn-import').addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0]
    fileInput.value = ''
    if (!file) return

    let text = null
    try {
      text = await file.text()
    } catch {
      text = null
    }
    if (text == null) {
      showToast('导入失败：无法读取文件', 'error')
      return
    }

    const parsed = parseBackup(text)
    if (!parsed.ok) {
      showToast(parsed.message, 'error', 3200)
      return
    }

    const existing = await getAllRecords()
    const existingDates = new Set(existing.map((r) => r.date))
    const overlap = parsed.items.filter((i) => existingDates.has(i.date)).length

    showConfirmModal({
      title: '导入数据',
      message: `共 ${parsed.items.length} 条有效记录，其中 ${overlap} 条将覆盖已有同日期记录。导入数据可能覆盖已有记录，是否继续？`,
      confirmText: '继续导入',
      onConfirm: async () => {
        try {
          const res = await importRecords(parsed.items)
          showToast(`导入成功：新增 ${res.added} 条，覆盖 ${res.updated} 条`, 'success', 3200)
          ctx.refresh()
        } catch (err) {
          showToast(`导入失败：${(err && err.message) || '未知错误'}`, 'error')
        }
      }
    })
  })

  // 清空
  el.querySelector('#btn-clear').addEventListener('click', () => {
    showConfirmModal({
      title: '清空所有数据',
      message: '将删除全部刷题记录，且无法恢复。建议先导出备份。确定要清空吗？',
      confirmText: '全部删除',
      danger: true,
      onConfirm: async () => {
        try {
          await clearAllRecords()
          showToast('已清空所有记录', 'success')
          ctx.refresh()
        } catch {
          showToast('清空失败，请重试', 'error')
        }
      }
    })
  })
}
