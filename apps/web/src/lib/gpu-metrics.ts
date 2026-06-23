import { execFile } from "child_process";
import { access, readFile, readdir } from "fs/promises";
import path from "path";
import { promisify } from "util";
import type { GpuMetrics } from "@/lib/system-info";

const execFileAsync = promisify(execFile);

const INTEL_VENDOR = "0x8086";
const DISPLAY_PCI_CLASS_PREFIX = "0x03";
const MIN_INTEL_SAMPLE_MS = 1000;
const INTEL_GPU_TOP_CACHE_MS = 2500;

const INTEL_RENDER_FDINFO_KEY = "drm-engine-render";

interface IntelUsageSample {
  at: number;
  renderNs: number;
  clients: Map<number, number>;
}

const intelUsageSamples = new Map<string, IntelUsageSample>();
const intelUsageCache = new Map<string, number>();
const intelGpuTopCache = new Map<string, { at: number; usage: number }>();

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readTrimmed(filePath: string): Promise<string | null> {
  try {
    return (await readFile(filePath, "utf8")).trim();
  } catch {
    return null;
  }
}

function clampUsagePercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function usageFromDelta(deltaNs: number, elapsedMs: number): number | null {
  if (elapsedMs < MIN_INTEL_SAMPLE_MS || deltaNs < 0) {
    return null;
  }
  return clampUsagePercent((deltaNs / 1_000_000 / elapsedMs) * 100);
}

function cachedIntelUsage(sampleKey: string): number | null {
  const cached = intelUsageCache.get(sampleKey);
  return cached === undefined ? null : cached;
}

function storeIntelUsage(sampleKey: string, usage: number): number {
  intelUsageCache.set(sampleKey, usage);
  return usage;
}

async function readIntelGpuTemperature(deviceDir: string): Promise<number | null> {
  const hwmonDir = path.join(deviceDir, "hwmon");
  try {
    const entries = await readdir(hwmonDir);
    for (const entry of entries) {
      const base = path.join(hwmonDir, entry);
      const tempRaw = await readTrimmed(path.join(base, "temp1_input"));
      if (!tempRaw) {
        continue;
      }
      const millidegrees = parseInt(tempRaw, 10);
      if (Number.isFinite(millidegrees)) {
        return Math.round(millidegrees / 10) / 100;
      }
    }
  } catch {
    // optional sensor
  }
  return null;
}

async function sumIntelClientRenderBusy(cardPath: string): Promise<number | null> {
  const clientsDir = path.join(cardPath, "clients");
  if (!(await pathExists(clientsDir))) {
    return null;
  }

  let total = 0;
  let found = false;

  try {
    const clients = await readdir(clientsDir);
    for (const client of clients) {
      if (!/^\d+$/.test(client)) {
        continue;
      }
      const renderBusy = await readTrimmed(path.join(clientsDir, client, "busy", "0"));
      if (!renderBusy) {
        continue;
      }
      const ns = parseInt(renderBusy, 10);
      if (!Number.isFinite(ns)) {
        continue;
      }
      found = true;
      total += ns;
    }
  } catch {
    return null;
  }

  return found ? total : null;
}

async function readIntelFdinfoRenderByClient(): Promise<Map<number, number> | null> {
  const clients = new Map<number, number>();
  let found = false;

  let procEntries: string[];
  try {
    procEntries = await readdir("/proc");
  } catch {
    return null;
  }

  for (const pid of procEntries) {
    if (!/^\d+$/.test(pid)) {
      continue;
    }

    const fdinfoDir = path.join("/proc", pid, "fdinfo");
    let fdEntries: string[];
    try {
      fdEntries = await readdir(fdinfoDir);
    } catch {
      continue;
    }

    for (const fd of fdEntries) {
      let content: string;
      try {
        content = await readFile(path.join(fdinfoDir, fd), "utf8");
      } catch {
        continue;
      }

      if (!content.includes("drm-driver:") || !content.includes("i915")) {
        continue;
      }

      const clientMatch = content.match(/^drm-client-id:\s*(\d+)/m);
      if (!clientMatch) {
        continue;
      }

      const clientId = parseInt(clientMatch[1], 10);
      if (!Number.isFinite(clientId)) {
        continue;
      }

      let renderNs: number | null = null;
      for (const line of content.split("\n")) {
        if (!line.startsWith(`${INTEL_RENDER_FDINFO_KEY}:`)) {
          continue;
        }
        const raw = line.slice(INTEL_RENDER_FDINFO_KEY.length + 1).trim().replace(/\s*ns$/, "");
        const ns = parseInt(raw, 10);
        if (Number.isFinite(ns)) {
          renderNs = ns;
          break;
        }
      }

      if (renderNs === null) {
        continue;
      }

      found = true;
      const existing = clients.get(clientId);
      clients.set(clientId, existing === undefined ? renderNs : Math.max(existing, renderNs));
    }
  }

  return found ? clients : null;
}

function sampleIntelClientRenderUsage(sampleKey: string, renderNs: number | null): number | null {
  if (renderNs === null) {
    return null;
  }

  const now = Date.now();
  const previous = intelUsageSamples.get(sampleKey);

  intelUsageSamples.set(sampleKey, {
    at: now,
    renderNs,
    clients: previous?.clients ?? new Map(),
  });

  if (!previous) {
    return null;
  }

  const elapsedMs = now - previous.at;
  if (elapsedMs < MIN_INTEL_SAMPLE_MS) {
    return cachedIntelUsage(sampleKey);
  }

  const usage = usageFromDelta(renderNs - previous.renderNs, elapsedMs);
  return usage === null ? cachedIntelUsage(sampleKey) : storeIntelUsage(sampleKey, usage);
}

function sampleIntelFdinfoUsage(sampleKey: string, clients: Map<number, number> | null): number | null {
  if (!clients) {
    return null;
  }

  const now = Date.now();
  const previous = intelUsageSamples.get(sampleKey);

  intelUsageSamples.set(sampleKey, {
    at: now,
    renderNs: previous?.renderNs ?? 0,
    clients: new Map(clients),
  });

  if (!previous) {
    return null;
  }

  const elapsedMs = now - previous.at;
  if (elapsedMs < MIN_INTEL_SAMPLE_MS) {
    return cachedIntelUsage(sampleKey);
  }

  let totalUsage = 0;
  let hasUsage = false;

  for (const [clientId, renderNs] of clients) {
    const previousRenderNs = previous.clients.get(clientId);
    if (previousRenderNs === undefined) {
      continue;
    }
    const usage = usageFromDelta(renderNs - previousRenderNs, elapsedMs);
    if (usage !== null) {
      hasUsage = true;
      totalUsage += usage;
    }
  }

  if (!hasUsage) {
    return cachedIntelUsage(sampleKey);
  }

  return storeIntelUsage(sampleKey, clampUsagePercent(Math.min(100, totalUsage)));
}

function parseIntelGpuTopUsage(stdout: string): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return null;
  }

  const samples = Array.isArray(parsed) ? parsed : [parsed];
  const latest = samples[samples.length - 1] as {
    engines?: Record<string, { busy?: number } | number>;
  };

  const engines = latest?.engines;
  if (!engines || typeof engines !== "object") {
    return null;
  }

  const renderBusy: number[] = [];
  const allBusy: number[] = [];

  for (const [name, stats] of Object.entries(engines)) {
    const busy =
      typeof stats === "number"
        ? stats
        : typeof stats === "object" && stats !== null && typeof stats.busy === "number"
          ? stats.busy
          : null;

    if (busy === null || !Number.isFinite(busy)) {
      continue;
    }

    allBusy.push(busy);
    if (/render|rcs|3d/i.test(name)) {
      renderBusy.push(busy);
    }
  }

  const values = renderBusy.length > 0 ? renderBusy : allBusy;
  if (values.length === 0) {
    return null;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return clampUsagePercent(average);
}

async function intelGpuTopInstalled(): Promise<boolean> {
  return (
    (await pathExists("/usr/bin/intel_gpu_top")) ||
    (await pathExists("/bin/intel_gpu_top"))
  );
}

async function readIntelGpuTopUsage(cardName: string): Promise<number | null> {
  if (!(await intelGpuTopInstalled())) {
    return null;
  }

  const now = Date.now();
  const cached = intelGpuTopCache.get(cardName);
  if (cached && now - cached.at < INTEL_GPU_TOP_CACHE_MS) {
    return cached.usage;
  }

  const cardNumber = cardName.replace(/^card/, "");
  const candidates = ["intel_gpu_top", "/usr/bin/intel_gpu_top", "/bin/intel_gpu_top"];

  for (const binary of candidates) {
    try {
      const { stdout } = await execFileAsync(
        binary,
        ["-J", "-s", "1000", "-n", "1", "-d", `drm:/dev/dri/card${cardNumber}`],
        { timeout: 8000 },
      );

      const usage = parseIntelGpuTopUsage(stdout);
      if (usage !== null) {
        intelGpuTopCache.set(cardName, { at: now, usage });
        return usage;
      }
    } catch {
      // try next binary
    }
  }

  return null;
}

async function readIntelUsagePercent(cardPath: string, deviceDir: string): Promise<number> {
  const sampleKey = cardPath;

  const busyRaw = await readTrimmed(path.join(deviceDir, "gpu_busy_percent"));
  if (busyRaw) {
    const instant = parseFloat(busyRaw);
    if (Number.isFinite(instant)) {
      return storeIntelUsage(sampleKey, clampUsagePercent(instant));
    }
  }

  const gpuTopUsage = await readIntelGpuTopUsage(path.basename(cardPath));
  if (gpuTopUsage !== null) {
    return storeIntelUsage(sampleKey, gpuTopUsage);
  }

  const clientRenderNs = await sumIntelClientRenderBusy(cardPath);
  const clientUsage = sampleIntelClientRenderUsage(`${sampleKey}:clients`, clientRenderNs);
  if (clientUsage !== null) {
    return clientUsage;
  }

  const fdinfoClients = await readIntelFdinfoRenderByClient();
  const fdinfoUsage = sampleIntelFdinfoUsage(`${sampleKey}:fdinfo`, fdinfoClients);
  if (fdinfoUsage !== null) {
    return fdinfoUsage;
  }

  return cachedIntelUsage(sampleKey) ?? 0;
}

async function readIntelGpus(): Promise<GpuMetrics[]> {
  if (process.platform !== "linux") {
    return [];
  }

  const gpus: GpuMetrics[] = [];
  let entries: string[];

  try {
    entries = await readdir("/sys/class/drm");
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!/^card\d+$/.test(entry)) {
      continue;
    }

    const cardPath = path.join("/sys/class/drm", entry);
    const deviceDir = path.join(cardPath, "device");
    if (!(await pathExists(deviceDir))) {
      continue;
    }

    const vendor = await readTrimmed(path.join(deviceDir, "vendor"));
    if (vendor !== INTEL_VENDOR) {
      continue;
    }

    const pciClass = await readTrimmed(path.join(deviceDir, "class"));
    if (!pciClass?.startsWith(DISPLAY_PCI_CLASS_PREFIX)) {
      continue;
    }

    gpus.push({
      vendor: "intel",
      name: "Intel integrated graphics",
      usagePercent: await readIntelUsagePercent(cardPath, deviceDir),
      memoryUsedBytes: null,
      memoryTotalBytes: null,
      temperatureCelsius: await readIntelGpuTemperature(deviceDir),
    });
  }

  return gpus;
}

export async function readGpuMetrics(): Promise<GpuMetrics[]> {
  return readIntelGpus();
}
