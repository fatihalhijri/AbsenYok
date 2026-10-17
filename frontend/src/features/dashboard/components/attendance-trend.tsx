'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ErrorState } from '@/components/shared/error-state';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DATE_FORMAT, dayjs } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { dashboardApi, dashboardKeys } from '../api';
import { STATUS_CHART_CONFIG, STATUS_SERIES } from '../series';

const DAYS = 30;
const dayLabel = (date: string) => dayjs(date, DATE_FORMAT).format('D MMM');
const dayLong = (date: string) => dayjs(date, DATE_FORMAT).format('dddd, D MMMM YYYY');

/**
 * Tren kehadiran 30 hari: batang bertumpuk per hari (hitungan harian = besaran diskret).
 * Celah 2px warna permukaan antar segmen + legenda + tampilan tabel (aksesibilitas/CVD).
 */
export function AttendanceTrend() {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const trend = useQuery({
    queryKey: dashboardKeys.trend(DAYS),
    queryFn: () => dashboardApi.trend(DAYS),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren kehadiran {DAYS} hari</CardTitle>
        <CardDescription>Jumlah karyawan per status setiap hari kerja.</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => value && setView(value as 'chart' | 'table')}
            aria-label="Tampilan tren"
          >
            <ToggleGroupItem value="chart">Grafik</ToggleGroupItem>
            <ToggleGroupItem value="table">Tabel</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {trend.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : trend.isError ? (
          <ErrorState message={getErrorMessage(trend.error)} onRetry={() => void trend.refetch()} />
        ) : view === 'chart' ? (
          <>
            <ChartContainer config={STATUS_CHART_CONFIG} className="aspect-auto h-72 w-full">
              <BarChart
                data={trend.data}
                margin={{ left: -16, right: 8, top: 8 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={dayLabel}
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <ChartTooltip
                  cursor={{ className: 'fill-muted/60' }}
                  content={
                    <ChartTooltipContent labelFormatter={(value) => dayLong(String(value))} />
                  }
                />
                {STATUS_SERIES.map(({ key }, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="status"
                    fill={`var(--color-${key})`}
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={index === STATUS_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <ul
              className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs"
              aria-label="Keterangan warna"
            >
              {STATUS_SERIES.map(({ key, label, color }) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  {STATUS_SERIES.map(({ key, label }) => (
                    <TableHead key={key} className="text-right">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...trend.data].reverse().map((point) => (
                  <TableRow key={point.date}>
                    <TableCell className="whitespace-nowrap">{dayLong(point.date)}</TableCell>
                    {STATUS_SERIES.map(({ key }) => (
                      <TableCell key={key} className="text-right tabular-nums">
                        {point[key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
