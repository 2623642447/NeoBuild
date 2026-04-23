import { useState, useEffect } from 'react'
import { useBuildStore } from '@/lib/store'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tag, Store, Sparkles, ChevronRight } from 'lucide-react'

/** 抖音音符图标 — 八分音符造型 */
function DouyinNote({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.57 2.3a1 1 0 0 0-.94-.01A1 1 0 0 0 10 3.2v11.26A4.46 4.46 0 0 0 7.5 14 4.5 4.5 0 1 0 12 18.5V9.17a7.86 7.86 0 0 0 4.83 1.7 1 1 0 0 0 0-2A5.87 5.87 0 0 1 12 3.15V3.2a1 1 0 0 0-.43-.9zM7.5 16a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z" />
    </svg>
  )
}

// ===================== Analytics Tracking =====================

interface QREvent {
  type: 'douyin' | 'shop'
  timestamp: number
  userId: string
}

const ANALYTICS_KEY = 'neobuild-qr-analytics'

interface QRAnalytics {
  events: QREvent[]
  uniqueUsers: Record<string, string[]>  // type -> userId[]
  totalCounts: Record<string, number>     // type -> count
}

function getAnalytics(): QRAnalytics {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { events: [], uniqueUsers: { douyin: [], shop: [] }, totalCounts: { douyin: 0, shop: 0 } }
}

function saveAnalytics(data: QRAnalytics) {
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data))
}

function trackQREvent(type: 'douyin' | 'shop') {
  const analytics = getAnalytics()
  const userId = getOrCreateUserId()

  const event: QREvent = { type, timestamp: Date.now(), userId }
  analytics.events.push(event)
  analytics.totalCounts[type] = (analytics.totalCounts[type] || 0) + 1

  if (!analytics.uniqueUsers[type]) analytics.uniqueUsers[type] = []
  if (!analytics.uniqueUsers[type].includes(userId)) {
    analytics.uniqueUsers[type].push(userId)
  }

  saveAnalytics(analytics)
}

// Simple anonymous user ID (persisted per device)
const USER_ID_KEY = 'neobuild-uid'
function getOrCreateUserId(): string {
  let uid = localStorage.getItem(USER_ID_KEY)
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
    localStorage.setItem(USER_ID_KEY, uid)
  }
  return uid
}

// ===================== QR Code Data =====================
// In production, these would be real QR code image URLs or generated dynamically

const QR_DATA = {
  douyin: {
    label: '抖音成品展示',
    description: '扫码查看已售成品整机',
    image: '/qr-douyin.png',
    color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    icon: DouyinNote,
  },
  shop: {
    label: '店铺二维码',
    description: '扫码访问店铺，更多优惠',
    image: '/qr-shop.png',
    color: 'bg-primary/10 text-primary border-primary/20',
    icon: Store,
  },
}

// ===================== Price Calculation =====================

interface PriceBreakdown {
  total: number
  discounted: number
  savings: number
  linkItems: number    // items with e-commerce links
  noLinkItems: number  // items without links
  linkDiscount: number // total discount from linked items
  noLinkDiscount: number // total discount from unlinked items
}

function calculatePriceBreakdown(buildId: string): PriceBreakdown {
  const { builds } = useBuildStore.getState()
  const build = builds.find(b => b.id === buildId)
  if (!build) return { total: 0, discounted: 0, savings: 0, linkItems: 0, noLinkItems: 0, linkDiscount: 0, noLinkDiscount: 0 }

  let total = 0
  let discounted = 0
  let linkItems = 0
  let noLinkItems = 0
  let linkDiscount = 0
  let noLinkDiscount = 0

  for (const cat of build.categories) {
    for (const item of cat.items) {
      total += item.price
      if (item.link && item.link.trim() !== '') {
        // Items with e-commerce link: 92% of price
        const disc = item.price * 0.92
        linkDiscount += item.price - disc
        discounted += disc
        linkItems++
      } else {
        // Items without link: 98% of price
        const disc = item.price * 0.98
        noLinkDiscount += item.price - disc
        discounted += disc
        noLinkItems++
      }
    }
  }

  return {
    total,
    discounted: Math.round(discounted * 100) / 100,
    savings: Math.round((total - discounted) * 100) / 100,
    linkItems,
    noLinkItems,
    linkDiscount: Math.round(linkDiscount * 100) / 100,
    noLinkDiscount: Math.round(noLinkDiscount * 100) / 100,
  }
}

// ===================== Component =====================

interface PriceDialogProps {
  buildId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PriceDialog({ buildId, open, onOpenChange }: PriceDialogProps) {
  const { builds } = useBuildStore()
  const build = builds.find(b => b.id === buildId)

  const [showQR, setShowQR] = useState<'douyin' | 'shop' | null>(null)
  const [breakdown, setBreakdown] = useState<PriceBreakdown>({
    total: 0, discounted: 0, savings: 0, linkItems: 0, noLinkItems: 0, linkDiscount: 0, noLinkDiscount: 0,
  })

  useEffect(() => {
    if (open) {
      setBreakdown(calculatePriceBreakdown(buildId))
      setShowQR(null)
    }
  }, [open, buildId, builds])  // recalculate when build data changes

  if (!build) return null

  const totalItems = breakdown.linkItems + breakdown.noLinkItems

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-orange-500" />
            价格优惠详情
          </DialogTitle>
          <DialogDescription>
            {build.name} · {totalItems} 件配件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Price comparison */}
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Original price */}
            <div className="px-4 py-3 flex items-center justify-between bg-surface">
              <span className="text-sm text-muted-foreground">配件总价</span>
              <span className="font-price text-base font-semibold text-foreground">
                {formatPrice(breakdown.total)}
              </span>
            </div>

            {/* Discounted price */}
            <div className="px-4 py-3 flex items-center justify-between bg-primary/5 border-t border-primary/20">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-foreground">优惠后价格</span>
              </div>
              <div className="text-right">
                <span className="font-price text-xl font-bold text-gradient-cyan">
                  {formatPrice(breakdown.discounted)}
                </span>
                <span className="block text-xs text-emerald-600 font-price">
                  省 {formatPrice(breakdown.savings)}
                </span>
              </div>
            </div>
          </div>

          {/* Service promises */}
          <div className="text-[11px] text-muted-foreground/70 px-1 space-y-0.5">
            <p>· 支持配件直发</p>
            <p>· 支持装机发货，开箱即用</p>
            <p>· 顺丰包邮（偏远地区除外）</p>
          </div>

          {/* QR Code section */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground px-1">扫码了解更多</p>
            <div className="grid grid-cols-2 gap-3">
              {(['douyin', 'shop'] as const).map(type => {
                const qr = QR_DATA[type]
                const Icon = qr.icon
                const isShowing = showQR === type

                return (
                  <button
                    key={type}
                    onClick={() => {
                      trackQREvent(type)
                      setShowQR(isShowing ? null : type)
                    }}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200 ${
                      isShowing
                        ? qr.color
                        : 'border-border hover:border-primary/30 bg-surface hover:bg-accent'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isShowing ? '' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${isShowing ? '' : 'text-muted-foreground'}`}>
                      {qr.label}
                    </span>
                    <ChevronRight className={`h-3 w-3 absolute top-2 right-2 text-muted-foreground/40 transition-transform ${
                      isShowing ? 'rotate-90' : ''
                    }`} />
                  </button>
                )
              })}
            </div>

            {/* QR Code display area */}
            {showQR && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-surface border border-border animate-fade-in">
                <div className="w-40 h-40 rounded-lg bg-white overflow-hidden flex items-center justify-center">
                  <img
                    src={QR_DATA[showQR].image}
                    alt={QR_DATA[showQR].label}
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">{QR_DATA[showQR].description}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Export analytics helpers for admin/dashboard use
export { getAnalytics, trackQREvent, type QRAnalytics }
