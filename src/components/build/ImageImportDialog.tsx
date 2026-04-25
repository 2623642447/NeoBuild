import { useState, useRef, useCallback } from 'react'
import { useBuildStore } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  extractHardwareFromImage,
  fileToBase64,
  getCategoryHint,
  extractedToComponentItem,
  type ExtractionResult,
} from '@/lib/hardware-extract'
import { Camera, Upload, X, Loader2, Check, AlertCircle, Plus } from 'lucide-react'

interface ImageImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, skip category selection and auto-assign to this category */
  fixedCategoryName?: string
  buildId: string
}

export function ImageImportDialog({
  open,
  onOpenChange,
  fixedCategoryName,
  buildId,
}: ImageImportDialogProps) {
  const { builds, addItem } = useBuildStore()
  const build = builds.find(b => b.id === buildId)

  const [results, setResults] = useState<ExtractionResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    // Convert all files to base64 first
    const converted: Array<{ base64: string }> = []
    for (const file of imageFiles) {
      try {
        const base64 = await fileToBase64(file)
        converted.push({ base64 })
      } catch {
        // Skip files that fail to read
      }
    }
    if (converted.length === 0) return

    // Initialize all result slots as pending
    const allResults: ExtractionResult[] = converted.map(({ base64 }) => ({
      success: false,
      imageUrl: base64,
    }))

    setResults([...allResults])
    setProcessing(true)

    // Process each image sequentially to respect rate limits
    for (let i = 0; i < converted.length; i++) {
      setCurrentIdx(i)

      try {
        const { base64 } = converted[i]
        const categoryHint = fixedCategoryName ? getCategoryHint(fixedCategoryName) : undefined
        const data = await extractHardwareFromImage(base64, categoryHint)

        allResults[i] = { success: true, data, imageUrl: base64 }
      } catch (e: any) {
        allResults[i] = {
          success: false,
          error: e.message || '识别失败',
          imageUrl: allResults[i].imageUrl,
        }
      }

      // Update state with current progress
      setResults([...allResults])
    }

    setProcessing(false)
    setCurrentIdx(-1)
  }, [fixedCategoryName])

  const handleAddItem = (result: ExtractionResult) => {
    if (!build || !result.data) return

    const targetCategoryName = fixedCategoryName || result.data.categoryCN
    const category = build.categories.find(c => c.name === targetCategoryName)

    if (category) {
      addItem(buildId, category.id, extractedToComponentItem(result.data))
    }
  }

  const handleAddAll = () => {
    results.forEach(r => {
      if (r.success && r.data) {
        handleAddItem(r)
      }
    })
    setResults([])
  }

  const handleRemove = (idx: number) => {
    setResults(prev => prev.filter((_, i) => i !== idx))
  }

  const handleClose = () => {
    if (!processing) {
      setResults([])
      onOpenChange(false)
    }
  }

  const successCount = results.filter(r => r.success).length
  const hasResults = results.length > 0
  const allDone = !processing

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {fixedCategoryName ? `${fixedCategoryName} - 截图识别` : '批量截图导入'}
          </DialogTitle>
          <DialogDescription>
            上传电商截图，AI 自动识别配件名称、价格和分类
          </DialogDescription>
        </DialogHeader>

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files) }}
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            点击选择图片或拖拽到此处
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            支持 JPG/PNG/WebP，可多选
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={!fixedCategoryName}
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Results list */}
        {hasResults && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0 -mx-1 px-1">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  result.success
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : result.error
                      ? 'border-destructive/20 bg-destructive/5'
                      : 'border-border bg-surface'
                }`}
              >
                {/* Thumbnail */}
                {result.imageUrl && (
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-white flex-shrink-0">
                    <img
                      src={result.imageUrl}
                      alt="截图"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {processing && idx === currentIdx && !result.success && !result.error ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>正在识别...</span>
                    </div>
                  ) : result.success && result.data ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {result.data.itemName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {result.data.categoryCN}
                        </span>
                        {result.data.price != null && (
                          <span className="font-price text-orange-400 font-semibold">
                            ¥{result.data.price}
                          </span>
                        )}
                        {result.data.brand && (
                          <span>{result.data.brand}</span>
                        )}
                      </div>
                    </div>
                  ) : result.error ? (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{result.error}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>等待识别...</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {result.success && result.data && allDone && (
                    <button
                      onClick={() => handleAddItem(result)}
                      className="p-1.5 rounded-md hover:bg-accent text-primary transition-colors"
                      title="添加到配置"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="移除"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {hasResults && allDone && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              已识别 {successCount}/{results.length} 项
            </span>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={() => setResults([])}>
                清空
              </Button>
              <Button
                variant="cyan"
                size="sm"
                onClick={handleAddAll}
                disabled={successCount === 0}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                全部添加 ({successCount})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
