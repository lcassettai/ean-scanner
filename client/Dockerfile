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

# Copy nginx template - the official nginx image processes /etc/nginx/templates/
# automatically using envsubst on startup, replacing ${PORT} and ${BACKEND_URL}
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Railway sets PORT dynamically; default to 80 for local testing
ENV PORT=80
ENV BACKEND_URL=http://localhost:3001

EXPOSE 80
