import { useBuildStore } from '@/lib/store'
import { formatPrice } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, PiggyBank, ShoppingCart } from 'lucide-react'

const COLORS = [
  'hsl(210, 70%, 55%)',
  'hsl(25, 95%, 53%)',
  'hsl(200, 60%, 58%)',
  'hsl(215, 50%, 50%)',
  'hsl(30, 85%, 55%)',
  'hsl(195, 65%, 50%)',
  'hsl(220, 40%, 55%)',
  'hsl(35, 80%, 50%)',
  'hsl(205, 55%, 52%)',
  'hsl(15, 75%, 55%)',
]

interface StatsPanelProps {
  buildId: string
}

export function StatsPanel({ buildId }: StatsPanelProps) {
  const { builds } = useBuildStore()
  const build = builds.find(b => b.id === buildId)

  if (!build) return null

  const total = build.categories.reduce(
    (sum, cat) => sum + cat.items.reduce((s, item) => s + item.price, 0),
    0
  )

  const filledCategories = build.categories.filter(c => c.items.length > 0)
  const totalItems = build.categories.reduce((sum, cat) => sum + cat.items.length, 0)

  const chartData = build.categories
    .filter(c => c.items.length > 0)
    .map(c => ({
      name: c.name,
      value: c.items.reduce((s, item) => s + item.price, 0),
    }))
    .sort((a, b) => b.value - a.value)

  const mostExpensive = chartData[0]

  return (
    <div className="space-y-4">
      {/* Total Price Card */}
      <Card className="border-primary/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-ice-500 via-primary to-orange-500" />
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-cyan">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">总价格</p>
              <p className="font-price text-2xl font-bold text-gradient-cyan">
                {formatPrice(total)}
              </p>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {filledCategories.length} 个分类
            </span>
            <span className="flex items-center gap-1">
              <PiggyBank className="h-3 w-3" />
              {totalItems} 件配件
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">价格占比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 15%, 90%)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      color: 'hsl(220, 20%, 14%)',
                    }}
                    formatter={(value: number) => [formatPrice(value), '价格']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="space-y-1.5 mt-2">
              {chartData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-price text-foreground">{formatPrice(item.value)}</span>
                    <span className="text-muted-foreground w-10 text-right">
                      {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most expensive */}
      {mostExpensive && (
        <Card className="border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">最贵分类</p>
                <p className="text-sm font-medium">
                  {mostExpensive.name}
                  <span className="font-price text-orange-400 ml-2">
                    {formatPrice(mostExpensive.value)}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
