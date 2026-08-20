/**
 * 日期工具：全部基于设备本地时间。
 * 内部统一使用 "YYYY-MM-DD" 字符串，可直接按字典序比较先后。
 */

const WEEK_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function pad(n) {
  return String(n).padStart(2, '0')
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** 中文长日期：2026年8月20日 星期四 */
export function formatCn(dateStr) {
  const d = parseDate(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_CN[d.getDay()]}`
}

/** 本周一（周一为一周开始） */
export function weekStart(dateStr) {
  const day = parseDate(dateStr).getDay() // 0=周日
  const diff = day === 0 ? 6 : day - 1
  return addDays(dateStr, -diff)
}

/** 本月1日 */
export function monthStart(dateStr) {
  const d = parseDate(dateStr)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

/** 校验 "YYYY-MM-DD" 是否为真实存在的日期 */
export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (y < 1970 || y > 2999) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}
