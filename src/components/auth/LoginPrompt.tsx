import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Cloud, X, ArrowRight } from 'lucide-react'

interface LoginPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoginClick: () => void
}

export function LoginPrompt({ open, onOpenChange, onLoginClick }: LoginPromptProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onOpenChange(false)
  }

  const handleLogin = () => {
    onOpenChange(false)
    onLoginClick()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-cyan">
            <Cloud className="h-8 w-8 text-primary" />
          </div>

          <DialogHeader>
            <DialogTitle className="text-center">云端同步</DialogTitle>
            <DialogDescription className="text-center mt-2">
              登录账号，享受云端存储带来的便利
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2 text-left w-full">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Cloud className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">多设备同步</p>
                <p className="text-xs text-muted-foreground">手机、电脑随时随地查看</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🛡️</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">数据安全</p>
                <p className="text-xs text-muted-foreground">不怕丢失，云端自动备份</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🔄</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">自动迁移</p>
                <p className="text-xs text-muted-foreground">本地数据一键上传到云端</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full mt-5">
            <Button variant="cyan" className="w-full" onClick={handleLogin}>
              登录 / 注册
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleDismiss}>
              暂不登录，继续使用本地存储
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            不登录也可正常使用，数据保存在浏览器本地
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
