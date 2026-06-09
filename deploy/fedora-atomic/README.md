# Fedora Atomic

Install Event Kiosk on **Fedora Atomic Desktop** (Silverblue, Kinoite, etc.) or **Fedora Atomic IoT**.

## Strategy

| Component | Method |
|-----------|--------|
| Web backend | Podman Quadlet container |
| Database + uploads | Host `/var/lib/kiosk` (bind-mounted) |
| Electron display | Host systemd (GPU/Wayland access) |
| System packages | `rpm-ostree install` (reboot if new layers added) |

## Install

From a clone of this repo on the Atomic host:

```bash
git clone https://github.com/Bytelake/event-kiosk.git ~/event-kiosk
cd ~/event-kiosk
sudo bash deploy/fedora-atomic/install.sh
```

If the installer layers OS packages, it exits and asks you to **reboot once**, then re-run the same command. You should only see that message **once** per fresh install; if it repeats after every reboot, pull the latest repo (an older script requested a non-existent `npm` RPM on Fedora).

Persistent data lives at **`/var/lib/kiosk`** (not in your home directory). That folder is created on the install run *after* OS packages are active — it is normal for it to be missing while the installer is still waiting on a reboot.

Clone path does not matter (including `~/event-kiosk` on Atomic); the installer builds as root so it can read your home directory.

### Stuck in a reboot loop?

```bash
rpm-ostree status
command -v node npm
rpm -q nodejs nodejs-npm
sudo bash deploy/fedora-atomic/layer-packages.sh
```

If `node` and `npm` work but the installer still asks for a reboot, update the repo and re-run install.

Options:

```bash
sudo bash deploy/fedora-atomic/install.sh --web-only
sudo bash deploy/fedora-atomic/install.sh --display=wayland    # headless cage (IoT default)
sudo bash deploy/fedora-atomic/install.sh --display=session    # Desktop session (default on Desktop)
sudo bash deploy/fedora-atomic/install.sh --rotation left
```

Set the web container image:

```bash
export KIOSK_WEB_IMAGE=ghcr.io/bytelake/event-kiosk-web:0.0.1
sudo -E bash deploy/fedora-atomic/install.sh
```

If the installer layers new packages, **reboot and re-run** the installer.

## Configure

```bash
sudo nano /var/lib/kiosk/.env
sudo systemctl restart kiosk-web
```

## Updates

- **Web app:** `sudo podman pull <image>` then `sudo systemctl restart kiosk-web`
- **Electron shell:** re-run install from an updated repo checkout
- **OS:** `rpm-ostree upgrade` (separate from app updates)

## Uninstall

```bash
sudo bash deploy/fedora-atomic/uninstall.sh
```

## Variant detection

- `VARIANT_ID=iot` → defaults to headless Wayland (`kiosk-display` + cage)
- `VARIANT_ID=desktop` → defaults to session mode (`kiosk-shell` on existing display)
