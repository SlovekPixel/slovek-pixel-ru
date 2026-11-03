#!/bin/sh
# 1. Render the site config for $DOMAIN.
# 2. Start with a temporary self-signed cert until certbot gets the real one.
# 3. Reload nginx whenever the certificate changes (first issue, renewals).
set -e

DOMAIN="${DOMAIN:-ts3.slovekpixel.ru}"
LIVE="/etc/letsencrypt/live/${DOMAIN}"

envsubst '${DOMAIN}' < /etc/nginx/site.conf.template > /etc/nginx/conf.d/default.conf

if [ ! -f "${LIVE}/fullchain.pem" ] || [ ! -f "${LIVE}/privkey.pem" ]; then
  echo "Creating temporary self-signed certificate for ${DOMAIN}..."
  mkdir -p "${LIVE}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${LIVE}/privkey.pem" \
    -out "${LIVE}/fullchain.pem" \
    -subj "/CN=${DOMAIN}"
fi

# live/* are symlinks into archive/, so -L: mtime changes when certbot swaps them
cert_mtime() { stat -L -c %Y "${LIVE}/fullchain.pem" 2>/dev/null || true; }

(
  last=$(cert_mtime)
  while sleep 60; do
    current=$(cert_mtime)
    # nginx -t also loads the cert/key, so a half-written pair is retried next minute
    if [ -n "$current" ] && [ "$current" != "$last" ] && nginx -t -q 2>/dev/null; then
      last=$current
      echo "Certificate for ${DOMAIN} changed, reloading nginx"
      nginx -s reload || true
    fi
  done
) &

exec nginx -g 'daemon off;'
