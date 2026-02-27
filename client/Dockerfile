# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage ----
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Railway sets PORT dynamically; default to 80 for local testing
ENV PORT=80
ENV BACKEND_URL=http://localhost:3001

EXPOSE 80

# Substitute only ${PORT} and ${BACKEND_URL}, leaving nginx's own $variables intact
CMD ["/bin/sh", "-c", "envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
