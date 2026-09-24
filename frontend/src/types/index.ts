export interface BrailleChar {
  char: string
  dots: number[]  // 1-6 active dots
  unicode: string
}

export type LearnMode = 'charToBraille' | 'brailleToChar' | 'dictation'

/** 单条作答记录（一次确认 = 一条） */
export interface QuizRecord {
  id: string
  /** 题目字母，A-Z */
  char: string
  correct: boolean
  /** 作答耗时（毫秒） */
  elapsedMs: number
  /** 练习批次 id（一次"开始训练"为一个批次） */
  batchId: string
  /** 作答确认时间戳（毫秒） */
  timestamp: number
}

export type ReportRange = '7d' | 'all'
