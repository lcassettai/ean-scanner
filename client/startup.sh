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

# nginx:alpine >= 1.21 uses http.d/, older versions use conf.d/
if [ -d /etc/nginx/http.d ]; then
  NGINX_CONF=/etc/nginx/http.d/default.conf
else
  NGINX_CONF=/etc/nginx/conf.d/default.conf
fi

envsubst '${PORT} ${BACKEND_URL}' \
  < /etc/nginx/nginx.conf.template \
  > "$NGINX_CONF"

echo "=== nginx config ($NGINX_CONF) ==="
cat "$NGINX_CONF"
echo "=== files in /usr/share/nginx/html ==="
ls -la /usr/share/nginx/html

exec nginx -g 'daemon off;'
