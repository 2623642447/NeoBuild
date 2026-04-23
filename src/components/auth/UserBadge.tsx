import { useState } from 'react'
import { useBuildStore } from '@/lib/store'
import { signOut } from '@/lib/supabase'
import { Toast, useToast } from '@/components/ui/toast'
import { LogOut, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react'

export function UserBadge() {
  const { isLoggedIn, username, isCloudSyncing, setLoggedOut, syncLocalToCloud, syncCloudToLocal } = useBuildStore()
  const { toast, showToast } = useToast()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleManualSync = async () => {
    if (isSyncing || isCloudSyncing) return
    setIsSyncing(true)
    try {
      // Step 1: Upload local changes to cloud
      await syncLocalToCloud()
      // Step 2: Pull cloud data
      await syncCloudToLocal()
      showToast('云端同步成功', 'success')
    } catch (e: any) {
      showToast(e?.message || '同步失败，请稍后重试', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setLoggedOut()
      showToast('已退出登录', 'info')
    } catch {
      showToast('退出失败', 'error')
    }
  }

  if (isLoggedIn) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Cloud className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{username}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                {isSyncing || isCloudSyncing ? (
                  <>
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    同步中
                  </>
                ) : (
                  '已同步'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleManualSync}
            disabled={isSyncing || isCloudSyncing}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="同步云端"
          >
            {isSyncing || isCloudSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="退出登录"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <Toast {...toast} />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">未登录 · 本地存储</p>
        </div>
      </div>
      <Toast {...toast} />
    </>
  )
}
