# Deploy en Railway

Guía para desplegar el cliente (React) y el servidor (NestJS + PostgreSQL) en [Railway](https://railway.app).

---

## Arquitectura en producción

```
Browser
  │
  ▼
[Client Service]  ←─ Railway (nginx)
  │  /api/*  →  proxy
  │  /i/*    →  proxy
  ▼
[Server Service]  ←─ Railway (NestJS)
  │
  ▼
[PostgreSQL]      ←─ Railway Plugin
```

El cliente sirve la SPA con nginx y hace proxy de las rutas `/api` e `/i` al servidor, evitando problemas de CORS.

---

## Paso 1: Crear el proyecto en Railway

1. Abre [railway.app](https://railway.app) e inicia sesión.
2. Haz clic en **New Project**.
3. Selecciona **Empty Project**.

---

## Paso 2: Agregar PostgreSQL

1. Dentro del proyecto, haz clic en **+ New** → **Database** → **Add PostgreSQL**.
2. Railway creará la base de datos automáticamente.
3. Anota la variable `DATABASE_URL` que aparece en la sección **Variables** del plugin de PostgreSQL (la necesitarás en el siguiente paso).

---

## Paso 3: Deploy del servidor (NestJS)

### Opción A: Desde GitHub (recomendado)

1. Haz clic en **+ New** → **GitHub Repo**.
2. Selecciona el repositorio y marca **Root Directory** → `server`.
3. Railway detectará el `Dockerfile` automáticamente.

### Opción B: Railway CLI

```bash
cd server
railway link   # vincula al proyecto
railway up
```

### Variables de entorno del servidor

En la sección **Variables** del servicio `server`, agrega:

| Variable       | Valor                                      |
|----------------|--------------------------------------------|
| `DATABASE_URL` | (copiar desde el plugin de PostgreSQL)     |
| `PORT`         | `3001`                                     |
| `CORS_ORIGIN`  | URL pública del cliente (se configura después, ver Paso 5) |

> **Nota:** `DATABASE_URL` puede referenciarse directamente desde el plugin usando `${{Postgres.DATABASE_URL}}` en Railway.

### Dominio del servidor

1. Ve a **Settings** → **Networking** → **Generate Domain**.
2. Copia la URL generada (ej. `https://server-production-xxxx.up.railway.app`).

---

## Paso 4: Deploy del cliente (React + nginx)

### Opción A: Desde GitHub (recomendado)

1. Haz clic en **+ New** → **GitHub Repo**.
2. Selecciona el repositorio y marca **Root Directory** → `client`.
3. Railway detectará el `Dockerfile` automáticamente.

### Opción B: Railway CLI

```bash
cd client
railway link
railway up
```

### Variables de entorno del cliente

En la sección **Variables** del servicio `client`, agrega:

| Variable       | Valor                                              |
|----------------|----------------------------------------------------|
| `PORT`         | `80`                                               |
| `BACKEND_URL`  | URL pública del servidor del Paso 3 (sin `/` final) |

Ejemplo de `BACKEND_URL`:
```
https://server-production-xxxx.up.railway.app
```

### Dominio del cliente

1. Ve a **Settings** → **Networking** → **Generate Domain**.
2. Copia la URL generada — esta es la URL pública de tu app.

---

## Paso 5: Conectar servidor ↔ cliente (CORS)

Ahora que tienes la URL del cliente, vuelve al servicio `server` y actualiza la variable:

| Variable      | Valor                                              |
|---------------|----------------------------------------------------|
| `CORS_ORIGIN` | URL pública del cliente (ej. `https://client-production-xxxx.up.railway.app`) |

Guarda los cambios. Railway hará redeploy automático.

---

## Verificación

1. Abre la URL del cliente en el navegador.
2. Crea una sesión de escaneo.
3. Escanea un código EAN.
4. Verifica que los datos se sincronizan correctamente con el servidor.

Si algo falla, revisa los logs de cada servicio en Railway: **Deployments** → seleccionar el deploy → **View Logs**.

---

## Variables de entorno resumen

### Servidor (`server/`)

| Variable       | Descripción                              | Requerida |
|----------------|------------------------------------------|-----------|
| `DATABASE_URL` | Connection string de PostgreSQL          | Sí        |
| `PORT`         | Puerto del servidor (default: `3001`)    | No        |
| `CORS_ORIGIN`  | URL del cliente para CORS                | Sí        |

### Cliente (`client/`)

| Variable       | Descripción                              | Requerida |
|----------------|------------------------------------------|-----------|
| `PORT`         | Puerto de nginx (default: `80`)          | No        |
| `BACKEND_URL`  | URL pública del servidor (sin `/` final) | Sí        |

---

## Archivos Docker creados

```
claude-test/
├── client/
│   ├── Dockerfile              # Multi-stage: Node (build) + nginx (serve)
│   └── nginx.conf.template     # Config de nginx con proxy a /api e /i
└── server/
    └── Dockerfile              # Multi-stage: Node (build) + Node (prod)
```
