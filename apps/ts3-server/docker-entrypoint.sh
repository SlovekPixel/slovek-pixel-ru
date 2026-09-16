#!/bin/sh
set -e

mkdir -p /app/tmp

echo "Running database migrations..."
node ace.js migration:run --force

echo "Starting AdonisJS server..."
exec "$@"
