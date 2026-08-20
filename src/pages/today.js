/**
 * 今日页：核心打卡页。进度环 + 快捷加减 + 修改数量 + 完成庆祝。
 */
import { ensureRecord, setCompleted, DEFAULT_TARGET } from '../core/db.js'
import { formatCn, todayStr } from '../core/date.js'
import { percent } from '../core/stats.js'
import { showNumberModal } from '../ui/modal.js'
import { showToast } from '../ui/toast.js'
import { hasCelebrated, markCelebrated } from '../core/celebrate.js'

const CIRC = 2 * Math.PI * 100 // 进度环周长（r=100）

export async function render(el, ctx) {
  const today = todayStr()
  let record = await ensureRecord(today)
  const target = record && record.target ? record.target : DEFAULT_TARGET

  el.innerHTML = `
    <section class="page today-page">
      <header class="page-head">
        <h1>每日刷题</h1>
        <p class="today-date">${formatCn(today)}</p>
      </header>

      <div class="card progress-card">
        <div class="progress-ring-wrap">
          <svg class="progress-ring" viewBox="0 0 240 240" aria-hidden="true">
            <circle class="ring-bg" cx="120" cy="120" r="100" />
            <circle class="ring-fg" cx="120" cy="120" r="100" />
          </svg>
          <div class="ring-center">
            <div class="ring-number">
              <span class="num">0</span>
              <span class="denom">/ ${target}</span>
            </div>
            <div class="ring-pct">0%</div>
          </div>
        </div>
        <div class="progress-bar"><div class="progress-fill"></div></div>
        <p class="progress-text"></p>
        <p class="status-line"></p>
      </div>

      <div class="card quick-card">
        <div class="quick-row">
          <button type="button" class="btn btn-quick" data-delta="-50">−50</button>
          <button type="button" class="btn btn-quick" data-delta="-10">−10</button>
          <button type="button" class="btn btn-quick" data-delta="-1">−1</button>
        </div>
        <div class="quick-current">
          <span class="qc-num">0</span>
          <span class="qc-label">当前数量</span>
        </div>
        <div class="quick-row">
          <button type="button" class="btn btn-quick plus" data-delta="1">+1</button>
          <button type="button" class="btn btn-quick plus" data-delta="10">+10</button>
          <button type="button" class="btn btn-quick plus" data-delta="50">+50</button>
        </div>
        <button type="button" class="btn btn-outline btn-block btn-edit">✏️ 修改数量</button>
      </div>
    </section>`

  const numEl = el.querySelector('.ring-number .num')
  const pctEl = el.querySelector('.ring-pct')
  const ringFg = el.querySelector('.ring-fg')
  const fill = el.querySelector('.progress-fill')
  const progressText = el.querySelector('.progress-text')
  const statusLine = el.querySelector('.status-line')
  const qcNum = el.querySelector('.qc-num')

  function updateDisplay(prev) {
    const c = record ? record.completed : 0
    const ratio = Math.min(c / target, 1)
    const pct = percent(c, target)
    const isOver = c > target

    numEl.textContent = c
    qcNum.textContent = c
    pctEl.textContent = `${pct}%`
    ringFg.style.strokeDashoffset = String(CIRC * (1 - ratio))
    ringFg.classList.toggle('over', isOver)
    fill.style.width = `${ratio * 100}%`
    fill.classList.toggle('over', isOver)

    if (c >= target) {
      progressText.textContent =
        c > target ? `已完成 ${c} 题 · 超额 ${c - target} 题` : `已完成 ${c} 题`
      if (c > target) {
        statusLine.textContent = `🔥 今日超额完成 ${c - target} 题`
        statusLine.className = 'status-line over'
      } else {
        statusLine.textContent = `🎉 今日${target}题完成！`
        statusLine.className = 'status-line ok'
      }
    } else {
      progressText.textContent = `已完成 ${c} 题 · 还差 ${target - c} 题`
      statusLine.textContent =
        c === 0 ? '今天还没开始，加油！' : `继续加油，还差 ${target - c} 题`
      statusLine.className = 'status-line'
    }

    if (prev !== undefined && prev !== c) {
      numEl.classList.remove('bump')
      void numEl.offsetWidth
      numEl.classList.add('bump')
    }
  }

  async function save(next) {
    const prev = record ? record.completed : 0
    try {
      record = await setCompleted(today, next, target)
    } catch {
      showToast('保存失败，请重试', 'error')
      return
    }
    updateDisplay(prev)

    // 当天首次达到目标：轻量庆祝
    if (prev < target && next >= target && !hasCelebrated(today)) {
      markCelebrated(today)
      showToast(
        next > target ? `🎉 今日${target}题完成，已超额 ${next - target} 题！` : `🎉 今日${target}题完成！`,
        'success',
        3200
      )
      const card = el.querySelector('.progress-card')
      if (card) {
        card.classList.remove('celebrate')
        void card.offsetWidth
        card.classList.add('celebrate')
      }
    }
  }

  async function applyDelta(delta) {
    const current = record ? record.completed : 0
    const next = current + delta
    if (next < 0) {
      showToast('已经是最少 0 题了', 'info', 1800)
      return
    }
    if (next === current) return
    await save(next)
  }

  el.querySelectorAll('.btn-quick').forEach((b) =>
    b.addEventListener('click', () => applyDelta(Number(b.dataset.delta)))
  )

  el.querySelector('.btn-edit').addEventListener('click', () => {
    showNumberModal({
      title: '修改今日题量',
      label: '完成题数',
      value: record ? record.completed : 0,
      hint: '非负整数，可超过 300',
      onConfirm: (n) => save(n)
    })
  })

  updateDisplay()
}
