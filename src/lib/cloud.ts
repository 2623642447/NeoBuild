import { supabase } from './supabase'
import type { BuildConfig } from './types'

// ===== Cloud CRUD operations =====

// Fetch all builds for the current user
export async function fetchCloudBuilds(): Promise<BuildConfig[]> {
  const { data: builds, error } = await supabase
    .from('builds')
    .select('*, categories(*, items(*))')
    .order('updated_at', { ascending: false })

  if (error) throw error
  if (!builds) return []

  return builds.map(mapCloudBuildToLocal)
}

// Upload a single build to the cloud (uses upsert to handle conflicts)
export async function uploadBuildToCloud(build: BuildConfig): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Upsert build (insert or update if exists)
  const buildPayload = {
    id: build.id,
    user_id: user.id,
    name: build.name,
    created_at: new Date(build.createdAt).toISOString(),
    updated_at: new Date(build.updatedAt).toISOString(),
  }

  const { error: buildError } = await supabase
    .from('builds')
    .upsert(buildPayload, { onConflict: 'id' })

  if (buildError) {
    throw buildError
  }

  // 2. Upsert categories and their items
  for (let i = 0; i < build.categories.length; i++) {
    const cat = build.categories[i]

    const catPayload = {
      id: cat.id,
      build_id: build.id,
      name: cat.name,
      icon: cat.icon,
      sort_order: i,
      is_custom: cat.isCustom ?? false,
    }

    const { error: catError } = await supabase
      .from('categories')
      .upsert(catPayload, { onConflict: 'id' })

    if (catError) {
      throw catError
    }

    // Delete existing items for this category first (cleaner than upsert + delete orphans)
    const { error: delItemsError } = await supabase
      .from('items')
      .delete()
      .eq('category_id', cat.id)
    if (delItemsError) {
      throw delItemsError
    }

    // Insert items
    for (let j = 0; j < cat.items.length; j++) {
      const item = cat.items[j]
      const itemPayload = {
        id: item.id,
        category_id: cat.id,
        name: item.name,
        price: item.price,
        link: item.link || null,
        platform: item.platform || null,
        image_url: item.imageUrl || null,
        note: item.note || null,
        sort_order: j,
      }
      const { error: itemError } = await supabase.from('items').insert(itemPayload)
      if (itemError) {
        throw itemError
      }
    }
  }

  // Cleanup removed categories
  await cleanupCloudCategories(build.id, build.categories.map(c => c.id))

  return build.id
}

// Delete a build from the cloud
export async function deleteBuildFromCloud(buildId: string): Promise<void> {
  const { error } = await supabase.from('builds').delete().eq('id', buildId)
  if (error) throw error
}

// Save a single build's changes to cloud (for ongoing edits while logged in)
export async function saveBuildToCloud(build: BuildConfig): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Upsert build with all required fields
  const { error: buildError } = await supabase
    .from('builds')
    .upsert({
      id: build.id,
      user_id: user.id,
      name: build.name,
      created_at: new Date(build.createdAt).toISOString(),
      updated_at: new Date(build.updatedAt).toISOString(),
    }, { onConflict: 'id' })

  if (buildError) return

  // Sync categories
  for (let i = 0; i < build.categories.length; i++) {
    const cat = build.categories[i]
    const { error: catError } = await supabase.from('categories').upsert({
      id: cat.id,
      build_id: build.id,
      name: cat.name,
      icon: cat.icon,
      sort_order: i,
      is_custom: cat.isCustom ?? false,
    }, { onConflict: 'id' })

    if (catError) continue

    // Delete + re-insert items
    const { error: delError } = await supabase.from('items').delete().eq('category_id', cat.id)
    if (delError) continue

    for (let j = 0; j < cat.items.length; j++) {
      const item = cat.items[j]
      await supabase.from('items').insert({
        id: item.id,
        category_id: cat.id,
        name: item.name,
        price: item.price,
        link: item.link || null,
        platform: item.platform || null,
        image_url: item.imageUrl || null,
        note: item.note || null,
        sort_order: j,
      })
    }
  }

  // Cleanup removed categories
  await cleanupCloudCategories(build.id, build.categories.map(c => c.id))
}

// Upload all local builds to cloud (for first-time login sync)
export async function uploadAllLocalBuilds(builds: BuildConfig[]): Promise<void> {
  for (const build of builds) {
    await uploadBuildToCloud(build)
  }
}

// Delete categories not in the build (cleanup)
export async function cleanupCloudCategories(buildId: string, categoryIds: string[]): Promise<void> {
  const { data: existingCats } = await supabase
    .from('categories')
    .select('id')
    .eq('build_id', buildId)

  if (existingCats) {
    const toDelete = existingCats
      .filter(c => !categoryIds.includes(c.id))
      .map(c => c.id)
    if (toDelete.length > 0) {
      await supabase.from('categories').delete().in('id', toDelete)
    }
  }
}

// ===== Mapping functions =====

function mapCloudBuildToLocal(cloudBuild: any): BuildConfig {
  return {
    id: cloudBuild.id,
    name: cloudBuild.name,
    createdAt: new Date(cloudBuild.created_at).getTime(),
    updatedAt: new Date(cloudBuild.updated_at).getTime(),
    categories: (cloudBuild.categories || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        isCustom: cat.is_custom,
        items: (cat.items || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price),
            link: item.link || undefined,
            platform: item.platform || undefined,
            imageUrl: item.image_url || undefined,
            note: item.note || undefined,
          })),
      })),
  }
}
