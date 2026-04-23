import { useState } from 'react'
import { useBuildStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddItemDialog } from './AddItemDialog'
import { formatPrice } from '@/lib/utils'
import type { ComponentCategory, ComponentItem } from '@/lib/types'
import {
  Cpu,
  CircuitBoard,
  MemoryStick,
  HardDrive,
  Zap,
  Fan,
  Box,
  Wind,
  MonitorSmartphone,
  Package,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ExternalLink,
  GripVertical,
  Tag,
} from 'lucide-react'
import { GpuIcon } from '@/components/ui/gpu-icon'

const ICON_MAP: Record<string, React.ElementType> = {
  Cpu, Gpu: GpuIcon, Monitor: GpuIcon, CircuitBoard, MemoryStick, HardDrive, Zap, Fan, Box, Wind, MonitorSmartphone, Package,
}

interface CategoryCardProps {
  category: ComponentCategory
  buildId: string
}

function ComponentItemRow({
  item,
  buildId,
  categoryId,
}: {
  item: ComponentItem
  buildId: string
  categoryId: string
}) {
  const { updateItem, removeItem } = useBuildStore()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(item.name)
  const [editPrice, setEditPrice] = useState(String(item.price))

  const handleSave = () => {
    const priceNum = parseFloat(editPrice)
    if (!editName.trim() || isNaN(priceNum)) return
    updateItem(buildId, categoryId, item.id, {
      name: editName.trim(),
      price: priceNum,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setEditName(item.name)
    setEditPrice(String(item.price))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-surface/50 rounded-lg animate-fade-in">
        <Input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          className="flex-1 h-8 text-sm"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <Input
          type="number"
          value={editPrice}
          onChange={e => setEditPrice(e.target.value)}
          className="w-24 h-8 text-sm font-price"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <button onClick={handleSave} className="p-1 rounded hover:bg-accent text-primary">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={handleCancel} className="p-1 rounded hover:bg-accent text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface/50 transition-all duration-200">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
          {item.platform && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
              {item.platform}
            </span>
          )}
        </div>
        {item.note && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.note}</p>
        )}
      </div>

      <span className="font-price text-sm font-semibold text-orange-400 flex-shrink-0">
        {formatPrice(item.price)}
      </span>

      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
            title="打开链接"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
          title="编辑"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => removeItem(buildId, categoryId, item.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function CategoryCard({ category, buildId }: CategoryCardProps) {
  const { removeCategory, getCategoryTotal } = useBuildStore()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(category.name)
  const { renameCategory } = useBuildStore()

  const Icon = ICON_MAP[category.icon] || Package
  const total = getCategoryTotal(buildId, category.id)
  const hasItems = category.items.length > 0

  const handleRename = () => {
    if (newName.trim() && newName !== category.name) {
      renameCategory(buildId, category.id, newName.trim())
    }
    setIsRenaming(false)
  }

  return (
    <>
      <Card className="group/card hover:border-primary/20 transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover/card:glow-cyan transition-all duration-300">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              {isRenaming ? (
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename()
                    if (e.key === 'Escape') { setIsRenaming(false); setNewName(category.name) }
                  }}
                  className="h-7 w-32 text-sm"
                  autoFocus
                />
              ) : (
                <CardTitle
                  className="text-base cursor-pointer hover:text-primary transition-colors"
                  onDoubleClick={() => category.isCustom && setIsRenaming(true)}
                >
                  {category.name}
                </CardTitle>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasItems && (
                <span className="font-price text-sm font-semibold text-orange-400">
                  {formatPrice(total)}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowAddDialog(true)}
                className="opacity-0 group-hover/card:opacity-100 transition-opacity"
              >
                <Plus className="h-4 w-4" />
              </Button>
              {category.isCustom && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeCategory(buildId, category.id)}
                  className="opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {hasItems ? (
            <div className="space-y-1">
              {category.items.map(item => (
                <ComponentItemRow
                  key={item.id}
                  item={item}
                  buildId={buildId}
                  categoryId={category.id}
                />
              ))}
            </div>
          ) : (
            <button
              onClick={() => setShowAddDialog(true)}
              className="w-full py-4 rounded-lg border-2 border-dashed border-border hover:border-primary/30 hover:bg-primary/5 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">添加配件</span>
            </button>
          )}
        </CardContent>
      </Card>

      <AddItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        categoryId={category.id}
        buildId={buildId}
      />
    </>
  )
}
