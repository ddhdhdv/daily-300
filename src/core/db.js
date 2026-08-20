/**
 * 数据层：IndexedDB 持久化（优先），localStorage 降级兜底。
 *
 * 数据结构 DailyRecord:
 *   { id, date: "YYYY-MM-DD"(唯一), target: 300, completed: 非负整数, createdAt, updatedAt }
 */

const DB_NAME = 'daily300'
const DB_VERSION = 1
const STORE = 'records'
const FALLBACK_KEY = 'daily300-records-fallback'

export const DEFAULT_TARGET = 300

let dbPromise = null
let useFallback = false

export function isFallbackMode() {
  return useFallback
}

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    let req
    try {
      if (typeof indexedDB === 'undefined') throw new Error('IndexedDB 不可用')
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('date', 'date', { unique: true })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'))
    req.onblocked = () => reject(new Error('IndexedDB 被其他标签页占用'))
  })
  return dbPromise
}

/** 确定当前存储后端；IndexedDB 打不开时自动降级 */
async function backend() {
  if (!useFallback) {
    try {
      await openDB()
      return 'idb'
    } catch (err) {
      useFallback = true
      // eslint-disable-next-line no-console
      console.warn('IndexedDB 不可用，已降级到 localStorage：', err)
    }
  }
  return 'fallback'
}

/* ---------------- localStorage 降级实现 ---------------- */

function fallbackAll() {
  try {
    const list = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function fallbackSave(list) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(list))
  } catch {
    /* 存储满等异常：静默，调用方通过读取校验 */
  }
}

function fallbackNextId(list) {
  return list.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1
}

function sortDesc(list) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/* ---------------- 公共 API ---------------- */

export async function getRecord(date) {
  if ((await backend()) === 'fallback') {
    return fallbackAll().find((r) => r.date === date) || null
  }
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('date').get(date)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

/** 获取当天记录，不存在则自动创建（完成 0、目标 300）。绝不覆盖已有数据。 */
export async function ensureRecord(date, target = DEFAULT_TARGET) {
  const existing = await getRecord(date)
  if (existing) return existing

  if ((await backend()) === 'fallback') {
    const list = fallbackAll()
    const dup = list.find((r) => r.date === date)
    if (dup) return dup
    const now = Date.now()
    const record = { id: fallbackNextId(list), date, target, completed: 0, createdAt: now, updatedAt: now }
    list.push(record)
    fallbackSave(list)
    return record
  }

  const db = await openDB()
  const now = Date.now()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.index('date').get(date)
    getReq.onsuccess = () => {
      if (getReq.result) return // 并发下已存在，不重复创建
      store.add({ date, target, completed: 0, createdAt: now, updatedAt: now })
    }
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('写入被中止'))
  })
  return getRecord(date)
}

/** 设置某天完成题数（不存在则创建）。只影响该日期。 */
export async function setCompleted(date, completed, target = DEFAULT_TARGET) {
  const now = Date.now()

  if ((await backend()) === 'fallback') {
    const list = fallbackAll()
    let rec = list.find((r) => r.date === date)
    if (rec) {
      rec.completed = completed
      rec.target = target
      rec.updatedAt = now
    } else {
      rec = { id: fallbackNextId(list), date, target, completed, createdAt: now, updatedAt: now }
      list.push(rec)
    }
    fallbackSave(list)
    return rec
  }

  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.index('date').get(date)
    getReq.onsuccess = () => {
      const existing = getReq.result
      if (existing) {
        store.put({ ...existing, completed, target, updatedAt: now })
      } else {
        store.add({ date, target, completed, createdAt: now, updatedAt: now })
      }
    }
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('写入被中止'))
  })
  return getRecord(date)
}

/** 全部记录，按日期从新到旧 */
export async function getAllRecords() {
  if ((await backend()) === 'fallback') return sortDesc(fallbackAll())
  const db = await openDB()
  const list = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  return sortDesc(list)
}

/**
 * 导入记录（items 已经过格式校验）。
 * 同日期：以导入数据覆盖已有记录；新日期：新增。返回 { added, updated }。
 */
export async function importRecords(items) {
  if ((await backend()) === 'fallback') {
    const list = fallbackAll()
    let added = 0
    let updated = 0
    for (const item of items) {
      const rec = list.find((r) => r.date === item.date)
      if (rec) {
        rec.target = item.target
        rec.completed = item.completed
        rec.updatedAt = Date.now()
        updated += 1
      } else {
        list.push({
          id: fallbackNextId(list),
          date: item.date,
          target: item.target,
          completed: item.completed,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        added += 1
      }
    }
    fallbackSave(list)
    return { added, updated }
  }

  const db = await openDB()
  const existing = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
  const byDate = new Map(existing.map((r) => [r.date, r]))
  let added = 0
  let updated = 0

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const item of items) {
      const rec = byDate.get(item.date)
      if (rec) {
        store.put({ ...rec, target: item.target, completed: item.completed, updatedAt: Date.now() })
        updated += 1
      } else {
        store.add({
          date: item.date,
          target: item.target,
          completed: item.completed,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
        added += 1
      }
    }
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('导入被中止'))
  })
  return { added, updated }
}

/** 清空全部记录 */
export async function clearAllRecords() {
  if ((await backend()) === 'fallback') {
    fallbackSave([])
    return
  }
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}
