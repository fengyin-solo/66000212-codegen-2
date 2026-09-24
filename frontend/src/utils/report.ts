import type { QuizRecord, ReportRange } from '../types'

/** 样本阈值：作答次数少于该值的字母标注"样本太少"，不参与薄弱字母排名 */
export const MIN_SAMPLE_SIZE = 3
/** 推荐加强的字母数量 */
export const WEAK_LETTER_LIMIT = 3

export interface LetterStat {
  char: string
  correctCount: number
  wrongCount: number
  total: number
  /** 正确率 0-100，无样本时为 0 */
  accuracy: number
  /** 平均作答耗时（毫秒），无样本时为 0 */
  avgMs: number
  sampleTooSmall: boolean
  /** 最近一次作答时间，用于按最近练习顺序排序 */
  lastSeen: number
  /** 同一批次内或同时间的先后次序（记录 id 时间序，越小越早） */
  lastOrder: number
}

export interface BatchStat {
  batchId: string
  /** 批次开始时间（该批次第一条作答时间） */
  startedAt: number
  correctCount: number
  wrongCount: number
  total: number
  accuracy: number
  avgMs: number
  /** 批次内字母顺序与最近一次练习相同（最近作答在前） */
  letters: LetterStat[]
}

export interface DayPoint {
  /** yyyy-mm-dd */
  date: string
  /** 展示用，如 09-22 */
  label: string
  correctCount: number
  wrongCount: number
  total: number
  accuracy: number
}

/** 过滤时间范围 */
export function filterByRange(records: QuizRecord[], range: ReportRange, now: number = Date.now()): QuizRecord[] {
  if (range === 'all') return records
  const dayMs = 24 * 60 * 60 * 1000
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  const start = startOfToday.getTime() - 6 * dayMs // 近七天：含今天共 7 天
  return records.filter(r => r.timestamp >= start && r.timestamp < startOfToday.getTime() + dayMs)
}

/** 把记录按字母聚合；返回顺序 = 每个字母最近一次作答的先后（最近在前），与最近一次练习的结果顺序一致 */
export function aggregateByLetter(records: QuizRecord[]): LetterStat[] {
  // key: char -> 聚合中间数据
  const map = new Map<string, { correct: number; wrong: number; timeSum: number; lastSeen: number; lastOrder: number }>()
  records.forEach((r, order) => {
    const cur = map.get(r.char) || { correct: 0, wrong: 0, timeSum: 0, lastSeen: 0, lastOrder: 0 }
    if (r.correct) cur.correct++
    else cur.wrong++
    cur.timeSum += r.elapsedMs
    // records 按作答时间从旧到新排列，直接覆盖即可得到最近一次作答；
    // order 同时解决同一毫秒内多条记录的先后（不能只比 timestamp）
    cur.lastSeen = r.timestamp
    cur.lastOrder = order
    map.set(r.char, cur)
  })

  const stats: LetterStat[] = []
  for (const [char, v] of map) {
    const total = v.correct + v.wrong
    stats.push({
      char,
      correctCount: v.correct,
      wrongCount: v.wrong,
      total,
      accuracy: total ? Math.round((v.correct / total) * 100) : 0,
      avgMs: total ? Math.round(v.timeSum / total) : 0,
      sampleTooSmall: total < MIN_SAMPLE_SIZE,
      lastSeen: v.lastSeen,
      lastOrder: v.lastOrder,
    })
  }

  // 最近一次作答越晚越靠前；同一时刻按记录出现先后（后出现的在前，与 history unshift 一致）
  stats.sort((a, b) => b.lastSeen - a.lastSeen || b.lastOrder - a.lastOrder)
  return stats
}

/** 按练习批次聚合，最近批次在前；每批次内字母顺序同样按最近作答排列 */
export function aggregateByBatch(records: QuizRecord[]): BatchStat[] {
  const groups = new Map<string, QuizRecord[]>()
  for (const r of records) {
    const list = groups.get(r.batchId)
    if (list) list.push(r)
    else groups.set(r.batchId, [r])
  }

  const batches: BatchStat[] = []
  for (const [batchId, list] of groups) {
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
    const correct = sorted.filter(r => r.correct).length
    const total = sorted.length
    const timeSum = sorted.reduce((s, r) => s + r.elapsedMs, 0)
    batches.push({
      batchId,
      startedAt: sorted[0].timestamp,
      correctCount: correct,
      wrongCount: total - correct,
      total,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      avgMs: total ? Math.round(timeSum / total) : 0,
      letters: aggregateByLetter(sorted),
    })
  }

  batches.sort((a, b) => b.startedAt - a.startedAt)
  return batches
}

/** 需要加强的字母：样本达到阈值，按正确率升序（并列看错误数、平均耗时），取前几个 */
export function pickWeakLetters(letters: LetterStat[], limit: number = WEAK_LETTER_LIMIT): LetterStat[] {
  return letters
    .filter(l => !l.sampleTooSmall)
    .sort((a, b) =>
      a.accuracy - b.accuracy ||
      b.wrongCount - a.wrongCount ||
      b.avgMs - a.avgMs ||
      a.char.localeCompare(b.char),
    )
    .slice(0, limit)
}

function dateKey(ts: number): string {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 按天走势。近七天补齐空天；全部时间只列有记录的天（按天顺序排列） */
export function aggregateByDay(records: QuizRecord[], range: ReportRange, now: number = Date.now()): DayPoint[] {
  if (range === '7d') {
    const dayMs = 24 * 60 * 60 * 1000
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    const points: DayPoint[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = startOfToday.getTime() - i * dayMs
      points.push({ date: dateKey(dayStart), label: dateKey(dayStart).slice(5), correctCount: 0, wrongCount: 0, total: 0, accuracy: 0 })
    }
    const index = new Map(points.map(p => [p.date, p]))
    for (const r of records) {
      const p = index.get(dateKey(r.timestamp))
      if (!p) continue
      if (r.correct) p.correctCount++
      else p.wrongCount++
      p.total++
    }
    for (const p of points) p.accuracy = p.total ? Math.round((p.correctCount / p.total) * 100) : 0
    return points
  }

  const map = new Map<string, DayPoint>()
  for (const r of records) {
    const key = dateKey(r.timestamp)
    let p = map.get(key)
    if (!p) {
      p = { date: key, label: key.slice(5), correctCount: 0, wrongCount: 0, total: 0, accuracy: 0 }
      map.set(key, p)
    }
    if (r.correct) p.correctCount++
    else p.wrongCount++
    p.total++
  }
  const points = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  for (const p of points) p.accuracy = Math.round((p.correctCount / p.total) * 100)
  return points
}

export interface OverallStat {
  correctCount: number
  wrongCount: number
  total: number
  accuracy: number
  avgMs: number
}

export function overall(records: QuizRecord[]): OverallStat {
  const correctCount = records.filter(r => r.correct).length
  const total = records.length
  const timeSum = records.reduce((s, r) => s + r.elapsedMs, 0)
  return {
    correctCount,
    wrongCount: total - correctCount,
    total,
    accuracy: total ? Math.round((correctCount / total) * 100) : 0,
    avgMs: total ? Math.round(timeSum / total) : 0,
  }
}

/** 平均耗时格式化：1.2s / 850ms */
export function formatAvg(ms: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
