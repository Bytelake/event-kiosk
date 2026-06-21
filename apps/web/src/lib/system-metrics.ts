import { readFile, readdir, statfs } from "fs/promises";
import os from "os";
import path from "path";
import { getDatabaseFilePath } from "@/lib/database-path";
import { readGpuMetrics } from "@/lib/gpu-metrics";
import type { DiskMetrics, SystemMetrics, SystemSpecs, TemperatureReading } from "@/lib/system-info";

export type { DiskMetrics, SystemMetrics, SystemSpecs, TemperatureReading };

let previousCpuSample: { idle: number; total: number } | null = null;

function sampleCpuUsagePercent(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }

  if (!previousCpuSample) {
    previousCpuSample = { idle, total };
    return 0;
  }

  const idleDelta = idle - previousCpuSample.idle;
  const totalDelta = total - previousCpuSample.total;
  previousCpuSample = { idle, total };

  if (totalDelta <= 0) {
    return 0;
  }

  const usage = (1 - idleDelta / totalDelta) * 100;
  return Math.min(100, Math.max(0, Math.round(usage * 10) / 10));
}

async function readOsName(): Promise<string> {
  if (process.platform === "linux") {
    try {
      const contents = await readFile("/etc/os-release", "utf8");
      const pretty = contents.match(/^PRETTY_NAME="(.+)"$/m)?.[1];
      if (pretty) {
        return pretty;
      }
    } catch {
      // fall through
    }
  }

  if (process.platform === "darwin") {
    return `macOS ${os.release()}`;
  }

  return `${os.type()} ${os.release()}`;
}

async function readDiskMetrics(targetPath: string): Promise<DiskMetrics | null> {
  try {
    const stats = await statfs(targetPath);
    const blockSize = stats.bsize;
    const totalBytes = stats.blocks * blockSize;
    const availableBytes = stats.bavail * blockSize;
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usagePercent =
      totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

    return {
      path: targetPath,
      totalBytes,
      usedBytes,
      availableBytes,
      usagePercent,
    };
  } catch {
    return null;
  }
}

async function readTemperatures(): Promise<TemperatureReading[]> {
  if (process.platform !== "linux") {
    return [];
  }

  const readings: TemperatureReading[] = [];

  try {
    const zones = await readdir("/sys/class/thermal");
    for (const zone of zones.filter((name) => name.startsWith("thermal_zone"))) {
      const base = path.join("/sys/class/thermal", zone);
      const [typeRaw, tempRaw] = await Promise.all([
        readFile(path.join(base, "type"), "utf8").catch(() => zone),
        readFile(path.join(base, "temp"), "utf8").catch(() => ""),
      ]);

      const millidegrees = parseInt(tempRaw.trim(), 10);
      if (!Number.isFinite(millidegrees)) {
        continue;
      }

      readings.push({
        label: typeRaw.trim() || zone,
        celsius: Math.round(millidegrees / 10) / 100,
      });
    }
  } catch {
    // optional sensors
  }

  return readings.slice(0, 8);
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: os.arch(),
    osName: await readOsName(),
    cpuModel: cpus[0]?.model.trim() || "Unknown CPU",
    cpuCores: cpus.length,
    totalMemoryBytes: os.totalmem(),
    nodeVersion: process.version,
  };
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const memoryTotalBytes = os.totalmem();
  const memoryFreeBytes = os.freemem();
  const memoryUsedBytes = memoryTotalBytes - memoryFreeBytes;
  const dataPath = path.dirname(getDatabaseFilePath());

  return {
    cpuUsagePercent: sampleCpuUsagePercent(),
    loadAverage: os.loadavg() as [number, number, number],
    memoryUsedBytes,
    memoryTotalBytes,
    memoryUsagePercent:
      memoryTotalBytes > 0
        ? Math.round((memoryUsedBytes / memoryTotalBytes) * 1000) / 10
        : 0,
    disk: await readDiskMetrics(dataPath),
    gpus: await readGpuMetrics(),
    temperatures: await readTemperatures(),
    uptimeSeconds: Math.floor(os.uptime()),
    processMemoryBytes: process.memoryUsage().rss,
    sampledAt: new Date().toISOString(),
  };
}
