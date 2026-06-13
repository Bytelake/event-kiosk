# Alpine Linux

Install Event Kiosk on **Alpine Linux 3.20+** on **arm64** or **amd64**. Supports **systemd** or **OpenRC** (auto-detected at install time).

## Prerequisites

- **Root access.** Minimal Alpine images have no `sudo` package; run install scripts as root (`su` or `doas`).
- **community** repository enabled (install scripts uncomment or add this automatically).
- **electron** from the testing repo (musl build). On newer releases (e.g. 3.24) where versioned `testing` is empty, the installer adds **edge/testing** automatically.
- Node.js 20+ (`nodejs` apk or pre-installed).

## Release package (recommended)

Download `event-kiosk-alpine-<arch>-*.tar.gz` from [GitHub Releases](https://github.com/Bytelake/event-kiosk/releases).

```bash
tar -xzf event-kiosk-alpine-amd64-*.tar.gz && cd event-kiosk-alpine-*
su -c 'bash install.sh'
su -c 'nano /var/lib/kiosk/.env'
su -c 'rc-service kiosk-web restart'    # systemd: systemctl restart kiosk-web
```

Portrait monitor at install time:

```bash
su -c 'bash install.sh --rotation left'
```

Change rotation after install:

```bash
su -c '/opt/kiosk/bin/set-display-rotation.sh --set left'
su -c 'rc-service kiosk-display restart'
```

### Options

| Flag | Description |
|------|-------------|
| `--web-only` | Backend only, no fullscreen display |
| `--display=wayland` | Headless cage on tty1 (default) |
| `--display=x11` | Electron on X11 (`DISPLAY=:0`) |
| `--rotation left` | Portrait monitor (`right`, `inverted`, `normal`) |

## Install from source

```bash
git clone https://github.com/Bytelake/event-kiosk.git ~/event-kiosk
cd ~/event-kiosk
su -c 'bash deploy/alpine/install.sh'
```

The source installer builds as the `kiosk` user and needs write access to the clone directory (ownership is set automatically).

For a portrait display:

```bash
su -c 'bash deploy/alpine/install.sh --rotation left'
```

## Layout

| Path | Purpose |
|------|---------|
| `/opt/kiosk/web/` | Next.js standalone server |
| `/opt/kiosk/shell/` | Electron shell |
| `/var/lib/kiosk/` | Database, uploads, `.env`, `display.env` |

## Services (OpenRC)

```bash
rc-service kiosk-web status
rc-service kiosk-display status
rc-service kiosk-web restart
rc-service kiosk-display restart
/opt/kiosk/diagnose.sh
```

On **systemd**, replace `rc-service …` with `systemctl …`.

## Updates

Extract a newer release tarball and run `su -c 'bash update.sh'` (not `install.sh`).

## Uninstall

```bash
su -c 'bash /opt/kiosk/uninstall.sh'
```

Recovery: **Ctrl+Alt+F2** for a normal console login.

## Electron on musl

Alpine uses musl libc. The install flow uses the system **`electron`** apk (not npm’s glibc prebuilt) with `ELECTRON_SKIP_BINARY_DOWNLOAD=1` for shell dependencies.

## Troubleshooting

**`electron (no such package)`** — Ensure **community** is enabled. On Alpine 3.24+, the installer adds **edge/testing** when versioned testing has no electron build.

**`libinput initialization failed, no input devices`** (cage exits) — Add to `/var/lib/kiosk/display.env`:

```bash
WLR_LIBINPUT_NO_DEVICES=1
```

Then restart the display service. Remove this line if you add a keyboard or touchscreen and want libinput to require input devices.

**Install scripts call `sudo -u kiosk`** — Alpine has no `sudo` apk. The installer provides a small `/usr/bin/sudo` wrapper backed by `runuser` from **util-linux**.

**OpenRC display service shows `crashed`** — The display service uses `supervise-daemon` with `launch-kiosk-display.sh` (not a one-shot `openvt` command). Check `/var/log/messages` and run `/opt/kiosk/diagnose.sh`.
