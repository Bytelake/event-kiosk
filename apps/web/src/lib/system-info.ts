export interface SystemSpecs {
  hostname: string;
  platform: string;
  arch: string;
  osName: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryBytes: number;
  nodeVersion: string;
}

export interface DiskMetrics {
  path: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export interface TemperatureReading {
  label: string;
  celsius: number;
}

export interface GpuMetrics {
  vendor: "intel";
  name: string;
  usagePercent: number;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  temperatureCelsius: number | null;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  loadAverage: [number, number, number];
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  memoryUsagePercent: number;
  disk: DiskMetrics | null;
  gpus: GpuMetrics[];
  temperatures: TemperatureReading[];
  uptimeSeconds: number;
  processMemoryBytes: number;
  sampledAt: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const digits = value >= 100 || exponent === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[exponent]}`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function usageTone(percent: number): "default" | "warning" | "danger" {
  if (percent >= 90) {
    return "danger";
  }
  if (percent >= 75) {
    return "warning";
  }
  return "default";
}

export function formatGpuLabel(_gpu: GpuMetrics): string {
  return "GPU (Intel)";
}

export function formatGpuDetail(gpu: GpuMetrics): string {
  const parts = [gpu.name];
  if (gpu.temperatureCelsius !== null) {
    parts.push(`${gpu.temperatureCelsius.toFixed(0)}°C`);
  }
  return parts.join(" · ");
}
