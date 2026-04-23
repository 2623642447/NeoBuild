import { useState } from 'react'
import { useBuildStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  analyzeGamePerformance,
  getTierLabel,
  getTierColor,
  getTierBg,
  getConfidenceLabel,
  getShortModelName,
  RES_FACTORS,
  RES_LABELS,
  type PerfAnalysisResponse,
  type Resolution,
} from '@/lib/game-perf-api'
import { Gamepad2, Loader2, Lock, AlertCircle, Monitor, Cpu, TrendingDown } from 'lucide-react'

const RESOLUTIONS: Resolution[] = ['1080p', '1440p', '4K']

interface GamePerfPanelProps {
  buildId: string
}

export function GamePerfPanel({ buildId }: GamePerfPanelProps) {
  const { builds, isLoggedIn } = useBuildStore()
  const build = builds.find(b => b.id === buildId)

  const [analysis, setAnalysis] = useState<PerfAnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRes, setSelectedRes] = useState<Resolution>('1080p')

  if (!build) return null

  // Extract CPU and GPU names from the build
  const cpuCategory = build.categories.find(c => c.name === 'CPU')
  const gpuCategory = build.categories.find(c => c.name === '显卡')
  const cpuName = cpuCategory?.items[0]?.name || null
  const gpuName = gpuCategory?.items[0]?.name || null
  const hasHardware = cpuName || gpuName

  const handleAnalyze = async () => {
    if (!hasHardware || isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await analyzeGamePerformance(cpuName, gpuName)
      setAnalysis(result)
    } catch (e: any) {
      setError(e.message || '性能分析失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mt-6 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">游戏性能分析 <span className="font-normal text-muted-foreground text-xs">仅供参考</span></h3>
            <p className="text-xs text-muted-foreground">
              {analysis
                ? `识别: ${getShortModelName(analysis.cpuMatched, 'cpu')} + ${getShortModelName(analysis.gpuMatched, 'gpu')}`
                : hasHardware
                  ? '点击分析按钮，识别硬件并计算游戏性能'
                  : '请先在 CPU 和显卡分类中添加配件'}
            </p>
          </div>
        </div>

        {isLoggedIn ? (
          <Button
            variant="cyan"
            size="sm"
            onClick={handleAnalyze}
            disabled={!hasHardware || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                分析中
              </>
            ) : (
              <>
                <Gamepad2 className="h-4 w-4 mr-1.5" />
                分析
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>登录后可用</span>
          </div>
        )}
      </div>

      <CardContent className="p-5">
        {/* No hardware hint */}
        {!hasHardware && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-surface text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>请先在 CPU 和显卡分类中添加配件，才能进行游戏性能分析</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {analysis && (
          <div className="space-y-4">
            {/* Hardware match info */}
            <div className="flex flex-wrap items-center gap-3">
              {analysis.cpuMatched && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface text-xs">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">{getShortModelName(analysis.cpuMatched, 'cpu')}</span>
                  {analysis.cpuMatched.confidence !== 'exact' && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      analysis.cpuMatched.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-600' :
                      analysis.cpuMatched.confidence === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-orange-500/10 text-orange-600'
                    }`}>
                      {getConfidenceLabel(analysis.cpuMatched.confidence)}
                    </span>
                  )}
                </div>
              )}
              {analysis.gpuMatched && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface text-xs">
                  <Monitor className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-foreground">{getShortModelName(analysis.gpuMatched, 'gpu')}</span>
                  {analysis.gpuMatched.confidence !== 'exact' && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      analysis.gpuMatched.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-600' :
                      analysis.gpuMatched.confidence === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-orange-500/10 text-orange-600'
                    }`}>
                      {getConfidenceLabel(analysis.gpuMatched.confidence)}
                    </span>
                  )}
                </div>
              )}
              {!analysis.matched && (
                <div className="flex items-center gap-1.5 text-xs text-orange-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>硬件未精确匹配，数据为估算值</span>
                </div>
              )}
            </div>

            {/* Resolution tabs */}
            <div className="flex gap-2">
              {RESOLUTIONS.map(res => (
                <button
                  key={res}
                  onClick={() => setSelectedRes(res)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    selectedRes === res
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-surface text-muted-foreground border border-transparent hover:bg-accent'
                  }`}
                >
                  {RES_LABELS[res]}
                </button>
              ))}
            </div>

            {/* Game results grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {analysis.results.map(result => {
                const fps = result.fps[selectedRes]
                const gameTier = result.tier[selectedRes]

                return (
                  <div
                    key={result.game}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border ${getTierBg(gameTier)}`}
                  >
                    <div className="flex flex-col min-w-0 mr-3">
                      <span className="text-sm font-medium text-foreground truncate">
                        {result.gameCN}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {result.game}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-price text-sm font-bold ${getTierColor(gameTier)}`}>
                        {fps} FPS
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getTierColor(gameTier)} bg-surface`}>
                        {getTierLabel(gameTier)}
                      </span>
                      {/* Bottleneck icon */}
                      {result.bottleneck === 'gpu' ? (
                        <Monitor className="h-3 w-3 text-muted-foreground/50" />
                      ) : (
                        <Cpu className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 极致 (144+)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> 流畅 (60+)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 中等 (45+)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> 勉强 (30+)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> 卡顿 (&lt;30)</span>
              <span className="text-muted-foreground/40">|</span>
              <span className="flex items-center gap-1"><Monitor className="h-2.5 w-2.5" /> GPU瓶颈</span>
              <span className="flex items-center gap-1"><Cpu className="h-2.5 w-2.5" /> CPU瓶颈</span>
            </div>
          </div>
        )}

        {/* Empty state - has hardware but hasn't analyzed yet */}
        {hasHardware && !analysis && !error && !isLoading && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            点击"分析"按钮，查看当前配置在主流游戏中的性能表现
          </div>
        )}
      </CardContent>
    </Card>
  )
}
