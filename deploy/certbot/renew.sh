#!/usr/bin/env sh
# Renew Let's Encrypt certs and reload nginx. Run from host cron, e.g. weekly.
set -e

cd "$(dirname "$0")/../.."

docker compose --profile certbot run --rm certbot renew --webroot --webroot-path=/var/www/certbot
docker compose exec nginx nginx -s reload

echo "Renewal finished."
