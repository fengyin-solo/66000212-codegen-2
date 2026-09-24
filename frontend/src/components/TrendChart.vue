<template>
  <div class="w-full">
    <svg v-if="days.length" :viewBox="`0 0 ${width} ${height}`" class="w-full h-auto">
      <!-- 网格线：0% / 50% / 100% -->
      <line v-for="g in gridLines" :key="g"
        :x1="pad.left" :x2="width - pad.right"
        :y1="yForRatio(g)" :y2="yForRatio(g)"
        stroke="#1f2937" stroke-width="1" stroke-dasharray="4 4" />
      <text v-for="g in gridLines" :key="`t-${g}`"
        :x="width - pad.right + 6" :y="yForRatio(g) + 4"
        fill="#6b7280" font-size="11">{{ Math.round(g * 100) }}%</text>

      <!-- 每日柱：条数按最大值缩放，正确（绿）在下、错误（红）在上 -->
      <g v-for="(d, i) in days" :key="d.key">
        <rect v-if="d.wrong > 0"
          :x="centerX(i) - barWidth / 2"
          :y="yBottom - barHeight(d.total)"
          :width="barWidth"
          :height="barHeight(d.wrong)"
          fill="#ef4444">
          <title>{{ tooltip(d) }}</title>
        </rect>
        <rect v-if="d.correct > 0"
          :x="centerX(i) - barWidth / 2"
          :y="yBottom - barHeight(d.correct)"
          :width="barWidth"
          :height="barHeight(d.correct)"
          fill="#22c55e">
          <title>{{ tooltip(d) }}</title>
        </rect>
        <text :x="centerX(i)" :y="height - pad.bottom + 18" text-anchor="middle"
          fill="#9ca3af" font-size="11">{{ d.label }}</text>
        <text :x="centerX(i)" :y="height - pad.bottom + 34" text-anchor="middle"
          :fill="d.total ? '#d1d5db' : '#4b5563'" font-size="10">{{ d.total || '—' }}</text>
      </g>

      <!-- 正确率折线（没有作答的日期不连线） -->
      <polyline :points="linePoints" fill="none" stroke="#a855f7" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round" />
      <circle v-for="(p, i) in activePoints" :key="`c-${i}`"
        :cx="p.x" :cy="p.y" r="3.5" fill="#a855f7" stroke="#030712" stroke-width="1.5" />
    </svg>
    <div v-else class="text-sm text-gray-400 py-6 text-center">所选时间范围内暂无走势数据</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DayBucket } from '../types'

const props = defineProps<{ days: DayBucket[] }>()

const width = 640
const height = 220
const pad = { top: 16, right: 48, bottom: 44, left: 16 }
const chartH = height - pad.top - pad.bottom

const gridLines = [0, 0.5, 1]

const maxBarCount = computed(() => Math.max(1, ...props.days.map(d => d.total)))
const yBottom = pad.top + chartH
const barWidth = computed(() => {
  const slot = (width - pad.left - pad.right) / Math.max(1, props.days.length)
  return Math.min(28, slot * 0.55)
})

function centerX(i: number): number {
  const n = Math.max(1, props.days.length)
  const slot = (width - pad.left - pad.right) / n
  return pad.left + slot * i + slot / 2
}

/** 正确率坐标：100% 在顶部，0% 在底部 */
function yForRatio(r: number): number {
  return pad.top + chartH * (1 - r)
}

/** 柱子高度按当天条数占最大条数的比例缩放 */
function barHeight(count: number): number {
  return chartH * (count / maxBarCount.value)
}

const activePoints = computed(() =>
  props.days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.total > 0)
    .map(({ d, i }) => ({ x: centerX(i), y: yForRatio(d.accuracy) })),
)

const linePoints = computed(() => activePoints.value.map(p => `${p.x},${p.y}`).join(' '))

function tooltip(d: DayBucket): string {
  return `${d.key} 共 ${d.total} 条，答对 ${d.correct} 条，正确率 ${Math.round(d.accuracy * 100)}%`
}
</script>
