import type { Event } from "@prisma/client";

type SerializedEvent = {
  id: string;
  source: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  title: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  shortDescription: string | null;
  fullDescription: string | null;
  location: string | null;
  imageUrl: string | null;
  registrationUrl: string | null;
  urlLabel: string;
  featured: boolean;
  sortOrder: number;
  kioskVisible: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function serializeEvent(event: Event): SerializedEvent {
  return {
    id: event.id,
    source: event.source,
    syncStatus: event.syncStatus,
    lastSyncedAt: iso(event.lastSyncedAt),
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: iso(event.endAt),
    allDay: event.allDay,
    shortDescription: event.shortDescription,
    fullDescription: event.fullDescription,
    location: event.location,
    imageUrl: event.imageUrl,
    registrationUrl: event.registrationUrl,
    urlLabel: event.urlLabel,
    featured: event.featured,
    sortOrder: event.sortOrder,
    kioskVisible: event.kioskVisible,
    status: event.status,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function serializeKioskEvent(event: Event) {
  return {
    id: event.id,
    title: event.title,
    startAt: event.startAt.toISOString(),
    endAt: iso(event.endAt),
    allDay: event.allDay,
    shortDescription: event.shortDescription,
    fullDescription: event.fullDescription,
    location: event.location,
    imageUrl: event.imageUrl,
    registrationUrl: event.registrationUrl,
    urlLabel: event.urlLabel,
    featured: event.featured,
  };
}
