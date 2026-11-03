#!/bin/sh
# Entrypoint of the certbot container: gets the Let's Encrypt certificate for $DOMAIN
# on first start (as soon as DNS points here), then renews it twice a day.
# nginx notices the new files by itself (deploy/nginx/docker-entrypoint.sh).

DOMAIN="${DOMAIN:-ts3.slovekpixel.ru}"
WEBROOT=/var/www/certbot

if [ -n "${CERTBOT_EMAIL:-}" ]; then
  CONTACT="--email ${CERTBOT_EMAIL}"
else
  CONTACT="--register-unsafely-without-email"
fi

# Give nginx a moment to create its temporary cert and start serving port 80
sleep 10

while :; do
  if [ -f "/etc/letsencrypt/renewal/${DOMAIN}.conf" ]; then
    certbot renew --webroot -w "$WEBROOT" --quiet
    sleep 43200 # 12h
    continue
  fi

  echo "Requesting Let's Encrypt certificate for ${DOMAIN}..."
  # certbot refuses to write into live/${DOMAIN} while nginx's self-signed placeholder is there
  rm -rf "/etc/letsencrypt/live/${DOMAIN}" "/etc/letsencrypt/archive/${DOMAIN}"
  # shellcheck disable=SC2086
  if certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" $CONTACT \
    --agree-tos --no-eff-email --non-interactive; then
    echo "Certificate for ${DOMAIN} issued, nginx will pick it up within a minute"
  else
    echo "Could not get a certificate: does ${DOMAIN} resolve to this server, is port 80 open? Retrying in 1h" >&2
    sleep 3600 # stays well under Let's Encrypt's failed-validation limit
  fi
done
