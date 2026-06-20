export const KIOSK_BACKGROUND_STYLES = ["gradient", "image"] as const;

export type KioskBackgroundStyle = (typeof KIOSK_BACKGROUND_STYLES)[number];

export const defaultKioskBackgroundStyle: KioskBackgroundStyle = "gradient";
