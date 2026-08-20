/**
 * 单日详情弹层：展示某天完成情况，可修改题量（历史/今天均可；未来日期由用户主动点击创建）。
 */
import { getRecord, setCompleted, DEFAULT_TARGET } from '../core/db.js'
import { formatCn, todayStr } from '../core/date.js'
import { percent } from '../core/stats.js'
import { openModal, showNumberModal } from './modal.js'
import { showToast } from './toast.js'

export async function showDayDetail(dateStr, onChange) {
  const today = todayStr()
  const record = await getRecord(dateStr)
  const target = record && record.target ? record.target : DEFAULT_TARGET
  const completed = record ? record.completed : 0
  const pct = percent(completed, target)
  const isFuture = dateStr > today

  const box = document.createElement('div')
  box.className = 'modal-box day-detail'

  const titleRow = document.createElement('div')
  titleRow.className = 'detail-title-row'
  const h = document.createElement('h3')
  h.className = 'modal-title'
  h.textContent = formatCn(dateStr)
  titleRow.appendChild(h)
  if (isFuture) {
    const tag = document.createElement('span')
    tag.className = 'tag tag-gray'
    tag.textContent = '未来日期'
    titleRow.appendChild(tag)
  }

  const rows = document.createElement('div')
  rows.className = 'detail-rows'
  const over = completed - target
  rows.innerHTML = `
    <div class="detail-row"><span>完成</span><b>${completed} 题</b></div>
    <div class="detail-row"><span>目标</span><b>${target} 题</b></div>
    <div class="detail-row"><span>完成率</span><b>${pct}%</b></div>
    ${completed > target ? `<div class="detail-over">🔥 超额完成 ${over} 题</div>` : ''}
    ${completed === target ? `<div class="detail-done">🎉 今日${target}题完成</div>` : ''}
    ${!record ? '<div class="detail-empty">这一天还没有记录</div>' : ''}`

  const editBtn = document.createElement('button')
  editBtn.type = 'button'
  editBtn.className = 'btn btn-outline btn-block'
  editBtn.textContent = '✏️ 修改题量'
  editBtn.addEventListener('click', () => {
    showNumberModal({
      title: formatCn(dateStr),
      label: '完成题数',
      value: completed,
      hint: '非负整数，可超过目标',
      onConfirm: async (n) => {
        try {
          await setCompleted(dateStr, n, target)
          showToast('已保存', 'success')
          if (typeof onChange === 'function') onChange()
          showDayDetail(dateStr, onChange)
        } catch (err) {
          showToast('保存失败，请重试', 'error')
        }
      }
    })
  })

  box.append(titleRow, rows, editBtn)
  openModal(box)
}
