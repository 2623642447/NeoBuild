import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Toast, useToast } from '@/components/ui/toast'
import { fetchSharedBuild, parseShareLink } from '@/lib/share-api'
import { useBuildStore } from '@/lib/store'
import { formatPrice } from '@/lib/utils'
import type { BuildConfig } from '@/lib/types'
import { Link, Loader2, CheckCircle, AlertCircle, Import } from 'lucide-react'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<BuildConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { importBuild } = useBuildStore()
  const { toast, showToast } = useToast()

  const resetState = () => {
    setInputValue('')
    setPreview(null)
    setError(null)
    setLoading(false)
  }

  const handleClose = (val: boolean) => {
    if (!val) resetState()
    onOpenChange(val)
  }

  const handleFetch = async () => {
    const shareId = parseShareLink(inputValue)
    if (!shareId) {
      setError('无法识别分享链接，请检查链接是否正确')
      return
    }

    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const build = await fetchSharedBuild(shareId)
      if (!build) {
        setError('未找到该配置，链接可能已失效')
        return
      }
      setPreview(build)
    } catch {
      setError('获取配置失败，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (!preview) return
    importBuild(preview)
    showToast('配置已导入', 'success')
    handleClose(false)
  }

  const previewTotal = preview
    ? preview.categories.reduce((s, c) => s + c.items.reduce((s2, i) => s2 + i.price, 0), 0)
    : 0

  const previewFilled = preview
    ? preview.categories.filter(c => c.items.length > 0)
    : []

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Import className="h-5 w-5 text-primary" />
              导入配置
            </DialogTitle>
            <DialogDescription>粘贴他人分享的配置链接，即可导入完整配置</DialogDescription>
          </DialogHeader>

          {/* Input area */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
                  placeholder="粘贴分享链接或配置ID..."
                  className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  autoFocus
                />
              </div>
              <Button
                variant="cyan"
                size="sm"
                onClick={handleFetch}
                disabled={!inputValue.trim() || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '获取'
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-foreground">配置获取成功</span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-foreground">{preview.name}</h4>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-price text-lg font-bold text-gradient-cyan">
                      {formatPrice(previewTotal)}
                    </span>
                    <span>{previewFilled.length} 个分类</span>
                    <span>{preview.categories.reduce((s, c) => s + c.items.length, 0)} 件配件</span>
                  </div>
                </div>

                {/* Category summary */}
                <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                  {previewFilled.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between text-xs py-1">
                      <span className="text-muted-foreground">{cat.name}</span>
                      <span className="text-muted-foreground">
                        {cat.items.map(i => i.name).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>

                <Button variant="cyan" onClick={handleImport} className="w-full">
                  <Import className="h-4 w-4 mr-2" />
                  导入到我的配置
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Toast {...toast} />
    </>
  )
}
