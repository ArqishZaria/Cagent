#!/usr/bin/env bash
# ==============================================================================
# 04-nginx-ssl.sh
# Installs the Nginx reverse proxy config and issues a Let's Encrypt cert via
# Certbot. HTTPS is mandatory here — browsers refuse WebRTC microphone access
# (getUserMedia) on a plain-HTTP origin, so the dialer simply won't work
# without this.
#
# Usage: sudo DOMAIN=api.yourdomain.com bash 04-nginx-ssl.sh
# ==============================================================================
set -euo pipefail

: "${DOMAIN:?Set DOMAIN=api.yourdomain.com before running this script}"

NGINX_CONF="/etc/nginx/sites-available/voip-saas"

cat > "$NGINX_CONF" << EOF
# HTTP -> HTTPS redirect (Certbot will also add its own challenge location
# here automatically the first time it runs).
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # Certbot fills these in automatically after the first successful run.
    # ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    client_max_body_size 20M;

    # Django/DRF backend (Gunicorn on 127.0.0.1:8000 — see systemd unit)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
    }

    # WebSocket/keepalive-friendly timeouts for Telnyx webhooks and any
    # long-lived connections — short-lived webhook POSTs don't need this, but
    # it's cheap insurance against Nginx cutting off a slow upstream response.
    proxy_connect_timeout 60s;
    proxy_send_timeout    60s;
    proxy_read_timeout    60s;

    # Static files (collected via `python manage.py collectstatic`)
    location /static/ {
        alias /opt/voip-saas/backend/staticfiles/;
    }
}
EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/voip-saas
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing Nginx config"
nginx -t

echo "==> Reloading Nginx"
systemctl reload nginx

echo "==> Requesting a Let's Encrypt certificate for ${DOMAIN}"
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect

echo "==> Verifying auto-renewal is scheduled"
systemctl status certbot.timer --no-pager || true

echo "==> Done. Point your Telnyx voice/SMS webhook URLs at:"
echo "    https://${DOMAIN}/api/telephony/webhooks/voice/"
echo "    https://${DOMAIN}/api/telephony/webhooks/sms/"
