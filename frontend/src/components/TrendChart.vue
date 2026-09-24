<script setup lang="ts">
import { computed } from 'vue'
import type { DayPoint } from '../utils/report'

const props = defineProps<{ points: DayPoint[] }>()

const CHART_H = 160
const BAR_W = 26
const GAP = 16

const maxTotal = computed(() => Math.max(1, ...props.points.map(p => p.total)))
</script>

<template>
  <div class="overflow-x-auto pb-1">
    <svg :width="Math.max(points.length * (BAR_W + GAP) + GAP, 320)" :height="CHART_H + 48" class="block">
      <!-- 网格基线 -->
      <line x1="0" :y1="CHART_H + 4" :x2="points.length * (BAR_W + GAP) + GAP" :y2="CHART_H + 4" stroke="#374151" />
      <g v-for="(p, i) in points" :key="p.date">
        <template v-if="p.total">
          <!-- 答对（下，绿）+ 答错（上，红），高度按当日总条数相对最大值缩放 -->
          <rect
            :x="i * (BAR_W + GAP) + GAP / 2"
            :y="CHART_H - (p.correctCount / maxTotal) * CHART_H + 4"
            :width="BAR_W"
            :height="(p.correctCount / maxTotal) * CHART_H"
            fill="#22c55e" rx="3">
            <title>{{ p.date }} 答对 {{ p.correctCount }} 条</title>
          </rect>
          <rect
            :x="i * (BAR_W + GAP) + GAP / 2"
            :y="CHART_H - (p.total / maxTotal) * CHART_H + 4"
            :width="BAR_W"
            :height="(p.wrongCount / maxTotal) * CHART_H"
            fill="#ef4444" rx="3">
            <title>{{ p.date }} 答错 {{ p.wrongCount }} 条 · 正确率 {{ p.accuracy }}%</title>
          </rect>
          <text :x="i * (BAR_W + GAP) + GAP / 2 + BAR_W / 2"
            :y="CHART_H - (p.total / maxTotal) * CHART_H - 2"
            text-anchor="middle" class="fill-gray-300" style="font-size:10px">{{ p.accuracy }}%</text>
        </template>
        <text :x="i * (BAR_W + GAP) + GAP / 2 + BAR_W / 2" :y="CHART_H + 18"
          text-anchor="middle" class="fill-gray-400" style="font-size:10px">{{ p.label }}</text>
        <text :x="i * (BAR_W + GAP) + GAP / 2 + BAR_W / 2" :y="CHART_H + 34"
          text-anchor="middle" :class="p.total ? 'fill-gray-500' : 'fill-gray-600'" style="font-size:9px">
          {{ p.total ? p.total : '·' }}
        </text>
      </g>
    </svg>
    <div class="flex items-center gap-4 text-xs text-gray-400 mt-1">
      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-green-500"></span>答对</span>
      <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-red-500"></span>答错</span>
      <span>柱高按当日作答条数缩放，绿色在下为答对、红色在上为答错；上方是正确率，下方是总条数</span>
    </div>
  </div>
</template>
