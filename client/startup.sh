#!/bin/sh
set -e

PORT="${PORT:-80}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

# Add http:// if no protocol was specified
case "$BACKEND_URL" in
  http://*|https://*) ;;
  *) BACKEND_URL="http://$BACKEND_URL" ;;
esac

export PORT BACKEND_URL

envsubst '${PORT} ${BACKEND_URL}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
