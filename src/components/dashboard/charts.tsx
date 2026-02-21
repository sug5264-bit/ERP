'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm text-xs sm:text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' && entry.value > 1000 ? formatCurrency(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

interface DashboardChartsProps {
  salesSummary: any
  dashStats: any
}

export default function DashboardCharts({ salesSummary, dashStats }: DashboardChartsProps) {
  const monthlyData = (salesSummary?.data?.monthly || []).map((m: any) => ({
    month: m.month, online: m.online, offline: m.offline,
  }))

  const { deptData = [], stockData = [], leaveData: leaveStatData = [] } = dashStats?.data || {}

  return (
    <>
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">월별 매출 현황</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">매출 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.replace(/^\d{4}-/, '') + '월'} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 100000000 ? `${(v/100000000).toFixed(1)}억` : v >= 10000 ? `${(v/10000).toFixed(0)}만` : `${v}`} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="online" name="온라인" stackId="sales" fill="#3b82f6" />
                  <Bar dataKey="offline" name="오프라인" stackId="sales" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">부서별 인원</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {deptData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">부서 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, value }: any) => `${name} (${value})`}
                    labelLine={{ strokeWidth: 1 }}
                    fontSize={10}
                  >
                    {deptData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">재고 상위 품목</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {stockData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">재고 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stockData} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="quantity" name="수량" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-6"><CardTitle className="text-sm sm:text-base">올해 휴가 유형별 현황</CardTitle></CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            {leaveStatData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">휴가 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={leaveStatData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" name="건수" fill="#f59e0b" />
                  <Bar dataKey="days" name="일수" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
