#!/bin/sh
# Create a short-lived self-signed cert so nginx can start before Let's Encrypt.
set -e

DOMAIN="${DOMAIN:-ts.slovekpixel.ru}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

if [ ! -f "${CERT_DIR}/fullchain.pem" ] || [ ! -f "${CERT_DIR}/privkey.pem" ]; then
  echo "Creating temporary self-signed certificate for ${DOMAIN}..."
  mkdir -p "${CERT_DIR}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}"
fi

exec nginx -g 'daemon off;'
