import { useState } from 'react'
import { useBuildStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Package } from 'lucide-react'

interface AddCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buildId: string
}

export function AddCategoryDialog({ open, onOpenChange, buildId }: AddCategoryDialogProps) {
  const { addCustomCategory } = useBuildStore()
  const [name, setName] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) return
    addCustomCategory(buildId, name.trim())
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加自定义分类</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <Input
              placeholder="分类名称（如：灯板、手办、屏幕）"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button variant="cyan" onClick={handleSubmit} disabled={!name.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
