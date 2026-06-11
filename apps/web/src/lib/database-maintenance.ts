export class DatabaseUnavailableError extends Error {
  constructor(message = "Database is temporarily unavailable") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

let maintenanceMode = false;
let activeQueries = 0;
let drainResolvers: Array<() => void> = [];

export function isDatabaseMaintenanceMode(): boolean {
  return maintenanceMode;
}

export function assertDatabaseWritable(): void {
  if (maintenanceMode) {
    throw new DatabaseUnavailableError();
  }
}

export function trackQueryStart(): void {
  activeQueries += 1;
}

export function trackQueryEnd(): void {
  activeQueries = Math.max(0, activeQueries - 1);
  if (maintenanceMode && activeQueries === 0) {
    for (const resolve of drainResolvers) {
      resolve();
    }
    drainResolvers = [];
  }
}

async function waitForActiveQueries(): Promise<void> {
  if (activeQueries === 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    drainResolvers.push(resolve);
  });
}

export async function withDatabaseMaintenance<T>(
  operation: () => Promise<T>,
): Promise<T> {
  maintenanceMode = true;
  await waitForActiveQueries();

  try {
    return await operation();
  } finally {
    maintenanceMode = false;
  }
}
