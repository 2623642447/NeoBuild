import * as React from "react"
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  visible: boolean
}

export function Toast({ message, type = 'info', visible }: ToastProps) {
  if (!visible) return null

  const bgColor = {
    success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    error: 'bg-red-500/20 border-red-500/50 text-red-300',
    info: 'bg-ice-500/20 border-ice-500/50 text-ice-300',
  }[type]

  return (
    <div className={cn(
      "fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg border backdrop-blur-md animate-fade-in",
      bgColor
    )}>
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false,
  })

  const showToast = React.useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500)
  }, [])

  return { toast, showToast }
}
