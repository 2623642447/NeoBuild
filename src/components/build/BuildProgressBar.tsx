import { useBuildStore } from '@/lib/store'
import { DEFAULT_CATEGORY_DEFS } from '@/lib/types'

/** 核心装机分类（计入进度） */
const CORE_CATEGORIES = DEFAULT_CATEGORY_DEFS.slice(0, 8).map(d => d.name)

interface BuildProgressBarProps {
  buildId: string
}

export function BuildProgressBar({ buildId }: BuildProgressBarProps) {
  const { builds } = useBuildStore()
  const build = builds.find(b => b.id === buildId)
  if (!build) return null

  // 只计算核心分类的进度
  const coreCategories = build.categories.filter(c => CORE_CATEGORIES.includes(c.name))
  const filledCore = coreCategories.filter(c => c.items.length > 0).length
  const totalCore = CORE_CATEGORIES.length
  const progress = totalCore > 0 ? Math.round((filledCore / totalCore) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs font-price font-semibold text-gradient-cyan tabular-nums w-10 text-right">
        {progress}%
      </span>
    </div>
  )
}
