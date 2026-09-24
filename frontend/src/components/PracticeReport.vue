<script setup lang="ts">
import { computed } from 'vue'
import { useBrailleStore } from '../store/braille'
import TrendChart from './TrendChart.vue'
import {
  filterByRange, aggregateByLetter, aggregateByBatch, aggregateByDay,
  pickWeakLetters, overall, formatAvg, MIN_SAMPLE_SIZE,
} from '../utils/report'

const store = useBrailleStore()

// 切换时间范围后，字母顺序按该范围内最近一次练习的出现顺序排列（聚合函数内部已保证）
const scopedRecords = computed(() => filterByRange(store.records, store.reportRange))
const letters = computed(() => aggregateByLetter(scopedRecords.value))
const batches = computed(() => aggregateByBatch(scopedRecords.value))
const days = computed(() => aggregateByDay(scopedRecords.value, store.reportRange))
const total = computed(() => overall(scopedRecords.value))
const weakLetters = computed(() => pickWeakLetters(letters.value))
const hasData = computed(() => scopedRecords.value.length > 0)

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="bg-gray-900 rounded-xl p-4 flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-purple-300 font-bold text-lg">练习情况报表</h3>
      <div class="flex gap-1 bg-gray-800 rounded-lg p-1">
        <button
          v-for="opt in ([{ id: '7d', label: '近七天' }, { id: 'all', label: '全部时间' }] as const)"
          :key="opt.id"
          @click="store.setReportRange(opt.id)"
          class="px-3 py-1 rounded-md text-sm transition-colors"
          :class="store.reportRange === opt.id ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 空数据：给出说明而不是渲染空白表格 -->
    <div v-if="!hasData" class="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div class="text-5xl">📭</div>
      <div class="text-gray-300 font-semibold">
        {{ store.reportRange === '7d' ? '近七天还没有练习记录' : '暂时还没有任何练习记录' }}
      </div>
      <p class="text-sm text-gray-500 max-w-md">
        {{ store.records.length === 0
          ? '前往「训练模式」完成一次练习后，这里会按练习批次列出每个字母的答对条数、答错条数与平均作答耗时。'
          : '更早的练习不在近七天范围内，可切换到「全部时间」查看历史记录。' }}
      </p>
    </div>

    <template v-else>
      <!-- 整体情况 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div class="bg-gray-800 rounded-lg p-3">
          <div class="text-2xl font-bold text-purple-400">{{ total.accuracy }}%</div>
          <div class="text-xs text-gray-400">整体正确率</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3">
          <div class="text-2xl font-bold text-green-400">{{ total.correctCount }}</div>
          <div class="text-xs text-gray-400">答对条数</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3">
          <div class="text-2xl font-bold text-red-400">{{ total.wrongCount }}</div>
          <div class="text-xs text-gray-400">答错条数</div>
        </div>
        <div class="bg-gray-800 rounded-lg p-3">
          <div class="text-2xl font-bold text-yellow-400">{{ formatAvg(total.avgMs) }}</div>
          <div class="text-xs text-gray-400">平均作答耗时</div>
        </div>
      </div>

      <!-- 需要加强的字母 -->
      <div>
        <h4 class="text-purple-300 font-semibold mb-2 text-sm">需要加强的字母</h4>
        <div v-if="weakLetters.length" class="flex flex-wrap gap-2">
          <div v-for="l in weakLetters" :key="l.char"
            class="flex items-center gap-2 bg-gray-800 border border-red-500/40 rounded-lg px-3 py-2">
            <span class="text-xl font-bold text-purple-400">{{ l.char }}</span>
            <div class="text-xs leading-tight">
              <div class="text-red-400 font-semibold">正确率 {{ l.accuracy }}%</div>
              <div class="text-gray-400">{{ l.wrongCount }} 错 / 共 {{ l.total }} 条 · 均 {{ formatAvg(l.avgMs) }}</div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500">
          已练习的字母正确率都不错（参与排名需至少 {{ MIN_SAMPLE_SIZE }} 次作答），继续保持！
        </p>
        <p class="text-xs text-gray-500 mt-2">
          注：作答不足 {{ MIN_SAMPLE_SIZE }} 次的字母样本太少，已标注但不参与加强字母排名。
        </p>
      </div>

      <!-- 按天走势 -->
      <div>
        <h4 class="text-purple-300 font-semibold mb-2 text-sm">
          每日走势<span class="text-gray-500 font-normal">（{{ store.reportRange === '7d' ? '近七天按天排列' : '全部时间按天排列' }}）</span>
        </h4>
        <div class="bg-gray-800/50 rounded-lg p-3">
          <TrendChart :points="days" />
        </div>
      </div>

      <!-- 按字母汇总：顺序与最近一次练习的结果相同 -->
      <div>
        <h4 class="text-purple-300 font-semibold mb-2 text-sm">各字母汇总（按最近练习先后）</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-400 text-left border-b border-gray-700">
                <th class="py-2 pr-4">字母</th>
                <th class="py-2 pr-4 text-right">答对条数</th>
                <th class="py-2 pr-4 text-right">答错条数</th>
                <th class="py-2 pr-4 text-right">正确率</th>
                <th class="py-2 pr-4 text-right">平均作答耗时</th>
                <th class="py-2 text-left">备注</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in letters" :key="l.char" class="border-b border-gray-800">
                <td class="py-2 pr-4 text-xl font-bold text-purple-400">{{ l.char }}</td>
                <td class="py-2 pr-4 text-right text-green-400">{{ l.correctCount }}</td>
                <td class="py-2 pr-4 text-right text-red-400">{{ l.wrongCount }}</td>
                <td class="py-2 pr-4 text-right">{{ l.accuracy }}%</td>
                <td class="py-2 pr-4 text-right">{{ formatAvg(l.avgMs) }}</td>
                <td class="py-2">
                  <span v-if="l.sampleTooSmall"
                    class="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded px-2 py-0.5">
                    样本太少（{{ l.total }}/{{ MIN_SAMPLE_SIZE }}）
                  </span>
                  <span v-else class="text-xs text-gray-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 按练习批次 -->
      <div>
        <h4 class="text-purple-300 font-semibold mb-2 text-sm">按练习批次明细</h4>
        <div class="flex flex-col gap-3">
          <div v-for="(b, bi) in batches" :key="b.batchId" class="bg-gray-800/60 rounded-lg p-3">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div class="text-sm text-gray-300">
                <span class="font-semibold">第 {{ batches.length - bi }} 批</span>
                · {{ formatTime(b.startedAt) }}
              </div>
              <div class="text-xs text-gray-400 flex gap-3">
                <span class="text-green-400">对 {{ b.correctCount }}</span>
                <span class="text-red-400">错 {{ b.wrongCount }}</span>
                <span>正确率 {{ b.accuracy }}%</span>
                <span>均耗时 {{ formatAvg(b.avgMs) }}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <div v-for="l in b.letters" :key="l.char"
                class="flex items-center gap-1 bg-gray-900 rounded px-2 py-1 text-xs"
                :title="`答对 ${l.correctCount} 条 · 答错 ${l.wrongCount} 条 · 平均 ${formatAvg(l.avgMs)}`">
                <span class="font-bold text-purple-400">{{ l.char }}</span>
                <span class="text-green-400">{{ l.correctCount }}✓</span>
                <span class="text-red-400">{{ l.wrongCount }}✗</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
