# Galynx Desktop (Nuxt + Tauri + Rust Bridge)

Aplicacion desktop de mensajeria interna para Galynx.

Frontend:
- Nuxt 4 + Vue 3 (`app/`)

Desktop shell:
- Tauri 2 (`src-tauri/`)

Bridge API:
- Rust (comandos Tauri) para consumir la API Galynx por HTTP + WebSocket.

## Arquitectura

La UI **no llama directamente** a `http://localhost:3000`.
El flujo es:

1. Nuxt llama `invoke(...)` (`/Users/antonio/github/jmercadoc/galynx/app/composables/useGalynxApi.ts`)
2. Tauri/Rust ejecuta requests a la API (`/Users/antonio/github/jmercadoc/galynx/src-tauri/src/lib.rs`)
3. Rust emite eventos realtime al frontend (`realtime:status`, `realtime:event`)

Incluye:
- auth con refresh automatico en `401`
- retry suave para `429`
- realtime WS
- flujo de adjuntos (presign -> upload binario -> commit)

## Requisitos

- Node.js 20+
- `pnpm`
- Rust toolchain estable
- Dependencias de Tauri para tu OS
- API Galynx corriendo en `http://localhost:3000`

## Configuracion

Base URL por defecto:
- `http://localhost:3000/api/v1`

Variable opcional:
- `GALYNX_API_BASE`

Ejemplo:

```bash
export GALYNX_API_BASE="http://localhost:3000/api/v1"
```

## Credenciales bootstrap (local)

- Email: `owner@galynx.local`
- Password: `ChangeMe123!`

## Instalacion

Desde la raiz del repo:

```bash
pnpm install
```

## Ejecutar en desarrollo

1. Levanta primero la API (`http://localhost:3000`)
2. En otra terminal, desde este repo:

```bash
pnpm tauri dev
```

Notas:
- Nuxt dev corre en `http://localhost:3001` (interno para Tauri).
- Tauri usa `beforeDevCommand: pnpm dev`.

## Build desktop

```bash
pnpm tauri build
```

## Comandos utiles de validacion

Typecheck frontend:

```bash
pnpm exec vue-tsc --noEmit
```

Check Rust:

```bash
cargo check -p app --locked
```

Tests Rust:

```bash
cargo test -p app --locked
```

## Estructura clave

- `/Users/antonio/github/jmercadoc/galynx/app/components/GalynxDesktopApp.vue`: shell principal conectada a API real.
- `/Users/antonio/github/jmercadoc/galynx/app/composables/useGalynxApp.ts`: estado global, bootstrap, mensajes, hilos, adjuntos.
- `/Users/antonio/github/jmercadoc/galynx/app/composables/useGalynxApi.ts`: cliente tipado de comandos Tauri.
- `/Users/antonio/github/jmercadoc/galynx/app/plugins/realtime.client.ts`: listeners de eventos realtime.
- `/Users/antonio/github/jmercadoc/galynx/src-tauri/src/lib.rs`: comandos Tauri, HTTP/WS, auth, persistencia de tokens, adjuntos.
- `/Users/antonio/github/jmercadoc/galynx/api_frontend.md`: contrato API para frontend.

## Seguridad actual de sesion

Los tokens se almacenan usando `tauri-plugin-store` con serializacion cifrada personalizada en el bridge Rust.

## Troubleshooting rapido

- Login falla:
  - verifica que la API este arriba (`/api/v1/health` y `/api/v1/ready`)
  - confirma base URL (`GALYNX_API_BASE`)
- Sin realtime:
  - revisa conexion a `/api/v1/ws`
  - valida token vigente
- Error de tipos Vue:
  - ejecuta `pnpm exec vue-tsc --noEmit`
