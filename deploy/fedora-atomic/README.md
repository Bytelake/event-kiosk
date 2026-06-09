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

Set at least `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env`. Use **unquoted** values (e.g. `ADMIN_PASSWORD=changeme`, not `ADMIN_PASSWORD="changeme"`). The container overrides `DATABASE_URL` and `UPLOADS_DIR` with in-container paths; leave those as the host paths in `.env` for `setup-db.sh` on the host.

### Admin login says "Invalid password" with `changeme`

Quoted values in `.env` break Podman env loading. Fix and restart:

```bash
sudo sed -i -E \
  -e 's/^([A-Za-z_][A-Za-z0-9_]*)="([^"]*)"$/\1=\2/' \
  /var/lib/kiosk/.env
sudo cp deploy/fedora-atomic/quadlet/kiosk-web.container /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart kiosk-web
```

### Web container won't start (exit code 125)

Usually the image is missing or host data files were not ready:

```bash
sudo bash deploy/fedora-atomic/prepare-web-container.sh ghcr.io/bytelake/event-kiosk-web:latest ~/event-kiosk
sudo cp deploy/fedora-atomic/quadlet/kiosk-web.container /etc/containers/systemd/kiosk-web.container
sudo bash deploy/fedora-atomic/enable-quadlet.sh
sudo systemctl restart kiosk-web
journalctl -xeu kiosk-web.service
```

`systemctl enable kiosk-web.service` may print *transient or generated* for Quadlet units; use `enable-quadlet.sh` instead.

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
