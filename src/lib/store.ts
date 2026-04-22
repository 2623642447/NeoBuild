import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BuildConfig, ComponentItem, ComponentCategory } from './types'
import { DEFAULT_CATEGORY_DEFS } from './types'
import { generateId } from './utils'
import { saveBuildToCloud, deleteBuildFromCloud, uploadAllLocalBuilds, fetchCloudBuilds, cleanupCloudCategories } from './cloud'

interface BuildStore {
  builds: BuildConfig[]
  activeBuildId: string | null
  sidebarOpen: boolean
  isCloudSyncing: boolean
  isLoggedIn: boolean
  username: string | null

  // Auth actions
  setLoggedIn: (username: string) => void
  setLoggedOut: () => void

  // Cloud sync actions
  syncLocalToCloud: () => Promise<void>
  syncCloudToLocal: () => Promise<void>

  // Actions
  createBuild: (name?: string) => string
  deleteBuild: (id: string) => void
  setActiveBuild: (id: string) => void
  renameBuild: (id: string, name: string) => void
  duplicateBuild: (id: string) => string | null
  toggleSidebar: () => void

  // Category actions
  addCustomCategory: (buildId: string, name: string) => void
  removeCategory: (buildId: string, categoryId: string) => void
  renameCategory: (buildId: string, categoryId: string, name: string) => void

  // Item actions
  addItem: (buildId: string, categoryId: string, item: Omit<ComponentItem, 'id'>) => void
  updateItem: (buildId: string, categoryId: string, itemId: string, updates: Partial<ComponentItem>) => void
  removeItem: (buildId: string, categoryId: string, itemId: string) => void

  // Computed
  getActiveBuild: () => BuildConfig | undefined
  getBuildTotal: (buildId: string) => number
  getCategoryTotal: (buildId: string, categoryId: string) => number
}

function createDefaultBuild(name: string): BuildConfig {
  return {
    id: generateId(),
    name,
    categories: DEFAULT_CATEGORY_DEFS.map(cat => ({
      id: generateId(),
      name: cat.name,
      icon: cat.icon,
      items: [],
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// Debounced cloud sync for build changes
let syncTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedCloudSync(buildId: string, get: () => BuildStore) {
  if (!get().isLoggedIn) return
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(async () => {
    const build = get().builds.find(b => b.id === buildId)
    if (build) {
      try {
        await saveBuildToCloud(build)
        // Cleanup removed categories
        await cleanupCloudCategories(buildId, build.categories.map(c => c.id))
      } catch (e) {
        console.error('Cloud sync failed:', e)
      }
    }
  }, 1500)
}

export const useBuildStore = create<BuildStore>()(
  persist(
    (set, get) => ({
      builds: [],
      activeBuildId: null,
      sidebarOpen: true,
      isCloudSyncing: false,
      isLoggedIn: false,
      username: null,

      setLoggedIn: (username: string) => set({ isLoggedIn: true, username }),
      setLoggedOut: () => set({ isLoggedIn: false, username: null }),

      // Smart sync: upload only builds that don't exist in cloud by name
      // Builds with the same name as cloud builds will be handled by syncCloudToLocal (cloud wins)
      syncLocalToCloud: async () => {
        const { builds } = get()
        if (builds.length === 0) return
        set({ isCloudSyncing: true })
        try {
          // Fetch cloud builds first to check for name conflicts
          const cloudBuilds = await fetchCloudBuilds()
          const cloudNames = new Set(cloudBuilds.map(b => b.name))

          // Only upload builds whose names don't exist in cloud yet
          const buildsToUpload = builds.filter(b => !cloudNames.has(b.name))
          if (buildsToUpload.length > 0) {
            await uploadAllLocalBuilds(buildsToUpload)
          }
        } catch (e) {
          set({ isCloudSyncing: false })
          throw e
        }
        set({ isCloudSyncing: false })
      },

      // Merge cloud data with local by name (cloud is the source of truth)
      // - Builds with the same name: cloud version wins
      // - Cloud-only builds: added to local
      // - Local-only builds: preserved (will be uploaded separately)
      syncCloudToLocal: async () => {
        set({ isCloudSyncing: true })
        try {
          const cloudBuilds = await fetchCloudBuilds()
          if (cloudBuilds.length === 0) {
            set({ isCloudSyncing: false })
            return
          }

          const localBuilds = get().builds

          // Track which names exist in cloud
          const cloudNames = new Set<string>()
          const mergedBuilds: BuildConfig[] = []

          // 1. Add all cloud builds (cloud is source of truth)
          for (const cb of cloudBuilds) {
            mergedBuilds.push(cb)
            cloudNames.add(cb.name)
          }

          // 2. Add local-only builds (not in cloud by name) — they will be uploaded later
          for (const lb of localBuilds) {
            if (!cloudNames.has(lb.name)) {
              mergedBuilds.push(lb)
              cloudNames.add(lb.name)
            }
          }

          // 3. Resolve activeBuildId: try to match by name if old ID no longer exists
          const currentActiveId = get().activeBuildId
          let newActiveId = currentActiveId

          const activeBuildExists = mergedBuilds.some(b => b.id === currentActiveId)
          if (!activeBuildExists && currentActiveId) {
            // The active build was replaced by a cloud version with a different ID
            const oldActiveBuild = localBuilds.find(b => b.id === currentActiveId)
            if (oldActiveBuild) {
              const cloudVersion = mergedBuilds.find(b => b.name === oldActiveBuild.name)
              newActiveId = cloudVersion?.id ?? (mergedBuilds[0]?.id ?? null)
            } else {
              newActiveId = mergedBuilds[0]?.id ?? null
            }
          }

          set({
            builds: mergedBuilds,
            activeBuildId: newActiveId,
          })
        } catch (e) {
          set({ isCloudSyncing: false })
          throw e
        }
        set({ isCloudSyncing: false })
      },

      createBuild: (name?: string) => {
        const build = createDefaultBuild(name || `配置方案 ${get().builds.length + 1}`)
        set(state => ({
          builds: [...state.builds, build],
          activeBuildId: build.id,
        }))
        // Cloud sync
        if (get().isLoggedIn) {
          debouncedCloudSync(build.id, get)
        }
        return build.id
      },

      deleteBuild: (id: string) => {
        set(state => {
          const builds = state.builds.filter(b => b.id !== id)
          const activeBuildId = state.activeBuildId === id
            ? (builds[0]?.id ?? null)
            : state.activeBuildId
          return { builds, activeBuildId }
        })
        if (get().isLoggedIn) {
          deleteBuildFromCloud(id).catch(e => console.error('Cloud delete failed:', e))
        }
      },

      setActiveBuild: (id: string) => set({ activeBuildId: id }),

      renameBuild: (id: string, name: string) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === id ? { ...b, name, updatedAt: Date.now() } : b
          ),
        }))
        debouncedCloudSync(id, get)
      },

      duplicateBuild: (id: string) => {
        const build = get().builds.find(b => b.id === id)
        if (!build) return null
        const newBuild: BuildConfig = {
          ...build,
          id: generateId(),
          name: `${build.name} (副本)`,
          categories: build.categories.map(c => ({
            ...c,
            id: generateId(),
            items: c.items.map(item => ({ ...item, id: generateId() })),
          })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set(state => ({
          builds: [...state.builds, newBuild],
          activeBuildId: newBuild.id,
        }))
        if (get().isLoggedIn) {
          debouncedCloudSync(newBuild.id, get)
        }
        return newBuild.id
      },

      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

      addCustomCategory: (buildId: string, name: string) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === buildId
              ? {
                  ...b,
                  categories: [...b.categories, {
                    id: generateId(),
                    name,
                    icon: 'Package',
                    items: [],
                    isCustom: true,
                  }],
                  updatedAt: Date.now(),
                }
              : b
          ),
        }))
        debouncedCloudSync(buildId, get)
      },

      removeCategory: (buildId: string, categoryId: string) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === buildId
              ? {
                  ...b,
                  categories: b.categories.filter(c => c.id !== categoryId),
                  updatedAt: Date.now(),
                }
              : b
          ),
        }))
        debouncedCloudSync(buildId, get)
      },

      renameCategory: (buildId: string, categoryId: string, name: string) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === buildId
              ? {
                  ...b,
                  categories: b.categories.map(c =>
                    c.id === categoryId ? { ...c, name } : c
                  ),
                  updatedAt: Date.now(),
                }
              : b
          ),
        }))
        debouncedCloudSync(buildId, get)
      },

      addItem: (buildId: string, categoryId: string, item: Omit<ComponentItem, 'id'>) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === buildId
              ? {
                  ...b,
                  categories: b.categories.map(c =>
                    c.id === categoryId
                      ? { ...c, items: [...c.items, { ...item, id: generateId() }] }
                      : c
                  ),
                  updatedAt: Date.now(),
                }
              : b
          ),
        }))
        debouncedCloudSync(buildId, get)
      },

      updateItem: (buildId: string, categoryId: string, itemId: string, updates: Partial<ComponentItem>) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === buildId
              ? {
                  ...b,
                  categories: b.categories.map(c =>
                    c.id === categoryId
                      ? {
                          ...c,
                          items: c.items.map(item =>
                            item.id === itemId ? { ...item, ...updates } : item
                          ),
                        }
                      : c
                  ),
                  updatedAt: Date.now(),
                }
              : b
          ),
        }))
        debouncedCloudSync(buildId, get)
      },

      removeItem: (buildId: string, categoryId: string, itemId: string) => {
        set(state => ({
          builds: state.builds.map(b =>
            b.id === buildId
              ? {
                  ...b,
                  categories: b.categories.map(c =>
                    c.id === categoryId
                      ? { ...c, items: c.items.filter(item => item.id !== itemId) }
                      : c
                  ),
                  updatedAt: Date.now(),
                }
              : b
          ),
        }))
        debouncedCloudSync(buildId, get)
      },

      getActiveBuild: () => {
        const { builds, activeBuildId } = get()
        return builds.find(b => b.id === activeBuildId)
      },

      getBuildTotal: (buildId: string) => {
        const build = get().builds.find(b => b.id === buildId)
        if (!build) return 0
        return build.categories.reduce(
          (sum, cat) => sum + cat.items.reduce((s, item) => s + item.price, 0),
          0
        )
      },

      getCategoryTotal: (buildId: string, categoryId: string) => {
        const build = get().builds.find(b => b.id === buildId)
        if (!build) return 0
        const cat = build.categories.find(c => c.id === categoryId)
        if (!cat) return 0
        return cat.items.reduce((sum, item) => sum + item.price, 0)
      },
    }),
    {
      name: 'neobuild-storage',
      version: 2,
      migrate(persistedState: any, version: number) {
        if (version < 2) {
          // Add new fields for v2
          return {
            ...persistedState,
            isCloudSyncing: false,
            isLoggedIn: false,
            username: null,
          }
        }
        return persistedState
      },
    }
  )
)
