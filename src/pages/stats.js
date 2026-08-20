/**
 * 统计页：今日 / 本周 / 本月 / 累计 / 达标天数 / 当前连续 / 历史最高单日。
 */
import { getAllRecords } from '../core/db.js'
import { computeStats } from '../core/stats.js'

export async function render(el, ctx) {
  const records = await getAllRecords()
  const s = computeStats(records)

  el.innerHTML = `
    <section class="page">
      <header class="page-head"><h1>统计</h1></header>
      <div class="stats-grid">
        <div class="card stat-card accent">
          <span class="stat-label">🔥 当前连续达标</span>
          <span class="stat-value">${s.streak}<small>天</small></span>
        </div>
        <div class="card stat-card">
          <span class="stat-label">今日完成</span>
          <span class="stat-value">${s.today}<small>题</small></span>
        </div>
        <div class="card stat-card">
          <span class="stat-label">本周完成</span>
          <span class="stat-value">${s.weekTotal}<small>题</small></span>
        </div>
        <div class="card stat-card">
          <span class="stat-label">本月完成</span>
          <span class="stat-value">${s.monthTotal}<small>题</small></span>
        </div>
        <div class="card stat-card">
          <span class="stat-label">累计完成</span>
          <span class="stat-value">${s.total}<small>题</small></span>
        </div>
        <div class="card stat-card">
          <span class="stat-label">达成目标</span>
          <span class="stat-value">${s.achievedDays}<small>天</small></span>
        </div>
        <div class="card stat-card wide">
          <span class="stat-label">历史最高单日</span>
          <span class="stat-value">${s.maxDay}<small>题</small></span>
        </div>
      </div>
      <p class="stats-note">统计根据全部记录实时计算 · 达标 = 当日完成 ≥ 300 题<br/>本周从周一开始 · 本月从 1 日开始</p>
    </section>`
}
