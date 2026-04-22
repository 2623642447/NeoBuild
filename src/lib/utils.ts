import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

export function generateId(): string {
  // Generate UUID v4 to match Supabase's uuid column type
  return crypto.randomUUID()
}

export function detectPlatform(url: string): { platform: string; id: string | null } {
  // JD - matches item.jd.com/12345.html or jd.com/xxx/12345
  const jdMatch = url.match(/jd\.com\/.*?(\d{4,})/)
  if (jdMatch) return { platform: '京东', id: jdMatch[1] }

  // Taobao
  const tbMatch = url.match(/taobao\.com\/.*?[?&]id=(\d+)/)
  if (tbMatch) return { platform: '淘宝', id: tbMatch[1] }

  // PDD
  const pddMatch = url.match(/yangkeduo\.com\/.*?goods_id=(\d+)/)
  if (pddMatch) return { platform: '拼多多', id: pddMatch[1] }

  // TMall
  const tmallMatch = url.match(/tmall\.com\/.*?[?&]id=(\d+)/)
  if (tmallMatch) return { platform: '天猫', id: tmallMatch[1] }

  return { platform: '未知平台', id: null }
}

export function extractUrlName(url: string): string {
  try {
    const u = new URL(url)
    const pathParts = u.pathname.split('/').filter(Boolean)
    // Try to get meaningful name from URL path
    if (pathParts.length > 0) {
      const last = pathParts[pathParts.length - 1]
      // Remove IDs and file extensions
      const cleaned = last.replace(/\.\w+$/, '').replace(/[-_]/g, ' ')
      if (cleaned.length > 2) return cleaned
    }
    return u.hostname
  } catch {
    return url
  }
}
