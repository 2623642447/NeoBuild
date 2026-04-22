import { useState } from 'react'
import { useBuildStore } from '@/lib/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { detectPlatform, extractUrlName } from '@/lib/utils'
import { Link2, Type, X, ExternalLink } from 'lucide-react'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  buildId: string
}

export function AddItemDialog({ open, onOpenChange, categoryId, buildId }: AddItemDialogProps) {
  const { addItem } = useBuildStore()
  const [mode, setMode] = useState<'manual' | 'link'>('manual')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [link, setLink] = useState('')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const handleLinkChange = (url: string) => {
    setLink(url)
    if (url.trim()) {
      const { platform } = detectPlatform(url)
      setDetectedPlatform(platform)
      if (!name) {
        setName(extractUrlName(url))
      }
    } else {
      setDetectedPlatform(null)
    }
  }

  const handleSubmit = () => {
    if (!name.trim() || !price.trim()) return

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) return

    addItem(buildId, categoryId, {
      name: name.trim(),
      price: priceNum,
      link: link.trim() || undefined,
      platform: detectedPlatform || undefined,
      note: note.trim() || undefined,
    })

    // Reset
    setName('')
    setPrice('')
    setLink('')
    setDetectedPlatform(null)
    setNote('')
    onOpenChange(false)
  }

  const handleClose = () => {
    setName('')
    setPrice('')
    setLink('')
    setDetectedPlatform(null)
    setNote('')
    setMode('manual')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加配件</DialogTitle>
          <DialogDescription>手动输入配件信息，或粘贴电商链接自动识别</DialogDescription>
        </DialogHeader>

        {/* Mode Switch */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'manual'
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary text-secondary-foreground border border-transparent hover:bg-accent'
            }`}
          >
            <Type className="h-4 w-4" />
            手动输入
          </button>
          <button
            onClick={() => setMode('link')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              mode === 'link'
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary text-secondary-foreground border border-transparent hover:bg-accent'
            }`}
          >
            <Link2 className="h-4 w-4" />
            链接识别
          </button>
        </div>

        <div className="space-y-3">
          {/* Link input (if link mode) */}
          {mode === 'link' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                商品链接
              </label>
              <div className="relative">
                <Input
                  placeholder="粘贴京东/淘宝/拼多多商品链接"
                  value={link}
                  onChange={e => handleLinkChange(e.target.value)}
                  className="pr-20"
                />
                {detectedPlatform && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {detectedPlatform}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              商品名称 <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="例如：Intel i7-14700K"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Price */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              价格 (¥) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={price}
              onChange={e => setPrice(e.target.value)}
              min="0"
              step="0.01"
              className="font-price"
            />
            {mode === 'link' && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 链接识别价格可能不准，请手动校准
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              备注
            </label>
            <Input
              placeholder="可选备注信息"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={handleClose}>
            取消
          </Button>
          <Button
            variant="cyan"
            onClick={handleSubmit}
            disabled={!name.trim() || !price.trim()}
          >
            添加
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
