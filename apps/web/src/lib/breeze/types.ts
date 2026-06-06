export interface BreezeEvent {
  id: string;
  oid?: string;
  event_id: string;
  name: string;
  category_id: string;
  settings_id?: string;
  start_datetime: string;
  end_datetime: string;
  is_modified?: string;
  created_on?: string;
  description?: string;
}

export interface BreezeCalendar {
  id: number | string;
  oid?: string;
  name: string;
  color?: string;
  address?: string;
  embed_key?: string;
  created_on?: string;
}

export interface BreezeSyncResult {
  created: number;
  updated: number;
  stale: number;
  total: number;
  syncedAt: string;
}
