import { supabase } from './supabase'

export interface ProductInfo {
  title: string | null
  imageUrl: string | null
  description: string | null
  price: number | null
  priceStatus: 'cached' | 'unavailable' | 'none'
}

/**
 * Call the Edge Function to fetch product info from a URL.
 * Returns parsed OG data + price status.
 */
export async function fetchProductInfo(url: string): Promise<ProductInfo> {
  const { data, error } = await supabase.functions.invoke('fetch-product-info', {
    body: { url },
  })

  if (error) {
    console.error('fetch-product-info error:', error)
    return {
      title: null,
      imageUrl: null,
      description: null,
      price: null,
      priceStatus: 'none',
    }
  }

  return data as ProductInfo
}

/**
 * Save a user-confirmed price to the product_cache table.
 * This allows other users to see cached prices for the same URL.
 */
export async function saveProductPrice(
  url: string,
  price: number,
  platform?: string,
  title?: string,
  imageUrl?: string
): Promise<void> {
  const { error } = await supabase
    .from('product_cache')
    .upsert(
      {
        url,
        platform: platform || null,
        title: title || null,
        image_url: imageUrl || null,
        price,
        price_updated_at: new Date().toISOString(),
      },
      { onConflict: 'url' }
    )

  if (error) {
    console.error('saveProductPrice error:', error)
  }
}
