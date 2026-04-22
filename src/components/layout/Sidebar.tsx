import { useState } from 'react'
import { useBuildStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { UserBadge } from '@/components/auth/UserBadge'
import { cn } from '@/lib/utils'
import {
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Pencil,
  Check,
  X,
  LogIn,
} from 'lucide-react'

interface SidebarProps {
  onLoginClick: () => void
}

export function Sidebar({ onLoginClick }: SidebarProps) {
  const {
    builds,
    activeBuildId,
    sidebarOpen,
    isLoggedIn,
    createBuild,
    deleteBuild,
    setActiveBuild,
    renameBuild,
    duplicateBuild,
    toggleSidebar,
  } = useBuildStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleStartRename = (id: string, currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingId(id)
    setEditName(currentName)
  }

  const handleSaveRename = () => {
    if (editingId && editName.trim()) {
      renameBuild(editingId, editName.trim())
    }
    setEditingId(null)
  }

  const handleCancelRename = () => {
    setEditingId(null)
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 md:hidden glass-strong rounded-lg p-2 border border-border"
      >
        <Wrench className="h-5 w-5 text-primary" />
      </button>

      <aside
        className={cn(
          "fixed left-0 top-0 h-full z-40 glass-strong border-r border-border transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:w-16 md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center glow-cyan">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-gradient-cyan text-lg">NeoBuild</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent transition-colors"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Build List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {sidebarOpen && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
              配置方案
            </p>
          )}
          {builds.map(build => (
            <div
              key={build.id}
              onClick={() => editingId !== build.id && setActiveBuild(build.id)}
              onDoubleClick={() => handleStartRename(build.id, build.name)}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200",
                build.id === activeBuildId
                  ? "bg-primary/10 border border-primary/30 glow-cyan"
                  : "hover:bg-accent border border-transparent"
              )}
            >
              {sidebarOpen ? (
                <>
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    build.id === activeBuildId ? "bg-primary" : "bg-muted-foreground/40"
                  )} />

                  {editingId === build.id ? (
                    <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename()
                          if (e.key === 'Escape') handleCancelRename()
                        }}
                        className="flex-1 h-6 bg-surface rounded px-2 text-sm text-foreground outline-none border border-primary/50 focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveRename}
                        className="p-0.5 rounded hover:bg-accent text-primary"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className={cn(
                        "text-sm truncate flex-1",
                        build.id === activeBuildId ? "text-primary font-medium" : "text-foreground"
                      )}>
                        {build.name}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={e => handleStartRename(build.id, build.name, e)}
                          className="p-1 rounded hover:bg-accent transition-colors"
                          title="重命名"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); duplicateBuild(build.id) }}
                          className="p-1 rounded hover:bg-accent transition-colors"
                          title="复制方案"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteBuild(build.id) }}
                          className="p-1 rounded hover:bg-destructive/20 transition-colors"
                          title="删除方案"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  build.id === activeBuildId ? "bg-primary glow-cyan" : "bg-muted-foreground/40"
                )} title={build.name} />
              )}
            </div>
          ))}
        </div>

        {/* Bottom section: user + new build */}
        <div className="border-t border-border">
          {/* User badge / Login */}
          {sidebarOpen ? (
            isLoggedIn ? (
              <UserBadge />
            ) : (
              <div className="p-3">
                <button
                  onClick={onLoginClick}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  <span>登录同步到云端</span>
                </button>
              </div>
            )
          ) : (
            !isLoggedIn && (
              <div className="p-2 flex justify-center">
                <button
                  onClick={onLoginClick}
                  className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                  title="登录"
                >
                  <LogIn className="h-4 w-4" />
                </button>
              </div>
            )
          )}

          {/* New build button */}
          <div className="p-3 pt-0">
            <Button
              variant="glass"
              className={cn("w-full", !sidebarOpen && "px-0 justify-center")}
              onClick={() => createBuild()}
            >
              <Plus className="h-4 w-4" />
              {sidebarOpen && <span className="ml-2">新建方案</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  )
}
