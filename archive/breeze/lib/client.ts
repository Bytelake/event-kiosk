import type { BreezeCalendar, BreezeEvent } from "./types";

export class BreezeClient {
  constructor(
    private subdomain: string,
    private apiKey: string,
  ) {}

  private baseUrl() {
    return `https://${this.subdomain}.breezechms.com/api`;
  }

  private async fetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl()}${path}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Breeze API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async listEvents(options: {
    start: string;
    end: string;
    categoryId?: string;
    details?: boolean;
  }): Promise<BreezeEvent[]> {
    const params: Record<string, string> = {
      start: options.start,
      end: options.end,
      details: options.details ? "1" : "0",
      limit: "1000",
    };

    if (options.categoryId) {
      params.category_id = options.categoryId;
    }

    const data = await this.fetch<BreezeEvent[] | BreezeEvent>("/events", params);
    return Array.isArray(data) ? data : [data];
  }

  async listCalendars(): Promise<BreezeCalendar[]> {
    const data = await this.fetch<BreezeCalendar[]>("/events/calendars/list");
    return Array.isArray(data) ? data : [];
  }
}

export function getBreezeClientFromEnv() {
  const subdomain = process.env.BREEZE_SUBDOMAIN;
  const apiKey = process.env.BREEZE_API_KEY;
  if (!subdomain || !apiKey) {
    return null;
  }
  return new BreezeClient(subdomain, apiKey);
}

export async function getBreezeClientFromSettings() {
  const { getSettings } = await import("@/lib/db");
  const settings = await getSettings();
  const subdomain = settings.breezeSubdomain || process.env.BREEZE_SUBDOMAIN;
  const apiKey = settings.breezeApiKey || process.env.BREEZE_API_KEY;
  if (!subdomain || !apiKey) {
    return null;
  }
  return new BreezeClient(subdomain, apiKey);
}
