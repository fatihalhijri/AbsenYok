'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DepartmentRate } from '../aggregate';

/** Satu seri (persentase kehadiran) → satu warna, tanpa legenda; judul kartu menamai seri. */
const CONFIG = {
  attendanceRate: { label: 'Kehadiran', color: 'var(--chart-present)' },
} satisfies ChartConfig;

/** Label nilai di ujung batang hanya bila batang sedikit (selebihnya lewat tooltip/tabel). */
const MAX_LABELED_BARS = 12;

const percent = (value: number) =>
  `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

/** Grafik batang horizontal persentase kehadiran per departemen (+ tampilan tabel). */
export function DepartmentRateChart({ data }: { data: DepartmentRate[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const height = Math.max(120, data.length * 40 + 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kehadiran per departemen</CardTitle>
        <CardDescription>
          (Hadir + terlambat) ÷ hari kerja, gabungan seluruh karyawan.
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(value) => value && setView(value as 'chart' | 'table')}
            aria-label="Tampilan kehadiran per departemen"
          >
            <ToggleGroupItem value="chart">Grafik</ToggleGroupItem>
            <ToggleGroupItem value="table">Tabel</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {view === 'chart' ? (
          <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height }}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
              barCategoryGap={8}
              accessibilityLayer
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                className="stroke-border/60"
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="department"
                width={168}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) =>
                  value.length > 24 ? `${value.slice(0, 23)}…` : value
                }
              />
              <ChartTooltip
                cursor={{ className: 'fill-muted/60' }}
                content={
                  <ChartTooltipContent
                    hideIndicator={false}
                    formatter={(value, _name, item) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          Kehadiran · {(item.payload as DepartmentRate).employees} karyawan
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {percent(Number(value))}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="attendanceRate"
                fill="var(--color-attendanceRate)"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              >
                {data.length <= MAX_LABELED_BARS ? (
                  <LabelList
                    dataKey="attendanceRate"
                    position="right"
                    formatter={(value: unknown) => percent(Number(value))}
                    className="fill-foreground text-xs tabular-nums"
                  />
                ) : null}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Departemen</TableHead>
                  <TableHead className="text-right">Karyawan</TableHead>
                  <TableHead className="text-right">Hadir + terlambat</TableHead>
                  <TableHead className="text-right">Hari kerja</TableHead>
                  <TableHead className="text-right">Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.department}>
                    <TableCell>{row.department}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.employees}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.present + row.late}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.workingDays}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {percent(row.attendanceRate)}
                    </TableCell>
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
