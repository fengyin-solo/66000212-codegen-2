import type {
  PracticeRecord, ReportRange, CharStat, DayBucket, BatchStat, ReportData,
} from '../types'

/** 达到该作答条数才参与薄弱字母排名 */
export const MIN_SAMPLE_SIZE = 3
/** 近七天对应的毫秒数 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** 本地时区的日期 key，格式 YYYY-MM-DD */
export function dateKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 选定范围的起始时间戳（含），全部时间返回 0 */
export function rangeStartTs(range: ReportRange, now = Date.now()): number {
  if (range === '7d') {
    // 以今天 00:00 为基准往前数 7 个自然日（含今天）
    const startOfToday = new Date(now).setHours(0, 0, 0, 0)
    return startOfToday - 6 * 24 * 60 * 60 * 1000
  }
  return 0
}

export function filterByRange(records: PracticeRecord[], range: ReportRange, now = Date.now()): PracticeRecord[] {
  const from = rangeStartTs(range, now)
  return records.filter(r => r.timestamp >= from)
}

function makeCharStat(char: string, records: PracticeRecord[]): CharStat {
  let correct = 0
  let durationSum = 0
  for (const r of records) {
    if (r.correct) correct++
    durationSum += r.durationMs
  }
  const total = records.length
  return {
    char,
    correct,
    wrong: total - correct,
    total,
    accuracy: total ? correct / total : 0,
    avgDurationMs: total ? durationSum / total : 0,
    sampleTooSmall: total < MIN_SAMPLE_SIZE,
  }
}

/**
 * 字母先后顺序锚定「最近一次练习」的结果：
 * 按全部历史中最近批次里各字母首次出现的顺序排列，较旧批次才出现的字母
 * 依次追加在后（批次从新到旧，字母按批次内首次出现的先后）。
 * 这样切换时间范围时，顺序始终是全局顺序的子序列，不会因范围而改变。
 */
function orderedCharNames(source: PracticeRecord[]): string[] {
  const ordered = [...source].sort((a, b) => {
    if (b.batchId !== a.batchId) return b.batchId - a.batchId
    return a.timestamp - b.timestamp
  })
  const names: string[] = []
  const seen = new Set<string>()
  for (const r of ordered) {
    if (seen.has(r.char)) continue
    seen.add(r.char)
    names.push(r.char)
  }
  return names
}

function groupByChar(records: PracticeRecord[]): Map<string, PracticeRecord[]> {
  const byChar = new Map<string, PracticeRecord[]>()
  for (const r of records) {
    const list = byChar.get(r.char)
    if (list) list.push(r)
    else byChar.set(r.char, [r])
  }
  return byChar
}

function buildDays(records: PracticeRecord[], range: ReportRange, now: number): DayBucket[] {
  const buckets = new Map<string, DayBucket>()

  const ensure = (key: string, label: string): DayBucket => {
    let b = buckets.get(key)
    if (!b) {
      b = { key, label, total: 0, correct: 0, wrong: 0, accuracy: 0 }
      buckets.set(key, b)
    }
    return b
  }

  if (range === '7d') {
    // 近七天：无论有无作答，每天都占一格
    const start = rangeStartTs('7d', now)
    for (let i = 0; i < 7; i++) {
      const ts = start + i * 24 * 60 * 60 * 1000
      const d = new Date(ts)
      const key = dateKey(ts)
      ensure(key, `${d.getMonth() + 1}/${d.getDate()}`)
    }
  } else {
    // 全部时间：只展示有记录的日期
    for (const r of records) {
      const d = new Date(r.timestamp)
      ensure(dateKey(r.timestamp), `${d.getMonth() + 1}/${d.getDate()}`)
    }
  }

  for (const r of records) {
    const b = ensure(dateKey(r.timestamp), `${new Date(r.timestamp).getMonth() + 1}/${new Date(r.timestamp).getDate()}`)
    b.total++
    if (r.correct) b.correct++
  }

  return [...buckets.values()]
    .map(b => ({ ...b, wrong: b.total - b.correct, accuracy: b.total ? b.correct / b.total : 0 }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))
}

function buildBatches(records: PracticeRecord[]): BatchStat[] {
  const byBatch = new Map<number, PracticeRecord[]>()
  for (const r of records) {
    const list = byBatch.get(r.batchId)
    if (list) list.push(r)
    else byBatch.set(r.batchId, [r])
  }

  const batches: BatchStat[] = []
  for (const [batchId, list] of byBatch) {
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
    const byChar = groupByChar(sorted)
    const stats = orderedCharNames(sorted)
      .map(name => makeCharStat(name, byChar.get(name)!))
    let correct = 0
    let durationSum = 0
    for (const r of sorted) {
      if (r.correct) correct++
      durationSum += r.durationMs
    }
    const total = sorted.length
    batches.push({
      batchId,
      startedAt: batchId,
      total,
      correct,
      accuracy: total ? correct / total : 0,
      avgDurationMs: total ? durationSum / total : 0,
      chars: stats,
    })
  }
  return batches.sort((a, b) => b.batchId - a.batchId)
}

/** 聚合报表数据；无记录时返回空报表（各字段为 0、列表为空） */
export function buildReport(allRecords: PracticeRecord[], range: ReportRange, now = Date.now()): ReportData {
  const records = filterByRange(allRecords, range, now)

  // 字母顺序锚定全部历史中的最近一次练习；范围内只做过滤，
  // 因此切换时间范围后，已出现字母的先后顺序保持不变
  const globalOrder = orderedCharNames(allRecords)
  const byChar = groupByChar(records)
  const charStats: CharStat[] = globalOrder
    .filter(name => byChar.has(name))
    .map(name => makeCharStat(name, byChar.get(name)!))

  const ranked = charStats.filter(s => !s.sampleTooSmall)
  const weakChars = [...ranked]
    .sort((a, b) =>
      a.accuracy - b.accuracy ||
      b.wrong - a.wrong ||
      b.total - a.total ||
      (a.char < b.char ? -1 : 1),
    )
    .slice(0, 3)

  const total = records.length
  const correct = records.filter(r => r.correct).length
  const durationSum = records.reduce((sum, r) => sum + r.durationMs, 0)

  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    avgDurationMs: total ? durationSum / total : 0,
    batchCount: new Set(records.map(r => r.batchId)).size,
    charStats,
    weakChars,
    days: buildDays(records, range, now),
    batches: buildBatches(records),
  }
}

/** 耗时（毫秒）格式化为秒，保留一位小数 */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}
