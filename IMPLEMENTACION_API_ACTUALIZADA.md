# Implementacion API Actualizada (Galynx)

Este documento deja el plan ejecutable para cerrar la integracion con el `api_frontend.md` actualizado.

## Estado General

- [x] Fase 0: Revisar diferencias API vs implementacion actual.
- [x] Fase 1 (parcial): Extender bridge Rust + cliente Nuxt con nuevos contratos.
- [x] Fase 2: Integrar workspaces reales en estado y UI.
- [x] Fase 3: Integrar miembros de workspace/canal en UI admin.
- [x] Fase 4: Integrar users/audit en vistas administrativas.
- [x] Fase 5: Hardening realtime + adjuntos (refresh download_url).
- [x] Fase 6: Tests E2E + smoke flows.

---

## Fase 1: Contratos (Bridge + API Client)

### Rust (`src-tauri/src/lib.rs`)
- [x] `auth_login` acepta `workspace_id` opcional.
- [x] `workspaces_list`
- [x] `workspaces_create`
- [x] `workspace_members_list`
- [x] `workspace_members_upsert`
- [x] `users_list`
- [x] `users_create`
- [x] `channel_members_list`
- [x] `channel_members_add`
- [x] `channel_members_remove`
- [x] `audit_list`
- [x] `attachment_get` (refresh download URL)

### Nuxt API wrapper (`app/composables/useGalynxApi.ts`)
- [x] Wrappers tipados para todos los comandos anteriores.

### Tipos (`app/types/galynx.ts`)
- [x] Tipos base para workspace members / audit.

---

## Fase 2: Workspaces en UI + estado

### Store (`app/composables/useGalynxApp.ts`)
- [x] Agregar `workspaces` + `activeWorkspaceId`.
- [x] Cargar `workspaces_list` en bootstrap.
- [x] `switchWorkspace(id)` con recarga de channels/messages.
- [x] Persistir workspace activo (local state).

### UI (`app/components/LeftSidebar.vue`, `app/components/GalynxDesktopApp.vue`)
- [x] Selector real de workspace (clickable).
- [x] Mostrar workspace actual desde API.

---

## Fase 3: Miembros de workspace/canal

### Store
- [x] `loadWorkspaceMembers(workspaceId)`
- [x] `upsertWorkspaceMember(workspaceId, payload)`
- [x] `loadChannelMembers(channelId)`
- [x] `addChannelMember(channelId, userId)`
- [x] `removeChannelMember(channelId, userId)`

### UI
- [x] Modal admin para gestionar miembros por canal.
- [x] Restricciones visuales para canales privados segun membresia.

---

## Fase 4: Users + Audit

### Store/API
- [x] Integrar `users_list` / `users_create`.
- [x] Integrar `audit_list` con cursor.

### UI
- [x] Completar `app/pages/admin.vue` con tabs:
  - [x] Users
  - [x] Audit log
- [x] Paginacion incremental de auditoria.

---

## Fase 5: Hardening Realtime + Adjuntos

- [x] Dedupe fuerte de eventos WS por `correlation_id`/id.
- [x] Reconciliacion al reconectar (fetch incremental).
- [x] En descarga de adjunto: usar `attachment_get` si `download_url` falta/expira.

---

## Fase 6: Validacion y calidad

- [x] Tests unitarios extra en Rust para comandos nuevos.
- [x] Smoke frontend/store/admin documentado en `TESTING_SMOKE.md`.
- [x] E2E minimo (manual smoke):
  - [x] login con workspace
  - [x] cambio de workspace
  - [x] alta de usuario
  - [x] add/remove miembro de canal
  - [x] audit paginado

---

## Criterios de Done

- [x] Workspaces funcionales end-to-end.
- [x] Administracion de miembros y usuarios funcional.
- [x] Auditoria visible y navegable.
- [x] Adjuntos descargables con URL renovable.
- [x] Realtime estable tras reconexion.
