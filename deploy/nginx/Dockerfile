FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh
ENTRYPOINT ["/bin/sh", "/docker-entrypoint-custom.sh"]
