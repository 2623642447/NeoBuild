import { useState } from 'react'
import { signUp, signIn } from '@/lib/supabase'
import { useBuildStore } from '@/lib/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toast, useToast } from '@/components/ui/toast'
import { User, Lock, Loader2, ArrowRight } from 'lucide-react'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: 'login' | 'register'
  onAuthSuccess?: () => void
}

export function AuthDialog({ open, onOpenChange, initialMode = 'login', onAuthSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setLoggedIn } = useBuildStore()
  const { toast, showToast } = useToast()

  const resetForm = () => {
    setUsername('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      showToast('请填写用户名和密码', 'error')
      return
    }

    if (username.trim().length < 2) {
      showToast('用户名至少2个字符', 'error')
      return
    }

    if (password.length < 6) {
      showToast('密码至少6位', 'error')
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error')
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await signUp(username.trim(), password)
        showToast('注册成功！', 'success')
      } else {
        await signIn(username.trim(), password)
        showToast('登录成功！', 'success')
      }

      setLoggedIn(username.trim())
      resetForm()
      onOpenChange(false)

      // Trigger sync after successful auth
      onAuthSuccess?.()
    } catch (err: any) {
      console.error('Auth error:', err)
      const msg = err?.message || '操作失败'
      if (msg.includes('already registered') || msg.includes('already exists')) {
        showToast('该用户名已被注册', 'error')
      } else if (msg.includes('Invalid login') || msg.includes('invalid')) {
        showToast('用户名或密码错误', 'error')
      } else {
        showToast(msg, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    resetForm()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              {mode === 'login' ? '登录账号' : '注册账号'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'login'
                ? '登录后配置单将同步到云端，多设备查看不怕丢失'
                : '创建账号，云端保存你的装机配置'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="输入用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="pl-10"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="至少6位密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  确认密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <Button
              variant="cyan"
              className="w-full"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {mode === 'login' ? '登录' : '注册'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-2 border-t border-border mt-2">
            {mode === 'login' ? (
              <>
                还没有账号？
                <button
                  onClick={switchMode}
                  className="text-primary hover:underline ml-1 font-medium"
                >
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账号？
                <button
                  onClick={switchMode}
                  className="text-primary hover:underline ml-1 font-medium"
                >
                  去登录
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Toast {...toast} />
    </>
  )
}
