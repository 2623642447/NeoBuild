import { useBuildStore } from '@/lib/store'
import { signOut } from '@/lib/supabase'
import { Toast, useToast } from '@/components/ui/toast'
import { LogOut, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function UserBadge() {
  const { isLoggedIn, username, isCloudSyncing, setLoggedOut } = useBuildStore()
  const { toast, showToast } = useToast()

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
                {isCloudSyncing ? (
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
