import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Toast, useToast } from '@/components/ui/toast'
import { fetchSharedBuild, clearShareParam } from '@/lib/share-api'
import { useBuildStore } from '@/lib/store'
import { formatPrice } from '@/lib/utils'
import type { BuildConfig } from '@/lib/types'
import { Loader2, AlertCircle, Import, Eye, Wrench } from 'lucide-react'

interface SharedBuildViewProps {
  shareId: string
  onClose: () => void
}

export function SharedBuildView({ shareId, onClose }: SharedBuildViewProps) {
  const [build, setBuild] = useState<BuildConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { importBuild } = useBuildStore()
  const { toast, showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchSharedBuild(shareId)
        if (cancelled) return
        if (!result) {
          setError('未找到该配置，链接可能已失效')
          return
        }
        setBuild(result)
      } catch {
        if (cancelled) return
        setError('加载配置失败，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [shareId])

  const handleImport = () => {
    if (!build) return
    importBuild(build)
    showToast('配置已导入到你的列表', 'success')
    clearShareParam()
    onClose()
  }

  const handleClose = () => {
    clearShareParam()
    onClose()
  }

  const total = build
    ? build.categories.reduce((s, c) => s + c.items.reduce((s2, i) => s2 + i.price, 0), 0)
    : 0

  const filledCategories = build
    ? build.categories.filter(c => c.items.length > 0)
    : []

  return (
    <>
      <Dialog open={true} onOpenChange={() => handleClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              分享的配置
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">正在加载配置...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
              <Button variant="glass" onClick={handleClose}>关闭</Button>
            </div>
          ) : build ? (
            <div className="space-y-4">
              {/* Build header */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                  <Wrench className="h-3 w-3" />
                  NeoBuild 配置分享
                </div>
                <h3 className="text-xl font-bold text-foreground">{build.name}</h3>
                <p className="text-lg font-price font-bold text-gradient-cyan mt-1">
                  {formatPrice(total)}
                </p>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                {filledCategories.map(cat => {
                  const catTotal = cat.items.reduce((s, i) => s + i.price, 0)
                  return (
                    <div key={cat.id} className="rounded-lg border border-border bg-surface/50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border">
                        <span className="text-sm font-semibold text-primary">{cat.name}</span>
                        {cat.items.length > 1 && (
                          <span className="font-price text-xs text-muted-foreground">
                            {formatPrice(catTotal)}
                          </span>
                        )}
                      </div>
                      <div className="divide-y divide-border/50">
                        {cat.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0 mr-3">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-8 h-8 rounded object-cover shrink-0"
                                />
                              )}
                              <span className="text-sm text-foreground truncate">{item.name}</span>
                            </div>
                            <span className="font-price text-sm font-semibold text-foreground shrink-0">
                              {formatPrice(item.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {filledCategories.length} 个分类 · {build.categories.reduce((s, c) => s + c.items.length, 0)} 件配件
                </span>
                <span className="font-price text-xl font-bold text-gradient-cyan">
                  {formatPrice(total)}
                </span>
              </div>

              {/* Import button */}
              <Button variant="cyan" onClick={handleImport} className="w-full h-11">
                <Import className="h-4 w-4 mr-2" />
                导入到我的配置
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Toast {...toast} />
    </>
  )
}
