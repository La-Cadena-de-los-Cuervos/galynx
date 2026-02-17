# Pendientes de Implementacion

Este archivo resume trabajo pendiente despues del estado actual del proyecto.

## Frontend

1. Search de canales funcional (hoy solo UI).
2. Resolver datos reales de usuarios (nombre/avatar/email por `sender_id`) en lugar de fallback.
3. Mejorar UX de errores con toasts apilables (hoy se usa banner global simple).
4. Refinar acciones de moderacion por rol en UI (deshabilitar/ocultar acciones no permitidas de forma consistente).
5. Indicadores de carga por accion (editar, borrar, crear canal) para evitar doble click.

## Realtime y sincronizacion

1. Reconciliacion incremental al reconectar WS (refetch de mensajes recientes por canal activo).
2. Dedupe mas estricto para eventos WS duplicados en escenarios de reconexion.
3. Estrategia de reintentos con telemetry para fallos recurrentes de websocket.

## Adjuntos

1. Progreso real de subida por archivo (hoy solo estados basicos).
2. Cancelacion real de upload en curso con `AbortController`/cancel token.
3. Renovacion automatica de `download_url` cuando expire.

## Calidad y testing

1. Tests E2E de flujos principales: login, canales, mensajes, thread, adjuntos.
2. Tests de contratos de comandos Tauri desde frontend (mocks/integration harness).
3. Pipeline CI con `vue-tsc`, `cargo check`, `cargo test` y smoke de build Tauri.
