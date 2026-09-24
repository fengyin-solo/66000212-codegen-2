import {
  filterByRange, aggregateByLetter, aggregateByBatch, aggregateByDay,
  pickWeakLetters, overall,
} from '../src/utils/report'
import type { QuizRecord } from '../src/types'

function mk(id: number, char: string, correct: boolean, baseAgoMs: number, batch: string, indexInBatch: number, elapsedMs = 1000): QuizRecord {
  // 同批次内 index 越大作答越晚（距现在越近）
  return { id: `${id}`, char, correct, elapsedMs, batchId: batch, timestamp: NOW - baseAgoMs + indexInBatch * 1000 }
}

const NOW = new Date('2026-09-24T12:00:00').getTime()
let pass = 0, fail = 0
function assert(cond: boolean, msg: string) {
  if (cond) { pass++; console.log('  ✓', msg) }
  else { fail++; console.error('  ✗', msg) }
}

// 1. 空数据
console.log('空数据')
assert(aggregateByLetter([]).length === 0, '字母聚合为空数组')
assert(aggregateByBatch([]).length === 0, '批次聚合为空数组')
assert(overall([]).total === 0 && overall([]).accuracy === 0, '整体统计为零')
const empty7 = aggregateByDay([], '7d', NOW)
assert(empty7.length === 7, '近七天走势补齐 7 天')
assert(empty7.every(d => d.total === 0), '空天天数全为 0')

// 构造记录：
// 批次1（8天前，超出近七天）: A对, A错, A对
// 批次2（2天前）: A对, B错, C对, C错, C对 (C=3条样本)
// 批次3（今天）: Z错, Z对  -> 最近顺序 Z, C, B, A
console.log('有数据')
const recs: QuizRecord[] = [
  mk(1, 'A', true, 8 * 864e5, 'b1', 0),
  mk(2, 'A', false, 8 * 864e5, 'b1', 1),
  mk(3, 'A', true, 8 * 864e5, 'b1', 2),
  mk(4, 'A', true, 2 * 864e5, 'b2', 0),
  mk(5, 'B', false, 2 * 864e5, 'b2', 1, 3000),
  mk(6, 'C', true, 2 * 864e5, 'b2', 2, 2000),
  mk(7, 'C', false, 2 * 864e5, 'b2', 3, 4000),
  mk(8, 'C', true, 2 * 864e5, 'b2', 4, 6000),
  mk(9, 'Z', false, 3600e3, 'b3', 0, 5000),
  mk(10, 'Z', true, 3600e3, 'b3', 1, 1500),
]

const scoped = filterByRange(recs, '7d', NOW)
assert(scoped.length === 7, '近七天过滤掉 8 天前的批次（7 条）')
assert(filterByRange(recs, 'all', NOW).length === 10, '全部时间保留 10 条')

const letters = aggregateByLetter(scoped)
assert(letters.map(l => l.char).join('') === 'ZCBA', `字母顺序按最近练习先后（得 ZCBA，实际 ${letters.map(l => l.char).join('')}）`)
const z = letters.find(l => l.char === 'Z')!
assert(z.correctCount === 1 && z.wrongCount === 1 && z.total === 2, 'Z 对1错1')
assert(z.sampleTooSmall === true, 'Z 样本太少（2 < 3）')
const a = letters.find(l => l.char === 'A')!
assert(a.correctCount === 1, 'A 在范围内只有批次2的 1 条答对')
const c = letters.find(l => l.char === 'C')!
assert(c.sampleTooSmall === false && c.accuracy === 67, 'C 样本 3 条正确率 67%')
assert(c.avgMs === 4000, 'C 平均耗时 4000ms')

const weak = pickWeakLetters(letters)
assert(!weak.find(l => l.char === 'Z'), 'Z 样本太少不参与排名')
assert(weak[0].char === 'C', 'C 是最需加强（67%，样本足）')
const weakAll = pickWeakLetters(aggregateByLetter(recs))
assert(weakAll.find(l => l.char === 'A'), '全部时间下 A 有 4 条样本可参与排名')

const batches = aggregateByBatch(scoped)
assert(batches.length === 2 && batches[0].batchId === 'b3', '批次聚合 2 个且最近批次在前')
assert(batches[0].letters.map(l => l.char).join('') === 'Z', '今天批次只有 Z')
assert(batches[1].letters[0].char === 'C', '批次2内字母顺序最近作答在前（C 最先）')

const days7 = aggregateByDay(scoped, '7d', NOW)
assert(days7.length === 7, '近七天走势 7 个点')
const dayIdx = new Map(days7.map(d => [d.date, d]))
const todayKey = days7[6].date
assert(dayIdx.get(todayKey)!.total === 2, '今天共 2 条')
const d2 = days7[4] // 2 天前
assert(d2.total === 5 && d2.accuracy === 60, '2 天前 5 条正确率 60%')

const daysAll = aggregateByDay(recs, 'all', NOW)
assert(daysAll.length === 3, '全部时间走势只有记录的 3 天')
assert(daysAll.map(d => d.date).every((d, i, arr) => i === 0 || arr[i - 1] <= d), '全部时间走势按天升序')

const ov = overall(scoped)
assert(ov.total === 7 && ov.correctCount === 4 && ov.accuracy === 57, `整体 7 条对 4 正确率 57%（实际 ${ov.accuracy}%）`)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
