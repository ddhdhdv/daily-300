/**
 * 统计计算：全部为纯函数，根据记录实时计算，不落库。
 */
import { addDays, todayStr, weekStart, monthStart } from './date.js'

/**
 * 当前连续达标天数。
 * 规则：
 *  - 当天已完成 >= 目标：从今天开始向前数
 *  - 当天未达标（含 0 题/无记录）：从昨天开始向前数（当天不提前计入，也不中断之前的连续）
 */
export function computeStreak(recordsMap, today) {
  const t = recordsMap.get(today)
  let cur = !t || t.completed < t.target ? addDays(today, -1) : today
  let streak = 0
  for (;;) {
    const r = recordsMap.get(cur)
    if (r && r.completed >= r.target) {
      streak += 1
      cur = addDays(cur, -1)
    } else {
      break
    }
  }
  return streak
}

/**
 * 汇总统计。
 * records: [{ date, target, completed }]
 */
export function computeStats(records, today = todayStr()) {
  const map = new Map(records.map((r) => [r.date, r]))
  const ws = weekStart(today)
  const ms = monthStart(today)

  let weekTotal = 0
  let monthTotal = 0
  let total = 0
  let achievedDays = 0
  let maxDay = 0

  for (const r of records) {
    total += r.completed
    if (r.completed >= r.target) achievedDays += 1
    if (r.completed > maxDay) maxDay = r.completed
    if (r.date >= ws && r.date <= today) weekTotal += r.completed
    if (r.date >= ms && r.date <= today) monthTotal += r.completed
  }

  return {
    today: map.get(today) ? map.get(today).completed : 0,
    weekTotal,
    monthTotal,
    total,
    achievedDays,
    streak: computeStreak(map, today),
    maxDay
  }
}

/** 完成率（保留 1 位小数，返回数字） */
export function percent(completed, target) {
  if (!target) return 0
  return Math.round((completed / target) * 1000) / 10
}
