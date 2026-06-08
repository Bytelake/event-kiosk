export function isDesktopMode(): boolean {
  return process.env.NEXT_PUBLIC_KIOSK_DESKTOP_MODE === "true";
}
