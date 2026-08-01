#!/bin/sh
set -e

echo "Waiting for database..."
# Prisma migrate deploy retries on connection failures if we loop briefly
i=0
until npx prisma db push --skip-generate; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Database not ready after retries" >&2
    exit 1
  fi
  echo "Database unavailable, retrying ($i)..."
  sleep 2
done

echo "Starting API..."
exec npm run start
