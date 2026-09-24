import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { BRAILLE_MAP, textToBraille, brailleToText, dotsToUnicode } from '../utils/braille'
import { buildReport, filterByRange } from '../utils/report'
import type { LearnMode, PracticeRecord, ReportRange } from '../types'

const RECORDS_STORAGE_KEY = 'braille-practice-records'
const RANGE_STORAGE_KEY = 'braille-report-range'

function loadRecords(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is PracticeRecord =>
        r && typeof r.char === 'string' &&
        typeof r.correct === 'boolean' &&
        typeof r.durationMs === 'number' &&
        typeof r.timestamp === 'number' &&
        typeof r.batchId === 'number',
    )
  } catch {
    return []
  }
}

function loadRange(): ReportRange {
  try {
    return localStorage.getItem(RANGE_STORAGE_KEY) === 'all' ? 'all' : '7d'
  } catch {
    return '7d'
  }
}

export const useBrailleStore = defineStore('braille', () => {
  const inputText = ref('')
  const brailleOutput = ref<number[][]>([])
  const learnMode = ref<LearnMode>('charToBraille')
  const quizChar = ref('')
  const selectedDots = ref<number[]>([])
  /** 所有历史练习记录，持久化保存 */
  const records = ref<PracticeRecord[]>(loadRecords())
  /** 报表/统计共用的时间范围，持久化保存（离开再回来仍保留） */
  const range = ref<ReportRange>(loadRange())

  /** 当前练习批次 id（= 批次开始时间戳）；null 表示尚未开始一批 */
  const currentBatchId = ref<number | null>(null)
  /** 当前题目的出题时间，用于计算平均作答耗时 */
  let questionStartedAt = 0

  // 持久化：记录与所选范围在刷新、离开再回来后仍然保留
  watch(records, (val) => {
    try { localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(val)) } catch { /* ignore */ }
  }, { deep: true })
  watch(range, (val) => {
    try { localStorage.setItem(RANGE_STORAGE_KEY, val) } catch { /* ignore */ }
  })

  const brailleUnicode = computed(() =>
    brailleOutput.value.map(d => dotsToUnicode(d)).join('')
  )

  /** 当前选定范围内的记录，练习页统计与报表共用这一份数据源 */
  const rangeRecords = computed(() => filterByRange(records.value, range.value))

  /** 当前范围内的答对/总条数（练习页与报表看到的数字一致） */
  const score = computed(() => {
    let correct = 0
    for (const r of rangeRecords.value) if (r.correct) correct++
    return { correct, total: rangeRecords.value.length }
  })

  /** 当前范围内的最近作答（与报表范围一致），新的在前 */
  const history = computed(() =>
    [...rangeRecords.value]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(r => ({ input: r.char, correct: r.correct })),
  )

  const report = computed(() => buildReport(records.value, range.value))

  function translate() {
    brailleOutput.value = textToBraille(inputText.value)
  }

  function reverseTranslate() {
    // Simple: take selectedDots and find matching char
    return brailleToText(selectedDots.value)
  }

  /** 开始一批新练习并出第一道题（每题随机抽取 26 个字母） */
  function generateQuiz() {
    if (currentBatchId.value === null) {
      currentBatchId.value = Date.now()
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    selectedDots.value = []
    questionStartedAt = Date.now()
  }

  function toggleDot(dot: number) {
    const idx = selectedDots.value.indexOf(dot)
    if (idx >= 0) selectedDots.value.splice(idx, 1)
    else selectedDots.value.push(dot)
  }

  function checkQuizAnswer() {
    if (!quizChar.value || currentBatchId.value === null) return
    const correct = JSON.stringify([...selectedDots.value].sort()) === JSON.stringify([...(BRAILLE_MAP[quizChar.value] || [])].sort())
    records.value.push({
      char: quizChar.value,
      correct,
      durationMs: Math.max(0, Date.now() - questionStartedAt),
      timestamp: Date.now(),
      batchId: currentBatchId.value,
    })
    if (navigator.vibrate) navigator.vibrate(correct ? 100 : [100, 50, 100])
    generateQuiz()
  }

  /** 结束当前练习批次；再次开始训练会形成新的批次 */
  function endTraining() {
    quizChar.value = ''
    selectedDots.value = []
    currentBatchId.value = null
  }

  function resetScore() {
    records.value = []
    endTraining()
  }

  function setRange(value: ReportRange) {
    range.value = value
  }

  function exportPDF(): string {
    const lines = inputText.value.toUpperCase().split('')
    let out = '盲文翻译输出\n\n'
    for (const ch of lines) {
      const dots = BRAILLE_MAP[ch] || []
      out += `${ch} → [${dots.join(',')}] ${dotsToUnicode(dots)}\n`
    }
    return out
  }

  return {
    inputText, brailleOutput, learnMode, quizChar, selectedDots,
    records, range, score, history, report, rangeRecords,
    brailleUnicode, translate, reverseTranslate, generateQuiz, toggleDot,
    checkQuizAnswer, endTraining, resetScore, setRange, exportPDF,
  }
})
