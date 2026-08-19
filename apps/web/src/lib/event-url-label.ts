export const EVENT_URL_LABELS = ["register", "learn_more"] as const;

export type EventUrlLabel = (typeof EVENT_URL_LABELS)[number];

export const DEFAULT_EVENT_URL_LABEL: EventUrlLabel = "register";

export const EVENT_URL_LABEL_COPY: Record<
  EventUrlLabel,
  { admin: string; button: string; opening: string }
> = {
  register: {
    admin: "Register for this event",
    button: "Register for This Event",
    opening: "Opening registration…",
  },
  learn_more: {
    admin: "Learn More",
    button: "Learn More",
    opening: "Opening link…",
  },
};

export function isEventUrlLabel(value: unknown): value is EventUrlLabel {
  return value === "register" || value === "learn_more";
}

export function eventUrlLabelCopy(value?: string | null) {
  return EVENT_URL_LABEL_COPY[isEventUrlLabel(value) ? value : DEFAULT_EVENT_URL_LABEL];
}
