import { supabase } from './supabase'
import type { BuildConfig } from './types'

/**
 * Share a build configuration to the database.
 * Returns the share ID used to construct the share link.
 */
export async function shareBuild(build: BuildConfig): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('shared_builds')
    .insert({
      build_data: build as any,
      build_name: build.name,
      shared_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('shareBuild error:', error)
    throw new Error('分享配置失败，请稍后重试')
  }

  return data.id
}

/**
 * Fetch a shared build by its share ID.
 * Also increments the view count.
 */
export async function fetchSharedBuild(shareId: string): Promise<BuildConfig | null> {
  // Fetch the shared build data
  const { data, error } = await supabase
    .from('shared_builds')
    .select('id, build_data, build_name, view_count, created_at')
    .eq('id', shareId)
    .single()

  if (error || !data) {
    console.error('fetchSharedBuild error:', error)
    return null
  }

  // Increment view count via RPC (security definer function)
  supabase.rpc('increment_shared_view_count', { share_id: shareId }).then(() => {}, () => {
    // Silently ignore view count failures
  })

  const buildData = data.build_data as BuildConfig
  // Ensure the build has a fresh ID to avoid conflicts when importing
  return {
    ...buildData,
    name: data.build_name || buildData.name,
  }
}

/**
 * Generate the share URL for a given share ID.
 */
export function generateShareURL(shareId: string): string {
  const baseURL = window.location.origin + window.location.pathname
  return `${baseURL}?share=${shareId}`
}

/**
 * Extract share ID from the current URL.
 */
export function getShareIdFromURL(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('share')
}

/**
 * Clear the share parameter from the URL without page reload.
 */
export function clearShareParam(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('share')
  window.history.replaceState({}, '', url.toString())
}

/**
 * Validate a share link and extract the share ID.
 */
export function parseShareLink(input: string): string | null {
  const trimmed = input.trim()

  // Direct UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed
  }

  // Full URL with ?share= parameter
  try {
    const url = new URL(trimmed)
    const shareId = url.searchParams.get('share')
    if (shareId) return shareId
  } catch {
    // Not a valid URL, ignore
  }

  // Try appending to current origin
  try {
    const url = new URL(trimmed, window.location.origin)
    const shareId = url.searchParams.get('share')
    if (shareId) return shareId
  } catch {
    // ignore
  }

  return null
}
