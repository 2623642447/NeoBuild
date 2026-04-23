/** GPU 显卡图标 — 双风扇 + PCB 板 + 挡板接口造型，优化小尺寸显示 */
export function GpuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 挡板 I/O 接口 */}
      <rect x="1" y="8" width="2" height="8" rx="0.5" />
      <circle cx="2" cy="10" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="2" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="2" cy="14" r="0.5" fill="currentColor" stroke="none" />
      {/* PCB 板 */}
      <rect x="3" y="6" width="19" height="12" rx="1" />
      {/* 风扇 1 - 十字叶片 */}
      <circle cx="9" cy="12" r="3.5" />
      <line x1="9" y1="8.5" x2="9" y2="15.5" />
      <line x1="5.5" y1="12" x2="12.5" y2="12" />
      {/* 风扇 2 - 十字叶片 */}
      <circle cx="16" cy="12" r="3.5" />
      <line x1="16" y1="8.5" x2="16" y2="15.5" />
      <line x1="12.5" y1="12" x2="19.5" y2="12" />
    </svg>
  )
}
