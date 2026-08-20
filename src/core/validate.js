/**
 * 输入校验：题量必须是安全整数范围内的非负整数。
 * 拒绝：负数、小数、文字、空值、超大数字。
 */
export function parseCount(raw) {
  const s = String(raw == null ? '' : raw).trim()
  if (!/^\d{1,15}$/.test(s)) {
    return { ok: false, message: '请输入有效的非负整数（不支持小数、负数或文字）' }
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n)) {
    return { ok: false, message: '数字超出可保存范围' }
  }
  return { ok: true, value: n }
}
