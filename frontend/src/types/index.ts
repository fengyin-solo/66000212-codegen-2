export interface BrailleChar {
  char: string
  dots: number[]  // 1-6 active dots
  unicode: string
}

export type LearnMode = 'charToBraille' | 'brailleToChar' | 'dictation'

/** 单条练习作答记录（按练习批次归属） */
export interface PracticeRecord {
  /** 被考查的字母 */
  char: string
  correct: boolean
  /** 本次作答耗时（毫秒，从出题到点确认） */
  durationMs: number
  /** 作答完成时间戳 */
  timestamp: number
  /** 所属练习批次的开始时间戳，同时作为批次 id */
  batchId: number
}

export type ReportRange = '7d' | 'all'

/** 单个字母在选定时间范围内的汇总 */
export interface CharStat {
  char: string
  correct: number
  wrong: number
  total: number
  accuracy: number
  avgDurationMs: number
  /** 作答条数不足时标记，不参与薄弱字母排名 */
  sampleTooSmall: boolean
}

/** 按天聚合的走势数据点 */
export interface DayBucket {
  key: string
  label: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

/** 一个练习批次的汇总 */
export interface BatchStat {
  batchId: number
  startedAt: number
  total: number
  correct: number
  accuracy: number
  avgDurationMs: number
  chars: CharStat[]
}

export interface ReportData {
  total: number
  correct: number
  accuracy: number
  avgDurationMs: number
  batchCount: number
  /** 字母顺序与最近一次练习的出现顺序一致 */
  charStats: CharStat[]
  /** 需要加强的字母（已过滤样本太少的情况） */
  weakChars: CharStat[]
  days: DayBucket[]
  batches: BatchStat[]
}
