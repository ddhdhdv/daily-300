/**
 * 日历页：月视图，按完成状态着色；点击任意日期查看详情（过去/今天可修改，未来主动点击可创建）。
 */
import { getAllRecords } from '../core/db.js'
import { todayStr, pad } from '../core/date.js'
import { showDayDetail } from '../ui/day-detail.js'

// 视图状态：切换页面后仍停留在当前浏览的月份
let view = null

function shiftMonth(n) {
  const d = new Date(view.y, view.m + n, 1)
  view = { y: d.getFullYear(), m: d.getMonth() }
}

function cellClass(dateStr, record, today) {
  if (record && record.completed > 0) {
    if (record.completed > record.target) return 'over'
    if (record.completed >= record.target) return 'done'
    return 'partial'
  }
  if (dateStr > today) return 'future'
  return 'zero'
}

export async function render(el, ctx) {
  const records = await getAllRecords()
  const map = new Map(records.map((r) => [r.date, r]))
  const today = todayStr()
  const now = new Date()
  if (!view) view = { y: now.getFullYear(), m: now.getMonth() }

  // 周一开头；补齐前后空白
  const first = new Date(view.y, view.m, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${view.y}-${pad(view.m + 1)}-${pad(d)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  el.innerHTML = `
    <section class="page">
      <header class="page-head">
        <h1>日历</h1>
        <div class="cal-nav">
          <button type="button" class="btn btn-icon" id="cal-prev" aria-label="上一个月">‹</button>
          <span class="cal-title">${view.y}年${view.m + 1}月</span>
          <button type="button" class="btn btn-icon" id="cal-next" aria-label="下一个月">›</button>
        </div>
      </header>

      <div class="card cal-card">
        <div class="cal-week">${['一', '二', '三', '四', '五', '六', '日'].map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">
          ${cells
            .map((c) => {
              if (!c) return '<span class="cal-cell empty"></span>'
              const r = map.get(c)
              const cls = cellClass(c, r, today)
              const isToday = c === today
              return `<button type="button" class="cal-cell ${cls}${isToday ? ' today' : ''}" data-date="${c}">${Number(c.slice(8))}</button>`
            })
            .join('')}
        </div>
        <div class="cal-legend">
          <span><i class="dot dot-done"></i>达标</span>
          <span><i class="dot dot-over"></i>超额</span>
          <span><i class="dot dot-partial"></i>未达标</span>
          <span><i class="dot dot-zero"></i>0题</span>
        </div>
      </div>
    </section>`

  el.querySelector('#cal-prev').addEventListener('click', () => {
    shiftMonth(-1)
    ctx.refresh()
  })
  el.querySelector('#cal-next').addEventListener('click', () => {
    shiftMonth(1)
    ctx.refresh()
  })
  el.querySelectorAll('.cal-cell[data-date]').forEach((c) => {
    c.addEventListener('click', () => showDayDetail(c.dataset.date, () => ctx.refresh()))
  })
}
