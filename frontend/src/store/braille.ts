import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { BRAILLE_MAP, textToBraille, brailleToText, dotsToUnicode } from '../utils/braille'
import { aggregateByLetter } from '../utils/report'
import type { LearnMode, QuizRecord, ReportRange } from '../types'

const STORAGE_KEY = 'braille-quiz-records-v1'
const RANGE_STORAGE_KEY = 'braille-report-range-v1'

function loadRecords(): QuizRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is QuizRecord =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as QuizRecord).char === 'string' &&
        typeof (r as QuizRecord).correct === 'boolean' &&
        typeof (r as QuizRecord).elapsedMs === 'number' &&
        typeof (r as QuizRecord).batchId === 'string' &&
        typeof (r as QuizRecord).timestamp === 'number',
    )
  } catch {
    return []
  }
}

function loadRange(): ReportRange {
  const raw = localStorage.getItem(RANGE_STORAGE_KEY)
  return raw === 'all' || raw === '7d' ? raw : '7d'
}

let seq = 0
function newId(): string {
  seq += 1
  return `${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 7)}`
}

export const useBrailleStore = defineStore('braille', () => {
  const inputText = ref('')
  const brailleOutput = ref<number[][]>([])
  const learnMode = ref<LearnMode>('charToBraille')
  const quizChar = ref('')
  const selectedDots = ref<number[]>([])

  // 全部作答记录（按时间先后追加），是训练页与报表页共同的唯一数据源
  const records = ref<QuizRecord[]>(loadRecords())
  // 报表时间范围，离开再回来时保持上次选择
  const reportRange = ref<ReportRange>(loadRange())

  // 当前练习批次与出题时间
  const activeBatchId = ref('')
  const quizShownAt = ref(0)

  watch(records, (val) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch { /* 存储不可用时忽略 */ }
  }, { deep: true })
  watch(reportRange, (val) => {
    try { localStorage.setItem(RANGE_STORAGE_KEY, val) } catch { /* 同上 */ }
  })

  const brailleUnicode = computed(() =>
    brailleOutput.value.map(d => dotsToUnicode(d)).join('')
  )

  // 训练页统计与最近记录全部从 records 派生，保证与报表看到的答对条数一致
  const score = computed(() => ({
    correct: records.value.filter(r => r.correct).length,
    total: records.value.length,
  }))

  const history = computed(() =>
    [...records.value]
      .reverse()
      .map(r => ({ input: r.char, correct: r.correct })),
  )

  // 训练页每字母累计答对/答错（全部时间），与报表"全部时间"口径一致
  const letterStats = computed(() => aggregateByLetter(records.value))

  function translate() {
    brailleOutput.value = textToBraille(inputText.value)
  }

  function reverseTranslate() {
    // Simple: take selectedDots and find matching char
    return brailleToText(selectedDots.value)
  }

  /** 开始一次练习（生成一个新批次） */
  function startPractice() {
    activeBatchId.value = newId()
    generateQuiz()
  }

  function generateQuiz() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    selectedDots.value = []
    quizShownAt.value = performance.now()
  }

  function toggleDot(dot: number) {
    const idx = selectedDots.value.indexOf(dot)
    if (idx >= 0) selectedDots.value.splice(idx, 1)
    else selectedDots.value.push(dot)
  }

  function checkQuizAnswer() {
    if (!quizChar.value) return
    const correct = JSON.stringify([...selectedDots.value].sort()) === JSON.stringify([...(BRAILLE_MAP[quizChar.value] || [])].sort())
    // 极端情况下（如刷新后直接触发）没有活动批次，则补建一个，保证每条记录都归属批次
    if (!activeBatchId.value) activeBatchId.value = newId()
    const elapsedMs = Math.max(0, Math.round(performance.now() - quizShownAt.value))
    records.value.push({
      id: newId(),
      char: quizChar.value,
      correct,
      elapsedMs,
      batchId: activeBatchId.value,
      timestamp: Date.now(),
    })
    if (navigator.vibrate) navigator.vibrate(correct ? 100 : [100, 50, 100])
    generateQuiz()
  }

  function resetScore() {
    records.value = []
    activeBatchId.value = ''
    quizChar.value = ''
    selectedDots.value = []
    quizShownAt.value = 0
  }

  function setReportRange(range: ReportRange) {
    reportRange.value = range
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
    records, reportRange, score, history, letterStats,
    brailleUnicode, translate, reverseTranslate, startPractice, generateQuiz, toggleDot,
    checkQuizAnswer, resetScore, setReportRange, exportPDF
  }
})
