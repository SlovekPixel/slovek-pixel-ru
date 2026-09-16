#!/usr/bin/env sh
# First-time Let's Encrypt certificate for ts.slovekpixel.ru
# Prerequisites: DNS A record points to this server; ports 80/443 open; stack is up.
set -e

cd "$(dirname "$0")/../.."

# Load CERTBOT_EMAIL / DOMAIN from .env if present
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.env
  set +a
fi

DOMAIN="${DOMAIN:-ts.slovekpixel.ru}"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env}"

echo "Removing any temporary/self-signed cert for ${DOMAIN} (nginx bootstrap)..."
# certbot profile shares certbot-etc volume with nginx
docker compose --profile certbot run --rm --entrypoint sh certbot -c \
  "rm -rf /etc/letsencrypt/live/${DOMAIN} \
          /etc/letsencrypt/archive/${DOMAIN} \
          /etc/letsencrypt/renewal/${DOMAIN}.conf"

echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
docker compose --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  -d "${DOMAIN}"

echo "Restarting nginx to load the new certificate..."
docker compose up -d nginx
docker compose exec nginx nginx -s reload || true

echo "Issuer check (should mention Let's Encrypt):"
docker compose exec nginx openssl x509 \
  -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" \
  -noout -issuer -subject -dates

echo "Done. Site: https://${DOMAIN}"
echo "TeamSpeak client: ${DOMAIN} (UDP 9987)"
