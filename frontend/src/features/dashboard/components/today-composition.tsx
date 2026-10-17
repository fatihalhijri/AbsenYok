'use client';

import { useQuery } from '@tanstack/react-query';
import { Cell, Label, Pie, PieChart } from 'recharts';
import { ErrorState } from '@/components/shared/error-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/error';
import { dashboardApi, dashboardKeys } from '../api';
import { STATUS_CHART_CONFIG, STATUS_SERIES } from '../series';

const CONFIG = {
  ...STATUS_CHART_CONFIG,
  missing: { label: 'Belum absen', color: 'var(--muted)' },
};

/**
 * Komposisi status hari ini (donut). "Belum absen" digambar sebagai lintasan sisa yang redup
 * (bukan seri berwarna) — abu-abu tidak lolos syarat warna kategori.
 */
export function TodayComposition() {
  const summary = useQuery({ queryKey: dashboardKeys.summary(), queryFn: dashboardApi.summary });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Status hari ini</CardTitle>
        <CardDescription>Komposisi karyawan aktif hari ini.</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.isPending ? (
          <Skeleton className="mx-auto aspect-square w-full max-w-60 rounded-full" />
        ) : summary.isError ? (
          <ErrorState
            message={getErrorMessage(summary.error)}
            onRetry={() => void summary.refetch()}
          />
        ) : (
          (() => {
            const s = summary.data;
            const values: Record<string, number> = {
              present: s.present,
              leave: s.onLeave,
              late: s.late,
              absent: s.absent,
              missing: s.notYetCheckedIn,
            };
            const data = [...STATUS_SERIES.map(({ key }) => key), 'missing' as const]
              .map((key) => ({ key, value: values[key] ?? 0 }))
              .filter((item) => item.value > 0);
            const checkedIn = s.present + s.late;
            return (
              <div className="space-y-4">
                <ChartContainer config={CONFIG} className="mx-auto aspect-square max-h-60">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                    <Pie
                      data={data.length ? data : [{ key: 'missing', value: 1 }]}
                      dataKey="value"
                      nameKey="key"
                      innerRadius="62%"
                      outerRadius="92%"
                      paddingAngle={data.length > 1 ? 1.5 : 0}
                      stroke="var(--card)"
                      strokeWidth={2}
                      cornerRadius={4}
                      isAnimationActive={false}
                    >
                      {(data.length ? data : [{ key: 'missing' }]).map((item) => (
                        <Cell key={item.key} fill={`var(--color-${item.key})`} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (!viewBox || !('cx' in viewBox)) return null;
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                dy="-0.4em"
                                className="fill-foreground text-3xl font-semibold"
                              >
                                {checkedIn.toLocaleString('id-ID')}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                dy="1.6em"
                                className="fill-muted-foreground text-xs"
                              >
                                sudah absen
                              </tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* Legenda + angka (identitas tidak bergantung warna saja). */}
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {[
                    ...STATUS_SERIES,
                    { key: 'missing', label: 'Belum absen', color: 'var(--muted)' },
                  ].map(({ key, label, color }) => (
                    <li key={key} className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-sm ring-1 ring-border"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{values[key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
