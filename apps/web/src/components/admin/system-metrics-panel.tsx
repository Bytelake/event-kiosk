"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatBytes,
  formatGpuDetail,
  formatGpuLabel,
  formatUptime,
  usageTone,
  type SystemMetrics,
} from "@/lib/system-info";

function MetricCard({
  label,
  value,
  detail,
  percent,
}: {
  label: string;
  value: string;
  detail: string;
  percent?: number;
}) {
  const tone = percent !== undefined ? usageTone(percent) : "default";
  const valueColor =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-900 dark:text-slate-100";

  return (
    <Card>
      <CardContent>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${valueColor}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function SystemMetricsPanel() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/system/metrics");
      if (!res.ok || cancelled) {
        return;
      }
      setMetrics(await res.json());
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const primaryGpu = metrics?.gpus[0];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          System
        </h2>
        <Link href="/admin/settings" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          Full details
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="CPU"
          value={metrics ? `${metrics.cpuUsagePercent}%` : "—"}
          detail={metrics ? `Load ${metrics.loadAverage[0].toFixed(2)} (1 min)` : "Sampling..."}
          percent={metrics?.cpuUsagePercent}
        />
        <MetricCard
          label="Memory"
          value={metrics ? `${metrics.memoryUsagePercent}%` : "—"}
          detail={
            metrics
              ? `${formatBytes(metrics.memoryUsedBytes)} of ${formatBytes(metrics.memoryTotalBytes)}`
              : "Sampling..."
          }
          percent={metrics?.memoryUsagePercent}
        />
        <MetricCard
          label="Disk"
          value={metrics?.disk ? `${metrics.disk.usagePercent}%` : "—"}
          detail={
            metrics?.disk
              ? `${formatBytes(metrics.disk.availableBytes)} free`
              : "Data volume unavailable"
          }
          percent={metrics?.disk?.usagePercent}
        />
        {primaryGpu && (
          <MetricCard
            label={formatGpuLabel(primaryGpu)}
            value={`${primaryGpu.usagePercent}%`}
            detail={formatGpuDetail(primaryGpu)}
            percent={primaryGpu.usagePercent}
          />
        )}
        <MetricCard
          label="Uptime"
          value={metrics ? formatUptime(metrics.uptimeSeconds) : "—"}
          detail={metrics ? `Web process ${formatBytes(metrics.processMemoryBytes)}` : "Sampling..."}
        />
      </div>
    </div>
  );
}
