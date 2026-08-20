/**
 * “今日首次达到目标”庆祝标记：每天只触发一次，防止刷新后重复庆祝。
 */
const KEY = 'daily300-celebrated'

export function hasCelebrated(today) {
  try {
    return localStorage.getItem(KEY) === today
  } catch {
    return false
  }
}

export function markCelebrated(today) {
  try {
    localStorage.setItem(KEY, today)
  } catch {
    /* 忽略 */
  }
}
