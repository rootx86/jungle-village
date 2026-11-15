#!/usr/bin/env bash
# One-time server setup for a fresh Ubuntu 22.04 / 24.04 VPS. Run as root:  bash setup-vps.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl ufw unattended-upgrades rsync

# Docker (official convenience script; includes the compose plugin)
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Firewall: SSH + web only. Postgres is never published.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Automatic security updates
dpkg-reconfigure -f noninteractive unattended-upgrades || true

# 2 GB swap so a 4 GB server survives memory spikes
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

mkdir -p /opt/jungle-village
echo "Server ready. Copy the project to /opt/jungle-village, then run deploy/make-env.sh and docker compose (see DEPLOY.md)."
