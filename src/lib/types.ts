export interface ComponentItem {
  id: string
  name: string
  price: number
  link?: string
  platform?: string
  imageUrl?: string
  note?: string
}

export interface ComponentCategory {
  id: string
  name: string
  icon: string
  items: ComponentItem[]
  isCustom?: boolean
}

export interface BuildConfig {
  id: string
  name: string
  categories: ComponentCategory[]
  createdAt: number
  updatedAt: number
}

// Default category definitions (id will be generated as UUID at build creation time)
export const DEFAULT_CATEGORY_DEFS: { name: string; icon: string }[] = [
  { name: 'CPU', icon: 'Cpu' },
  { name: '显卡', icon: 'Monitor' },
  { name: '主板', icon: 'CircuitBoard' },
  { name: '内存', icon: 'MemoryStick' },
  { name: '硬盘', icon: 'HardDrive' },
  { name: '电源', icon: 'Zap' },
  { name: '散热器', icon: 'Fan' },
  { name: '机箱', icon: 'Box' },
  { name: '风扇', icon: 'Wind' },
  { name: '显示器', icon: 'MonitorSmartphone' },
]
