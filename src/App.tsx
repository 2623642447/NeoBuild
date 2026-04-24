import { useState, useEffect, useRef } from 'react'
import { useBuildStore } from '@/lib/store'
import { formatPrice, cn } from '@/lib/utils'
import { getSession, onAuthStateChange } from '@/lib/supabase'
import { shareBuild, generateShareURL, getShareIdFromURL } from '@/lib/share-api'
import { Sidebar } from '@/components/layout/Sidebar'
import { CategoryCard } from '@/components/build/CategoryCard'
import { StatsPanel } from '@/components/build/StatsPanel'
import { ExportPanel } from '@/components/build/ExportPanel'
import { AddCategoryDialog } from '@/components/build/AddCategoryDialog'
import { GamePerfPanel } from '@/components/build/GamePerfPanel'
import { ImportDialog } from '@/components/build/ImportDialog'
import { SharedBuildView } from '@/components/build/SharedBuildView'
import { BuildProgressBar } from '@/components/build/BuildProgressBar'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { LoginPrompt } from '@/components/auth/LoginPrompt'
import { Button } from '@/components/ui/button'
import { Toast, useToast } from '@/components/ui/toast'
import {
  Share2,
  Upload,
  Plus,
  Pencil,
  Check,
  X,
  Wrench,
  Download,
  Loader2,
} from 'lucide-react'

function App() {
  const {
    builds,
    activeBuildId,
    createBuild,
    setActiveBuild,
    renameBuild,
    getBuildTotal,
    sidebarOpen,
    isLoggedIn,
    setLoggedIn,
    setLoggedOut,
    syncLocalToCloud,
    syncCloudToLocal,
  } = useBuildStore()

  const { toast, showToast } = useToast()
  const [showExport, setShowExport] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isRenamingBuild, setIsRenamingBuild] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareId, setShareId] = useState<string | null>(null)
  const [buildNameInput, setBuildNameInput] = useState('')

  // Auto-create first build (use ref to prevent StrictMode double-create)
  const initRef = useRef(false)
  useEffect(() => {
    if (!initRef.current && builds.length === 0) {
      initRef.current = true
      const id = createBuild('我的第一套配置')
      setActiveBuild(id)
    }
  }, [])

  // Detect share link on page load
  useEffect(() => {
    const id = getShareIdFromURL()
    if (id) setShareId(id)
  }, [])

  // Handle share button click
  const handleShare = async () => {
    if (!activeBuild || isSharing) return
    if (!isLoggedIn) {
      setShowAuthDialog(true)
      return
    }
    setIsSharing(true)
    try {
      const id = await shareBuild(activeBuild)
      const url = generateShareURL(id)
      await navigator.clipboard.writeText(url)
      showToast('分享链接已复制到剪贴板', 'success')
    } catch (e: any) {
      showToast(e.message || '分享失败，请稍后重试', 'error')
    } finally {
      setIsSharing(false)
    }
  }

  // Close shared build view
  const handleCloseSharedBuild = () => {
    setShareId(null)
  }

  // Session restore on page reload: use getSession() instead of onAuthStateChange
  // This avoids the race condition where SIGNED_IN fires during login/registration
  const sessionRestoreRef = useRef(false)
  useEffect(() => {
    if (sessionRestoreRef.current) return
    sessionRestoreRef.current = true

    getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const username = session.user.user_metadata?.username
          || session.user.email?.replace('@neobuild.app', '')
          || '用户'

        if (!useBuildStore.getState().isLoggedIn) {
          setLoggedIn(username)
          try {
            await syncCloudToLocal()
          } catch (e) {
            // Silent fail - local data is still intact
          }
        }
      }
    })
  }, [])

  // Listen ONLY for SIGNED_OUT events (to handle logout from other tabs etc.)
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setLoggedOut()
      }
      // Do NOT handle SIGNED_IN here — it races with AuthDialog's onAuthSuccess
    })

    return () => subscription.unsubscribe()
  }, [])

  // Show login prompt once after first interaction (non-logged-in users)
  const promptShownRef = useRef(false)
  useEffect(() => {
    if (!isLoggedIn && !promptShownRef.current && builds.length > 0) {
      const hasItems = builds.some(b => b.categories.some(c => c.items.length > 0))
      if (hasItems) {
        promptShownRef.current = true
        // Delay to not interrupt user flow
        const timer = setTimeout(() => setShowLoginPrompt(true), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [builds, isLoggedIn])

  const handleAuthSuccess = async () => {
    // This runs AFTER successful login/register from the AuthDialog
    // No race condition: the onAuthStateChange listener does NOT handle SIGNED_IN

    // Step 1: Upload local data to cloud first (preserve existing data)
    try {
      const currentBuilds = useBuildStore.getState().builds
      if (currentBuilds.length > 0) {
        await syncLocalToCloud()
      }
    } catch (e) {
      showToast('上传数据到云端时遇到问题', 'error')
      return // Don't pull from cloud if upload failed - keep local data safe
    }

    // Step 2: Pull cloud data (which now includes what we just uploaded)
    try {
      await syncCloudToLocal()
      showToast('云端数据已同步', 'success')
    } catch (e) {
      showToast('同步完成，但拉取云端数据遇到问题', 'info')
    }
  }

  const activeBuild = builds.find(b => b.id === activeBuildId)
  const total = activeBuildId ? getBuildTotal(activeBuildId) : 0
  const filledCount = activeBuild
    ? activeBuild.categories.filter(c => c.items.length > 0).length
    : 0

  const handleRenameStart = () => {
    if (!activeBuild) return
    setBuildNameInput(activeBuild.name)
    setIsRenamingBuild(true)
  }

  const handleRenameSave = () => {
    if (!activeBuildId || !buildNameInput.trim()) return
    renameBuild(activeBuildId, buildNameInput.trim())
    setIsRenamingBuild(false)
    showToast('方案已重命名', 'success')
  }

  const handleRenameCancel = () => {
    setIsRenamingBuild(false)
  }

  // Empty state - no builds
  if (builds.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 glow-cyan">
            <Wrench className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gradient-cyan mb-3">NeoBuild</h1>
          <p className="text-muted-foreground mb-6">电脑装机配置模拟器</p>
          <Button variant="cyan" size="lg" onClick={() => createBuild()}>
            <Plus className="h-5 w-5 mr-2" />
            开始配置
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onLoginClick={() => setShowAuthDialog(true)} />

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 md:ml-64",
        !sidebarOpen && "md:ml-16"
      )}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 glass-strong border-b border-border">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile logo */}
              <div className="md:hidden flex items-center gap-2 ml-10">
                <span className="font-bold text-gradient-cyan">NeoBuild</span>
              </div>

              {/* Build name */}
              {activeBuild && (
                <div className="hidden md:flex items-center gap-2">
                  {isRenamingBuild ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={buildNameInput}
                        onChange={e => setBuildNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSave()
                          if (e.key === 'Escape') handleRenameCancel()
                        }}
                        className="bg-transparent border-b border-primary text-foreground font-semibold text-lg outline-none px-1"
                        autoFocus
                      />
                      <button onClick={handleRenameSave} className="p-1 rounded hover:bg-accent text-primary">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={handleRenameCancel} className="p-1 rounded hover:bg-accent text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h1 className="text-lg font-semibold text-foreground">{activeBuild.name}</h1>
                      <button
                        onClick={handleRenameStart}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-primary transition-all"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Mobile total */}
              <div className="md:hidden font-price text-sm font-bold text-gradient-cyan">
                {formatPrice(total)}
              </div>

              <Button
                variant="cyan"
                size="sm"
                onClick={() => setShowExport(true)}
                disabled={filledCount === 0}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">导出</span>
              </Button>
              <Button
                variant="cyan"
                size="sm"
                onClick={handleShare}
                disabled={filledCount === 0 || isSharing}
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-1.5" />
                )}
                <span className="hidden sm:inline">{isSharing ? '分享中...' : '分享'}</span>
              </Button>
              <Button
                variant="glass"
                size="sm"
                onClick={() => setShowImportDialog(true)}
              >
                <Download className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">导入</span>
              </Button>
            </div>
          </div>

          {/* Build progress bar */}
          {activeBuild && (
            <div className="px-4 md:px-6 pb-3 pt-1">
              <BuildProgressBar buildId={activeBuild.id} />
            </div>
          )}
        </header>

        {/* Content grid */}
        <div className="p-4 md:p-6">
          {activeBuild ? (
            <>
              <div className="flex flex-col lg:flex-row gap-6">
              {/* Category cards */}
              <div className="flex-1 min-w-0">
                {/* Mobile build name */}
                <div className="md:hidden mb-4">
                  {isRenamingBuild ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={buildNameInput}
                        onChange={e => setBuildNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSave()
                          if (e.key === 'Escape') handleRenameCancel()
                        }}
                        className="bg-transparent border-b border-primary text-foreground font-semibold text-lg outline-none px-1"
                        autoFocus
                      />
                      <button onClick={handleRenameSave} className="p-1 rounded hover:bg-accent text-primary">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={handleRenameCancel} className="p-1 rounded hover:bg-accent text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group" onClick={handleRenameStart}>
                      <h1 className="text-xl font-bold text-foreground">{activeBuild.name}</h1>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeBuild.categories.map(category => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      buildId={activeBuild.id}
                    />
                  ))}

                  {/* Add category card */}
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/30 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-surface group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="text-sm">添加自定义分类</span>
                  </button>
                </div>
              </div>

              {/* Stats sidebar - desktop */}
              <div className="w-full lg:w-72 flex-shrink-0">
                <div className="lg:sticky lg:top-20">
                  <StatsPanel buildId={activeBuild.id} />
                </div>
              </div>
              </div>

              {/* Game Performance Analysis */}
              <GamePerfPanel buildId={activeBuild.id} />
            </>
          ) : (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <p>请选择或创建一个配置方案</p>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      {activeBuildId && (
        <>
          <ExportPanel
            buildId={activeBuildId}
            open={showExport}
            onOpenChange={setShowExport}
          />
          <AddCategoryDialog
            buildId={activeBuildId}
            open={showAddCategory}
            onOpenChange={setShowAddCategory}
          />
        </>
      )}

      {/* Auth dialogs */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={handleAuthSuccess}
      />
      <LoginPrompt
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        onLoginClick={() => {
          setShowLoginPrompt(false)
          setShowAuthDialog(true)
        }}
      />

      {/* Import dialog */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      {/* Shared build view (from share link) */}
      {shareId && (
        <SharedBuildView
          shareId={shareId}
          onClose={handleCloseSharedBuild}
        />
      )}

      <Toast {...toast} />
    </div>
  )
}

export default App
