# 🚀 Guía de Despliegue en Vercel - Remises Bruno

Esta guía detalla los pasos exactos para desplegar la plataforma **Remises Bruno** en **Vercel** con su dominio principal y la arquitectura de subdominios solicitada.

---

## 🌐 Arquitectura de Dominios Configurada

| Subdominio / URL | Perfil / Módulo | Destino Interno (Reescrito por Middleware) |
| :--- | :--- | :--- |
| **`https://www.brunoremises.com.ar`** | **Web Institucional / Portal General** | Página principal con tarjetas de acceso a cada portal y login |
| **`https://clientes.brunoremises.com.ar`** | **Pasajeros / Clientes** | `/cliente/app` (Petición de viaje, mapa, tarifas) |
| **`https://choferes.brunoremises.com.ar`** | **Conductores / Choferes** | `/chofer/app` (App del chofer, GPS en vivo, viajes, gastos) |
| **`https://coordinacion.brunoremises.com.ar`** | **Operadores / Coordinadores** | `/coordinador/dashboard` (Despacho, mapa en vivo, cierres) |
| **`https://admin.brunoremises.com.ar`** | **Dueño / Administración** | `/duenio/dashboard` (Liquidaciones, flota, finanzas) |

> **Nota técnica:** Se implementó `frontend/middleware.ts` en Next.js. El usuario verá en su navegador una URL limpia (ej: `clientes.brunoremises.com.ar/` o `choferes.brunoremises.com.ar/gastos`) sin prefijos redundantes, y la autenticación cuenta con SSO compartido bajo la cookie `.brunoremises.com.ar`.

---

## 1️⃣ Paso 1: Desplegar el Frontend en Vercel

1. Entrá a [Vercel](https://vercel.com/) e iniciá sesión con tu cuenta de GitHub/GitLab.
2. Hacé clic en **"Add New..."** ➔ **"Project"**.
3. Seleccioná el repositorio del proyecto `AppRemises`.
4. En la configuración del proyecto:
   - **Project Name:** `remises-bruno` (o el nombre que prefieras).
   - **Framework Preset:** `Next.js` (detectado automáticamente).
   - **Root Directory:** Hacé clic en **Edit** y seleccioná la carpeta:
     ```text
     frontend
     ```
5. En la sección **Environment Variables** (Variables de Entorno), agregá:
   - `NEXT_PUBLIC_API_URL`: URL de tu backend en producción con `/api` al final (Ej: `https://api.brunoremises.com.ar/api` o `https://appremises-backend.onrender.com/api`).
   - `NEXT_PUBLIC_SOCKET_URL`: URL base de tu backend para WebSockets (Ej: `https://api.brunoremises.com.ar` o `https://appremises-backend.onrender.com`).
6. Hacé clic en **Deploy**.

---

## 2️⃣ Paso 2: Configurar los Subdominios en Vercel

Una vez que el proyecto esté desplegado en Vercel:

1. Ve a **Settings** ➔ **Domains** en tu proyecto de Vercel.
2. Agregá uno a uno los siguientes dominios:
   - `brunoremises.com.ar`
   - `www.brunoremises.com.ar`
   - `clientes.brunoremises.com.ar`
   - `choferes.brunoremises.com.ar`
   - `coordinacion.brunoremises.com.ar`
   - `admin.brunoremises.com.ar`

---

## 3️⃣ Paso 3: Configurar los Registros DNS (En tu proveedor: DonWeb, Cloudflare, etc.)

Ingresá al panel de administración de tu zona DNS de `brunoremises.com.ar` y agregá los siguientes registros:

| Tipo | Nombre (Host) | Valor / Destino | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (o en blanco) | `76.76.21.21` | Automático / 3600 |
| **CNAME** | `www` | `cname.vercel-dns.com.` | Automático / 3600 |
| **CNAME** | `clientes` | `cname.vercel-dns.com.` | Automático / 3600 |
| **CNAME** | `choferes` | `cname.vercel-dns.com.` | Automático / 3600 |
| **CNAME** | `coordinacion` | `cname.vercel-dns.com.` | Automático / 3600 |
| **CNAME** | `admin` | `cname.vercel-dns.com.` | Automático / 3600 |

*(Si además alojás el backend en un subdominio propio como `api.brunoremises.com.ar`, agregá un CNAME `api` que apunte al host de tu backend, ej: `appremises-backend.onrender.com`)*.

---

## 4️⃣ Paso 4: Backend (Express + Socket.io + PostgreSQL)

> ⚠️ **Importante sobre WebSockets:** Vercel es una plataforma serverless pensada para el Frontend. Los servidores de WebSockets en tiempo real (`Socket.io`) requieren un proceso Node.js continuo las 24 horas. Por esta razón, el backend debe correr en una plataforma persistente como **Render**, **Railway**, **Fly.io** o un **VPS**.

### Despliegue del Backend en Render / Railway:
1. Crear un nuevo servicio **Web Service** conectado al mismo repositorio.
2. **Root Directory:** `backend`
3. **Build Command:** `npm install && npm run build`
4. **Start Command:** `npm start`
5. **Variables de entorno del Backend:**
   - `DATABASE_URL`: Conexión PostgreSQL (Supabase / Neon / Render Postgres).
   - `DIRECT_URL`: Conexión directa PostgreSQL.
   - `JWT_SECRET`: Clave secreta para tokens JWT.
   - `PORT`: `3001` (o la asignada automáticamente por el host).
   - `FRONTEND_URL`: `https://www.brunoremises.com.ar` (El backend ya está programado para autorizar automáticamente por CORS todos los subdominios `*.brunoremises.com.ar`).

---

## 5️⃣ Verificación Final

- Entrá a `https://www.brunoremises.com.ar` ➔ Verás la portada oficial con acceso a cada portal.
- Entrá a `https://clientes.brunoremises.com.ar` ➔ Entrarás a la app de clientes.
- Entrá a `https://choferes.brunoremises.com.ar` ➔ Entrarás a la app de choferes.
- Entrá a `https://coordinacion.brunoremises.com.ar` ➔ Entrarás al panel del coordinador.
- Entrá a `https://admin.brunoremises.com.ar` ➔ Entrarás al panel de administración del dueño.
