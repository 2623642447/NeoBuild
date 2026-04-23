import { useState, useRef, useCallback } from 'react'
import { useBuildStore } from '@/lib/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { detectPlatform, extractUrlName } from '@/lib/utils'
import { fetchProductInfo, saveProductPrice, type ProductInfo } from '@/lib/product-api'
import { Link2, Type, X, ExternalLink, Loader2, ImageIcon, Sparkles } from 'lucide-react'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string
  buildId: string
}

export function AddItemDialog({ open, onOpenChange, categoryId, buildId }: AddItemDialogProps) {
  const { addItem, isLoggedIn } = useBuildStore()
  const [mode, setMode] = useState<'manual' | 'link'>('manual')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [link, setLink] = useState('')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)

  // Link fetching state
  const [isFetching, setIsFetching] = useState(false)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pricePrompt, setPricePrompt] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLinkChange = useCallback((url: string) => {
    setLink(url)
    setProductInfo(null)
    setFetchError(null)
    setPricePrompt(null)

    if (url.trim()) {
      const { platform } = detectPlatform(url)
      setDetectedPlatform(platform)
    } else {
      setDetectedPlatform(null)
    }
  }, [])

  const handleFetchProduct = useCallback(async () => {
    if (!link.trim()) return

    // Basic URL validation
    try {
      new URL(link.trim())
    } catch {
      setFetchError('请输入有效的 URL')
      return
    }

    setIsFetching(true)
    setFetchError(null)
    setPricePrompt(null)

    try {
      const info = await fetchProductInfo(link.trim())
      setProductInfo(info)

      // Auto-fill name from fetched title
      if (info.title && !name) {
        setName(info.title)
      }

      // Auto-fill image
      if (info.imageUrl) {
        setImageUrl(info.imageUrl)
      }

      // Handle price status
      if (info.priceStatus === 'cached' && info.price) {
        setPrice(String(info.price))
        setPricePrompt(null)
      } else if (info.priceStatus === 'unavailable') {
        setPricePrompt('已识别商品信息，但无法获取实时价格，请手动输入当前价格')
      } else {
        setPricePrompt('未能自动获取商品信息，请手动输入商品名称和价格')
      }
    } catch {
      setFetchError('获取商品信息失败，请手动输入')
    } finally {
      setIsFetching(false)
    }
  }, [link, name])

  const handleSubmit = async () => {
    if (!name.trim() || !price.trim()) return

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) return

    addItem(buildId, categoryId, {
      name: name.trim(),
      price: priceNum,
      link: link.trim() || undefined,
      platform: detectedPlatform || undefined,
      imageUrl: imageUrl,
      note: note.trim() || undefined,
    })

    // Save price to cache for other users (if logged in and has link)
    if (isLoggedIn && link.trim() && priceNum > 0) {
      saveProductPrice(
        link.trim(),
        priceNum,
        detectedPlatform || undefined,
        name.trim(),
        imageUrl
      ).catch(() => { /* Silent fail — non-critical */ })
    }

    // Reset
    setName('')
    setPrice('')
    setLink('')
    setDetectedPlatform(null)
    setNote('')
    setImageUrl(undefined)
    setProductInfo(null)
    setFetchError(null)
    setPricePrompt(null)
    onOpenChange(false)
  }

  const handleClose = () => {
    setName('')
    setPrice('')
    setLink('')
    setDetectedPlatform(null)
    setNote('')
    setImageUrl(undefined)
    setProductInfo(null)
    setFetchError(null)
    setPricePrompt(null)
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
            onClick={() => { setMode('manual'); setProductInfo(null); setPricePrompt(null); setFetchError(null); }}
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
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="粘贴京东/淘宝/拼多多商品链接"
                    value={link}
                    onChange={e => handleLinkChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && link.trim() && !isFetching) {
                        handleFetchProduct()
                      }
                    }}
                    className="pr-20"
                    disabled={isFetching}
                  />
                  {detectedPlatform && !isFetching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {detectedPlatform}
                    </span>
                  )}
                </div>
                <Button
                  variant="cyan"
                  size="sm"
                  onClick={handleFetchProduct}
                  disabled={!link.trim() || isFetching}
                  className="shrink-0"
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isFetching ? '识别中' : '识别'}
                </Button>
              </div>
              {link.trim() && !isFetching && !productInfo && !fetchError && (
                <p className="text-xs text-muted-foreground mt-1">
                  点击"识别"自动获取商品信息
                </p>
              )}
            </div>
          )}

          {/* Product preview card */}
          {productInfo && (productInfo.imageUrl || productInfo.title) && (
            <div className="flex gap-3 p-3 rounded-lg bg-surface border border-border">
              {productInfo.imageUrl && (
                <div className="w-16 h-16 rounded-md overflow-hidden shrink-0 bg-background">
                  <img
                    src={productInfo.imageUrl}
                    alt={productInfo.title || '商品图片'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {productInfo.title || '未知商品'}
                </p>
                {productInfo.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {productInfo.description}
                  </p>
                )}
                {detectedPlatform && (
                  <span className="inline-block text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-1">
                    {detectedPlatform}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Price prompt */}
          {pricePrompt && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{pricePrompt}</p>
            </div>
          )}

          {/* Fetch error */}
          {fetchError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{fetchError}</p>
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
            {productInfo && productInfo.priceStatus === 'cached' && productInfo.price && (
              <p className="text-xs text-primary mt-1">
                ✅ 价格已从缓存中获取，请确认是否为当前实际价格
              </p>
            )}
            {mode === 'link' && !productInfo?.price && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 电商页面价格多为动态加载，请手动校准
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
            disabled={!name.trim() || !price.trim() || isFetching}
          >
            添加
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
