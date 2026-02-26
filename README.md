# Escáner EAN

App web para escanear códigos de barras EAN con la cámara del navegador.

## Requisitos

- Node.js 18+
- PostgreSQL 14+ (corriendo localmente)

## Setup

### 1. Base de datos

Asegurate de tener PostgreSQL corriendo. La migración crea la base de datos `ean_scanner` automáticamente.

### 2. Servidor (NestJS)

```bash
cd server
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL
npm install
npx prisma migrate dev
npm run start:dev
```

El servidor corre en **http://localhost:3001**

### 3. Cliente (React)

```bash
cd client
npm install
npm run dev
```

La app corre en **http://localhost:5173**

## Uso

1. Abrir **http://localhost:5173** en Chrome o Edge
2. Crear una sesión con nombre y tipo
3. Permitir acceso a la cámara
4. Escanear códigos EAN
5. Presionar **Sincronizar** para guardar en el servidor
6. Compartir la URL corta + código de 4 dígitos con otros para ver el inventario
7. Desde el visor: ingresar el código de 4 dígitos para ver la tabla de ítems

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/sessions` | Crear sesión + primer sync |
| POST | `/api/sessions/:code/scans` | Agregar más scans |
| GET | `/api/sessions/:code` | Ver sesión completa |
| GET | `/api/sessions/:code/export` | Descargar CSV |
| GET | `/i/:code` | Visor público (pide código) |
| POST | `/i/:code/verify` | Verificar código de acceso |
