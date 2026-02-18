# Testing Smoke (Fase 6)

Este archivo define los flujos minimos de validacion funcional para Galynx Desktop (Tauri + Nuxt) contra API real.

## Prerequisitos

1. API levantada en `http://localhost:3000` con prefijo `/api/v1`.
2. App desktop levantada (`pnpm tauri dev` o flujo equivalente).
3. Usuario bootstrap disponible:
   - `owner@galynx.local`
   - `ChangeMe123!`

## Verificacion rapida tecnica

1. `pnpm exec vue-tsc --noEmit`
2. `cargo check -p app --locked`
3. `cargo test -p app --locked`

## Smoke E2E minimo

### 1) Login con workspace

1. Abrir `/login`.
2. Iniciar sesion con bootstrap.
3. Resultado esperado:
   - Navega a `/`.
   - Sidebar muestra workspace activo real.
   - Estado de conexion pasa a `Connected`.

### 2) Cambio de workspace

1. En sidebar, abrir selector de workspace.
2. Cambiar a otro workspace disponible.
3. Resultado esperado:
   - Canales se recargan para el nuevo workspace.
   - Canal activo cambia a uno valido del workspace.
   - Al reiniciar app, se conserva el workspace activo.

### 3) Alta de usuario

1. Abrir `/admin`.
2. Tab `Users` -> crear usuario (`name`, `email`, `password`, `role`).
3. Resultado esperado:
   - Usuario aparece en tabla sin recargar.
   - No hay error global.

### 4) Add/Remove miembro de canal

1. Ir a `/` y seleccionar canal privado.
2. Boton `Members` en sidebar.
3. En modal:
   - Alta/actualizacion de miembro en workspace (si aplica).
   - `Add` usuario al canal.
   - `Remove` usuario del canal.
4. Resultado esperado:
   - Conteo de miembros del canal se actualiza.
   - Canal privado se oculta para usuarios sin membresia (rol `member`).

### 5) Audit paginado

1. Abrir `/admin` tab `Audit`.
2. Verificar lista inicial.
3. Presionar `Load more` mientras exista.
4. Resultado esperado:
   - Se agregan eventos sin duplicados.
   - `Load more` desaparece cuando `next_cursor = null`.

### 6) Realtime reconexion + reconciliacion

1. Con app abierta, simular caida temporal de API/WS.
2. Restaurar API.
3. Resultado esperado:
   - Estado muestra `reconnecting` y luego `online`.
   - Banner de sincronizacion aparece y desaparece.
   - Canales/mensajes vuelven consistentes tras reconexion.

### 7) Download de adjuntos con URL renovable

1. Abrir mensaje con adjunto.
2. Intentar descargar.
3. Esperar a que caduque URL (o limpiar estado local) y volver a descargar.
4. Resultado esperado:
   - App pide `attachment_get` cuando falta/expira `download_url`.
   - Descarga abre correctamente en nueva pestaña.
