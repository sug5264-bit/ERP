'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// 세련된 차트 색상 팔레트
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
const BLUE = '#6366f1'
const GREEN = '#22c55e'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const CYAN = '#06b6d4'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="animate-scale-in bg-background/95 rounded-lg border p-3 text-xs shadow-lg backdrop-blur-sm sm:text-sm">
      <p className="mb-1.5 font-semibold">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name || entry.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {typeof entry.value === 'number' && entry.value > 1000 ? formatCurrency(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="bg-muted mb-2 rounded-full p-3">
        <svg className="text-muted-foreground/50 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

interface DashboardChartsProps {
  salesSummary: any
  dashStats: any
}

export default function DashboardCharts({ salesSummary, dashStats }: DashboardChartsProps) {
  const monthlyData = (salesSummary?.data?.monthly || []).map((m: any) => ({
    month: m.month,
    online: m.online,
    offline: m.offline,
  }))

  const { deptData = [], stockData = [], leaveData: leaveStatData = [] } = dashStats?.data || {}

  return (
    <>
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="animate-fade-in-up">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">월별 매출 현황</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            {monthlyData.length === 0 ? (
              <ChartEmptyState message="매출 데이터가 없습니다" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v: string) => v.replace(/^\d{4}-/, '') + '월'}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v: number) =>
                      v >= 100000000
                        ? `${(v / 100000000).toFixed(1)}억`
                        : v >= 10000
                          ? `${(v / 10000).toFixed(0)}만`
                          : `${v}`
                    }
                    width={55}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="online" name="온라인" stackId="sales" fill={BLUE} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="offline" name="오프라인" stackId="sales" fill={GREEN} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">부서별 인원</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            {deptData.length === 0 ? (
              <ChartEmptyState message="부서 데이터가 없습니다" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={40}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, value }: any) => `${name} (${value})`}
                    labelLine={{ strokeWidth: 1 }}
                    fontSize={10}
                    strokeWidth={2}
                    stroke="var(--background)"
                  >
                    {deptData.map((d: any, idx: number) => (
                      <Cell key={d.name || `dept-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card className="animate-fade-in-up">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">재고 상위 품목</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            {stockData.length === 0 ? (
              <ChartEmptyState message="재고 데이터가 없습니다" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stockData} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                    width={80}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="quantity" name="수량" fill={PURPLE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">올해 휴가 유형별 현황</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 sm:p-6 sm:pt-0">
            {leaveStatData.length === 0 ? (
              <ChartEmptyState message="휴가 데이터가 없습니다" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={leaveStatData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    width={40}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="건수" fill={AMBER} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="days" name="일수" fill={CYAN} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
