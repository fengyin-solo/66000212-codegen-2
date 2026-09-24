<template>
  <div class="flex flex-col gap-4">
    <!-- 时间范围切换：选择状态由 store 持久化，离开再回来仍保留 -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h3 class="text-purple-300 font-bold">练习情况报表</h3>
      <div class="flex bg-gray-800 rounded-lg p-1 text-sm">
        <button v-for="opt in rangeOptions" :key="opt.id"
          @click="store.setRange(opt.id)"
          class="px-3 py-1.5 rounded-md transition-colors"
          :class="store.range === opt.id ? 'bg-purple-500 text-white' : 'text-gray-300 hover:bg-gray-700'">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 空数据：给说明而不是空白表格 -->
    <div v-if="report.total === 0" class="bg-gray-900 rounded-xl p-8 text-center flex flex-col items-center gap-3">
      <div class="text-5xl">📭</div>
      <p class="text-gray-300 font-medium">{{ emptyTitle }}</p>
      <p class="text-sm text-gray-500 max-w-md">
        {{ emptyHint }}
      </p>
      <button @click="goPractice"
        class="mt-2 bg-purple-500 px-5 py-2 rounded-lg hover:bg-purple-400 text-sm">
        去训练
      </button>
    </div>

    <template v-else>
      <!-- 整体概览 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div class="bg-gray-900 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-purple-400">{{ report.batchCount }}</div>
          <div class="text-xs text-gray-400">练习批次</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-gray-100">{{ report.total }}</div>
          <div class="text-xs text-gray-400">作答条数</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-green-400">{{ report.correct }}</div>
          <div class="text-xs text-gray-400">答对条数</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-red-400">{{ report.total - report.correct }}</div>
          <div class="text-xs text-gray-400">答错条数</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-3 text-center">
          <div class="text-2xl font-bold text-purple-400">{{ Math.round(report.accuracy * 100) }}%</div>
          <div class="text-xs text-gray-400">整体正确率</div>
        </div>
      </div>

      <!-- 需要加强的字母 -->
      <div class="bg-gray-900 rounded-xl p-4">
        <h4 class="text-purple-300 font-bold mb-3">需要加强的字母</h4>
        <div v-if="rankableChars.length === 0" class="text-sm text-gray-500">
          每个字母都只答过一两次，样本太少，暂不排名。多练几次后这里会给出需要重点加强的字母。
        </div>
        <div v-else-if="report.weakChars.length" class="flex flex-wrap gap-3">
          <div v-for="s in report.weakChars" :key="s.char"
            class="bg-gray-800 rounded-lg px-4 py-3 flex flex-col items-center min-w-[5.5rem]">
            <div class="text-2xl font-bold" :class="weakColor(s.accuracy)">{{ s.char }}</div>
            <div class="text-xs text-gray-400 mt-1">正确率 {{ Math.round(s.accuracy * 100) }}%</div>
            <div class="text-xs text-gray-500">错 {{ s.wrong }} / {{ s.total }} 条</div>
          </div>
        </div>
        <p v-else class="text-sm text-green-400">样本足够的字母全部答对，暂时没有需要特别加强的字母，继续保持！</p>
        <p v-if="smallChars.length" class="text-xs text-gray-500 mt-3">
          样本太少（不足 {{ MIN_SAMPLE_SIZE }} 次，不参与排名）：
          <span v-for="s in smallChars" :key="s.char" class="inline-block ml-1">
            {{ s.char }}（{{ s.total }} 次）
          </span>
        </p>
      </div>

      <!-- 按天走势 -->
      <div class="bg-gray-900 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-purple-300 font-bold">每日走势</h4>
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span class="flex items-center gap-1"><i class="w-3 h-3 rounded-sm bg-green-500 inline-block" />答对</span>
            <span class="flex items-center gap-1"><i class="w-3 h-3 rounded-sm bg-red-500 inline-block" />答错</span>
            <span class="flex items-center gap-1"><i class="w-4 h-0.5 bg-purple-500 inline-block" />正确率</span>
          </div>
        </div>
        <TrendChart :days="report.days" />
      </div>

      <!-- 各字母汇总：顺序与最近一次练习相同 -->
      <div class="bg-gray-900 rounded-xl p-4">
        <h4 class="text-purple-300 font-bold mb-3">各字母表现</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-400 text-left border-b border-gray-800">
                <th class="py-2 px-2">字母</th>
                <th class="py-2 px-2 text-right">答对</th>
                <th class="py-2 px-2 text-right">答错</th>
                <th class="py-2 px-2 text-right">正确率</th>
                <th class="py-2 px-2 text-right">平均耗时</th>
                <th class="py-2 px-2">备注</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in report.charStats" :key="s.char" class="border-b border-gray-800/60">
                <td class="py-2 px-2 text-xl font-bold text-purple-400">{{ s.char }}</td>
                <td class="py-2 px-2 text-right text-green-400">{{ s.correct }}</td>
                <td class="py-2 px-2 text-right text-red-400">{{ s.wrong }}</td>
                <td class="py-2 px-2 text-right" :class="s.sampleTooSmall ? 'text-gray-500' : weakColor(s.accuracy)">
                  {{ Math.round(s.accuracy * 100) }}%
                </td>
                <td class="py-2 px-2 text-right text-gray-300">{{ formatDuration(s.avgDurationMs) }}</td>
                <td class="py-2 px-2">
                  <span v-if="s.sampleTooSmall"
                    class="text-xs bg-gray-800 text-gray-400 rounded px-2 py-0.5">样本太少</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 按练习批次展开 -->
      <div class="bg-gray-900 rounded-xl p-4">
        <h4 class="text-purple-300 font-bold mb-3">按练习批次查看</h4>
        <div class="space-y-2">
          <div v-for="(b, idx) in report.batches" :key="b.batchId"
            class="bg-gray-800 rounded-lg overflow-hidden">
            <button @click="toggleBatch(b.batchId)"
              class="w-full flex justify-between items-center px-4 py-3 hover:bg-gray-700/50 text-left">
              <span class="font-medium">
                第 {{ report.batches.length - idx }} 批 · {{ formatBatchTime(b.startedAt) }}
              </span>
              <span class="text-sm text-gray-400 flex items-center gap-3">
                <span>{{ b.total }} 条 · 对 {{ b.correct }} · 正确率 {{ Math.round(b.accuracy * 100) }}% · 均耗 {{ formatDuration(b.avgDurationMs) }}</span>
                <span class="text-xs">{{ expandedBatches.has(b.batchId) ? '收起 ▲' : '展开 ▼' }}</span>
              </span>
            </button>
            <div v-if="expandedBatches.has(b.batchId)" class="px-4 pb-3">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-gray-400 text-left">
                    <th class="py-1 px-2">字母</th>
                    <th class="py-1 px-2 text-right">答对</th>
                    <th class="py-1 px-2 text-right">答错</th>
                    <th class="py-1 px-2 text-right">平均耗时</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in b.chars" :key="s.char">
                    <td class="py-1 px-2 font-bold text-purple-400">{{ s.char }}</td>
                    <td class="py-1 px-2 text-right text-green-400">{{ s.correct }}</td>
                    <td class="py-1 px-2 text-right text-red-400">{{ s.wrong }}</td>
                    <td class="py-1 px-2 text-right text-gray-300">{{ formatDuration(s.avgDurationMs) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBrailleStore } from '../store/braille'
import { formatDuration, MIN_SAMPLE_SIZE } from '../utils/report'
import TrendChart from './TrendChart.vue'
import type { ReportRange } from '../types'

const emit = defineEmits<{ (e: 'go-practice'): void }>()

const store = useBrailleStore()
const report = computed(() => store.report)

const rangeOptions: { id: ReportRange; label: string }[] = [
  { id: '7d', label: '近七天' },
  { id: 'all', label: '全部时间' },
]

const expandedBatches = ref<Set<number>>(new Set())

function toggleBatch(batchId: number) {
  if (expandedBatches.value.has(batchId)) expandedBatches.value.delete(batchId)
  else expandedBatches.value.add(batchId)
}

const smallChars = computed(() => report.value.charStats.filter(s => s.sampleTooSmall))
const rankableChars = computed(() => report.value.charStats.filter(s => !s.sampleTooSmall))

const emptyTitle = computed(() =>
  store.range === '7d' ? '近七天还没有练习记录' : '还没有任何练习记录',
)
const emptyHint = computed(() =>
  store.range === '7d'
    ? '最近七天没有作答数据，报表暂无可统计的内容。切换到「全部时间」可查看更早的记录，或先去完成一次训练。'
    : '完成一次训练后，这里会按练习批次列出每个字母的答对、答错与平均作答耗时，并给出整体正确率、薄弱字母和每日走势。',
)

function goPractice() {
  emit('go-practice')
}

function weakColor(accuracy: number): string {
  if (accuracy < 0.6) return 'text-red-400'
  if (accuracy < 0.85) return 'text-yellow-400'
  return 'text-green-400'
}

function formatBatchTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>
