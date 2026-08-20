/**
 * 历史页：按日期从新到旧列出所有记录，点击查看详情并可修改。
 */
import { getAllRecords } from '../core/db.js'
import { formatCn } from '../core/date.js'
import { percent } from '../core/stats.js'
import { showDayDetail } from '../ui/day-detail.js'

function statusOf(r) {
  if (r.completed > r.target) return { label: '超额完成', cls: 'tag-blue' }
  if (r.completed >= r.target) return { label: '已完成', cls: 'tag-green' }
  if (r.completed > 0) return { label: '未完成', cls: 'tag-orange' }
  return { label: '未开始', cls: 'tag-gray' }
}

export async function render(el, ctx) {
  const records = await getAllRecords()

  if (records.length === 0) {
    el.innerHTML = `
      <section class="page">
        <header class="page-head"><h1>历史记录</h1></header>
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <p class="empty-title">还没有刷题记录</p>
          <p class="empty-sub">今天开始你的第一天吧！</p>
          <button type="button" class="btn btn-primary" data-goto="today">去今日打卡</button>
        </div>
      </section>`
    el.querySelector('[data-goto]').addEventListener('click', () => ctx.switchPage('today'))
    return
  }

  const items = records
    .map((r) => {
      const st = statusOf(r)
      const pct = percent(r.completed, r.target)
      return `
        <button type="button" class="history-item card" data-date="${r.date}">
          <span class="hi-left">
            <span class="hi-date">${formatCn(r.date)}</span>
            <span class="hi-sub">${r.completed} / ${r.target} · ${pct}%</span>
          </span>
          <span class="tag ${st.cls}">${st.label}</span>
        </button>`
    })
    .join('')

  el.innerHTML = `
    <section class="page">
      <header class="page-head"><h1>历史记录</h1></header>
      <div class="history-list">${items}</div>
    </section>`

  el.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', () => showDayDetail(item.dataset.date, () => ctx.refresh()))
  })
}
