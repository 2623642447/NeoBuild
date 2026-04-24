import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { getHardwareList } from '@/lib/game-perf-api'
import { Cpu, Search, Check } from 'lucide-react'
import { GpuIcon } from '@/components/ui/gpu-icon'

interface HardwarePickerDialogProps {
  type: 'cpu' | 'gpu'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (name: string) => void
  currentName?: string | null
}

export function HardwarePickerDialog({
  type,
  open,
  onOpenChange,
  onSelect,
  currentName,
}: HardwarePickerDialogProps) {
  const [search, setSearch] = useState('')

  const hardwareList = useMemo(() => getHardwareList(type), [type])

  const filtered = useMemo(() => {
    if (!search.trim()) return hardwareList
    const q = search.toLowerCase()
    return hardwareList.filter(h => h.name.toLowerCase().includes(q))
  }, [hardwareList, search])

  const Icon = type === 'cpu' ? Cpu : GpuIcon
  const label = type === 'cpu' ? 'CPU' : '显卡'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            选择{label}
          </DialogTitle>
          <DialogDescription>
            从数据库中选择{label}型号，手动选择后将显示"手动选择"标识
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`搜索${label}型号...`}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
            autoFocus
          />
        </div>

        {/* Hardware list */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-0.5 min-h-0">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              未找到匹配的{label}型号
            </div>
          ) : (
            filtered.map(hw => {
              const isSelected = currentName === hw.name
              return (
                <button
                  key={hw.name}
                  onClick={() => {
                    onSelect(hw.name)
                    onOpenChange(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                    isSelected
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'hover:bg-accent text-foreground border border-transparent'
                  }`}
                >
                  <span className="text-sm font-medium truncate">{hw.name}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 ml-2" />}
                </button>
              )
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="pt-2 text-[10px] text-muted-foreground/60 text-center">
          共 {filtered.length} / {hardwareList.length} 款{label}
        </div>
      </DialogContent>
    </Dialog>
  )
}
