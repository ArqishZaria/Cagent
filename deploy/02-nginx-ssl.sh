#!/usr/bin/env bash
# ==============================================================================
# 02-nginx-ssl.sh (Azure version — was 04-nginx-ssl.sh under Oracle)
# Installs the Nginx reverse proxy config and issues a Let's Encrypt cert via
# Certbot. HTTPS is mandatory: browsers refuse WebRTC microphone access
# (getUserMedia) on a plain-HTTP origin.
#
# The config is written as HTTP-only on purpose: nginx refuses to load a
# `listen 443 ssl` server that has no certificate yet, so a config with the
# 443 block up front fails `nginx -t` on a fresh box. Certbot's --nginx
# plugin adds the 443 block (with the real cert paths) and the HTTP->HTTPS
# redirect itself once the certificate is issued.
#
# Before running: point your domain's DNS A record at this VM's public IP
# (az vm show -d --resource-group voip-saas-rg --name voip-saas-prod --query publicIps -o tsv)
# and confirm it resolves (`dig +short api.yourdomain.com`).
#
# Usage: sudo DOMAIN=api.yourdomain.com bash 02-nginx-ssl.sh
# ==============================================================================
set -euo pipefail

: "${DOMAIN:?Set DOMAIN=api.yourdomain.com before running this script}"

NGINX_CONF="/etc/nginx/sites-available/voip-saas"

cat > "$NGINX_CONF" << CONF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    proxy_connect_timeout 60s;
    proxy_send_timeout    60s;
    proxy_read_timeout    60s;

    location /static/ {
        alias /opt/cagent/backend/staticfiles/;
    }
}
CONF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/voip-saas
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing Nginx config"
nginx -t

echo "==> Reloading Nginx"
systemctl reload nginx

echo "==> Requesting a Let's Encrypt certificate for ${DOMAIN} (adds the HTTPS block + redirect)"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect

echo "==> Verifying auto-renewal is scheduled"
systemctl status certbot.timer --no-pager || true

echo "==> Done. Point your Telnyx voice/SMS webhook URLs at:"
echo "    https://${DOMAIN}/api/telephony/webhooks/voice/"
echo "    https://${DOMAIN}/api/telephony/webhooks/sms/"