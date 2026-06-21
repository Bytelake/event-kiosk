"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  formatBytes,
  formatGpuDetail,
  formatGpuLabel,
  formatUptime,
  usageTone,
  type SystemMetrics,
} from "@/lib/system-info";

interface ReleaseInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  checkedAt: string;
  error: string | null;
}

interface SystemSpecs {
  hostname: string;
  platform: string;
  arch: string;
  osName: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  nodeVersion: string;
}

function UsageBar({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail: string;
}) {
  const tone = usageTone(percent);
  const barColor =
    tone === "danger"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">{detail}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}

export function SystemAboutSection() {
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [checkingRelease, setCheckingRelease] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadAbout = useCallback(async (refreshRelease = false) => {
    const url = refreshRelease ? "/api/system/about?refresh=1" : "/api/system/about";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Failed to load system information");
    }
    const data = await res.json();
    setSpecs(data.specs);
    setRelease(data.release);
  }, []);

  const loadMetrics = useCallback(async () => {
    const res = await fetch("/api/system/metrics");
    if (!res.ok) {
      return;
    }
    setMetrics(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadAbout();
        await loadMetrics();
        setLoadError("");
      } catch {
        if (!cancelled) {
          setLoadError("Could not load system information.");
        }
      }
    }

    void init();
    const interval = setInterval(() => {
      void loadMetrics();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadAbout, loadMetrics]);

  async function handleCheckForUpdates() {
    setCheckingRelease(true);
    try {
      await loadAbout(true);
    } catch {
      setLoadError("Could not check for updates.");
    } finally {
      setCheckingRelease(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">About</h2>
          {release && (
            <Badge variant={release.updateAvailable ? "warning" : "success"}>
              {release.updateAvailable ? "Update available" : "Up to date"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Installed version
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {release?.currentVersion ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Latest release
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {release?.latestVersion ?? (release?.error ? "Unavailable" : "—")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleCheckForUpdates} disabled={checkingRelease}>
            {checkingRelease ? "Checking..." : "Check for updates"}
          </Button>
          {release?.updateAvailable && release.releaseUrl && (
            <a
              href={release.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View release on GitHub
            </a>
          )}
        </div>

        {release?.error && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{release.error}</p>
        )}

        {release?.checkedAt && !release.error && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Last checked {new Date(release.checkedAt).toLocaleString()}
            {release.publishedAt ? ` · Latest published ${new Date(release.publishedAt).toLocaleDateString()}` : ""}
          </p>
        )}

        {specs && (
          <div className="grid gap-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700 sm:grid-cols-2">
            {[
              ["Hostname", specs.hostname],
              ["Operating system", specs.osName],
              ["Platform", `${specs.platform} (${specs.arch})`],
              ["CPU", specs.cpuModel],
              ["CPU cores", String(specs.cpuCores)],
              ["Memory", formatBytes(specs.totalMemoryBytes)],
              ["Node.js", specs.nodeVersion],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{value}</p>
              </div>
            ))}
          </div>
        )}

        {metrics && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Live usage</h3>
            <UsageBar
              label="CPU"
              percent={metrics.cpuUsagePercent}
              detail={`${metrics.cpuUsagePercent}% · load ${metrics.loadAverage[0].toFixed(2)}`}
            />
            <UsageBar
              label="Memory"
              percent={metrics.memoryUsagePercent}
              detail={`${formatBytes(metrics.memoryUsedBytes)} / ${formatBytes(metrics.memoryTotalBytes)}`}
            />
            {metrics.disk && (
              <UsageBar
                label="Disk (data volume)"
                percent={metrics.disk.usagePercent}
                detail={`${formatBytes(metrics.disk.usedBytes)} / ${formatBytes(metrics.disk.totalBytes)}`}
              />
            )}
            {metrics.gpus.map((gpu) => (
              <UsageBar
                key={`${gpu.vendor}-${gpu.name}`}
                label={formatGpuLabel(gpu)}
                percent={gpu.usagePercent}
                detail={`${gpu.usagePercent}% · ${formatGpuDetail(gpu)}`}
              />
            ))}
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">System uptime</p>
                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {formatUptime(metrics.uptimeSeconds)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Kiosk web process</p>
                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {formatBytes(metrics.processMemoryBytes)} RSS
                </p>
              </div>
            </div>
            {metrics.temperatures.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Temperatures
                </p>
                <div className="flex flex-wrap gap-2">
                  {metrics.temperatures.map((reading) => (
                    <span
                      key={`${reading.label}-${reading.celsius}`}
                      className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {reading.label}: {reading.celsius.toFixed(1)}°C
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
