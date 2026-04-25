/**
 * Hardware extraction from e-commerce screenshots via Gemini AI
 * Calls Supabase Edge Function with authentication and rate limiting
 */

import { supabase } from './supabase'
import type { ComponentItem } from './types'

// ===================== Category Mapping =====================

/** Gemini English category → NeoBuild Chinese category name */
const CATEGORY_MAP: Record<string, string> = {
  CPU: 'CPU',
  GPU: '显卡',
  Motherboard: '主板',
  RAM: '内存',
  SSD: '硬盘',
  HDD: '硬盘',
  PSU: '电源',
  Cooler: '散热器',
  Case: '机箱',
  Fan: '风扇',
  Monitor: '显示器',
  Accessory: '配件',
}

/** NeoBuild Chinese category → Gemini English category (for hints) */
const CATEGORY_REVERSE_MAP: Record<string, string> = {
  'CPU': 'CPU',
  '显卡': 'GPU',
  '主板': 'Motherboard',
  '内存': 'RAM',
  '硬盘': 'SSD',
  '电源': 'PSU',
  '散热器': 'Cooler',
  '机箱': 'Case',
  '风扇': 'Fan',
  '显示器': 'Monitor',
}

// ===================== Types =====================

export interface ExtractedHardware {
  itemName: string
  price: number | null
  brand: string | null
  category: string      // English from Gemini (e.g., "CPU", "GPU")
  categoryCN: string    // Chinese for NeoBuild (e.g., "CPU", "显卡")
}

export interface ExtractionResult {
  success: boolean
  data?: ExtractedHardware
  error?: string
  imageUrl?: string  // base64 for preview
}

// ===================== API Client =====================

/**
 * Extract hardware info from an e-commerce screenshot image
 * via Supabase Edge Function (Gemini AI + rate limiting)
 *
 * Key note on supabase.functions.invoke behavior:
 * - When Edge Function returns non-2xx (401, 429, 500, 502):
 *   - `error` may be a FunctionsHttpError with context
 *   - `data` may be null or contain the error body
 * - We must handle ALL cases to prevent uncaught exceptions
 */
export async function extractHardwareFromImage(
  imageBase64: string,
  categoryHint?: string
): Promise<ExtractedHardware> {
  let data: any = null
  let error: any = null

  try {
    const result = await supabase.functions.invoke('extract-hardware', {
      body: { imageBase64, categoryHint },
    })
    data = result.data
    error = result.error
  } catch (e: any) {
    // Network error, CORS error, or unexpected JS exception
    throw new Error(e.message || '网络请求失败，请检查网络连接')
  }

  // Case 1: supabase-js returned a FunctionsHttpError (non-2xx response)
  if (error) {
    const msg = error.message || error.context || String(error)

    // Rate limit
    if (msg.includes('429') || msg.includes('频率') || msg.includes('too many')) {
      throw new Error('请求过于频繁，请稍后再试（每分钟最多15次）')
    }
    // Auth failure
    if (msg.includes('401') || msg.includes('未登录') || msg.includes('Unauthorized')) {
      throw new Error('请先登录后再使用截图识别功能')
    }
    // Generic
    throw new Error(msg || '识别服务不可用')
  }

  // Case 2: Edge Function returned 2xx but body contains {error: "..."}
  // (This happens when our own code returns jsonResponse({error: "..."}, status))
  if (data?.error) {
    const errMsg = typeof data.error === 'string' ? data.error : String(data.error)

    if (errMsg.includes('未登录')) {
      throw new Error('请先登录后再使用截图识别功能')
    }
    if (errMsg.includes('频繁') || errMsg.includes('429')) {
      throw new Error('请求过于频繁，请稍后再试（每分钟最多15次）')
    }
    throw new Error(errMsg)
  }

  // Case 3: data is null/undefined (Edge Function returned empty or unexpected format)
  if (!data || typeof data !== 'object') {
    throw new Error('识别服务返回了异常数据，请重试')
  }

  // Case 4: Success — construct ExtractedHardware from response
  const category = data.category || 'Accessory'
  return {
    itemName: data.itemName || '未知配件',
    price: data.price ?? null,
    brand: data.brand || null,
    category,
    categoryCN: CATEGORY_MAP[category] || '配件',
  }
}

/**
 * Convert a File object to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('图片读取失败'))
  })
}

/**
 * Get Gemini English category hint from NeoBuild Chinese category name
 */
export function getCategoryHint(categoryName: string): string | undefined {
  return CATEGORY_REVERSE_MAP[categoryName]
}

/**
 * Convert extracted hardware to a ComponentItem for the store
 */
export function extractedToComponentItem(extracted: ExtractedHardware): Omit<ComponentItem, 'id'> {
  return {
    name: extracted.itemName,
    price: extracted.price ?? 0,
    note: extracted.brand ? `品牌: ${extracted.brand}` : undefined,
  }
}
