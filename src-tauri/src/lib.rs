use futures_util::StreamExt;
use reqwest::{Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::{
    collections::HashMap,
    sync::{Arc, OnceLock},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_store::StoreExt;
use thiserror::Error;
use tokio::sync::{oneshot, Mutex, RwLock};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;

const DEFAULT_API_BASE: &str = "http://localhost:3000/api/v1";
const TOKEN_STORE_FILE: &str = "secure-tokens.bin";
const TOKEN_STORE_KEY: &str = "auth_tokens";
const API_BASE_STORE_KEY: &str = "api_base";
const ENCRYPTION_KEY_FALLBACK: &[u8] = b"galynx-desktop-store-v1";
static ENCRYPTION_KEY_BYTES: OnceLock<Vec<u8>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TokenBundle {
    access_token: String,
    refresh_token: String,
    access_expires_at: i64,
    refresh_expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UserDto {
    id: String,
    email: String,
    name: String,
    workspace_id: String,
    role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AuthSessionDto {
    access_token: String,
    refresh_token: String,
    access_expires_at: i64,
    refresh_expires_at: i64,
    user: UserDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChannelDto {
    id: String,
    workspace_id: String,
    name: String,
    is_private: bool,
    created_by: String,
    created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MessageDto {
    id: String,
    workspace_id: String,
    channel_id: String,
    sender_id: String,
    body_md: String,
    thread_root_id: Option<String>,
    created_at: i64,
    edited_at: Option<i64>,
    deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MessageListDto {
    items: Vec<MessageDto>,
    next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThreadSummaryDto {
    root_message: MessageDto,
    reply_count: i64,
    last_reply_at: Option<i64>,
    participants: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LoginPayload {
    email: String,
    password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CreateChannelPayload {
    name: String,
    is_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SendMessagePayload {
    channel_id: String,
    body_md: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EditMessagePayload {
    message_id: String,
    body_md: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SendThreadReplyPayload {
    root_id: String,
    body_md: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AttachmentUploadPayload {
    channel_id: String,
    message_id: String,
    filename: String,
    content_type: String,
    size_bytes: i64,
    bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AttachmentPresignResponse {
    upload_id: String,
    upload_url: String,
    key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AttachmentDto {
    id: String,
    name: String,
    size_bytes: i64,
    content_type: Option<String>,
    storage_key: Option<String>,
    download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ListMessagesPayload {
    channel_id: String,
    limit: Option<u32>,
    cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ListThreadRepliesPayload {
    root_id: String,
    limit: Option<u32>,
    cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeleteChannelPayload {
    channel_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeleteMessagePayload {
    message_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThreadGetPayload {
    root_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ApiBasePayload {
    api_base: String,
}

#[derive(Debug, Clone, Serialize)]
struct ApiErrorDto {
    status: u16,
    error: String,
    message: String,
}

#[derive(Debug, Error)]
enum ApiError {
    #[error("network request failed: {0}")]
    Network(String),
    #[error("api returned error ({status}): {error} {message}")]
    Http {
        status: u16,
        error: String,
        message: String,
    },
    #[error("unauthenticated")]
    Unauthenticated,
    #[error("invalid response: {0}")]
    InvalidResponse(String),
    #[error("storage error: {0}")]
    Storage(String),
    #[error("realtime error: {0}")]
    Realtime(String),
}

impl From<ApiError> for ApiErrorDto {
    fn from(value: ApiError) -> Self {
        match value {
            ApiError::Http {
                status,
                error,
                message,
            } => Self {
                status,
                error,
                message,
            },
            ApiError::Unauthenticated => Self {
                status: 401,
                error: "unauthorized".to_string(),
                message: "You must sign in again.".to_string(),
            },
            other => Self {
                status: 500,
                error: "internal_error".to_string(),
                message: other.to_string(),
            },
        }
    }
}

type CmdResult<T> = Result<T, ApiErrorDto>;

#[derive(Clone)]
struct AppState {
    app: AppHandle,
    client: reqwest::Client,
    api_base: Arc<RwLock<String>>,
    tokens: Arc<RwLock<Option<TokenBundle>>>,
    refresh_lock: Arc<Mutex<()>>,
    ws_shutdown: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

fn normalize_api_base(value: &str) -> Option<String> {
    let mut base = value.trim().trim_end_matches('/').to_string();
    if base.is_empty() {
        return None;
    }

    if !base.starts_with("http://") && !base.starts_with("https://") {
        return None;
    }

    if !base.ends_with("/api/v1") {
        if base.ends_with("/api") {
            base.push_str("/v1");
        } else {
            base.push_str("/api/v1");
        }
    }

    Some(base)
}

fn derive_encryption_key(seed: &str) -> Vec<u8> {
    let mut key = vec![0_u8; 32];
    let mut h: u64 = 1469598103934665603;
    for byte in seed.as_bytes() {
        h ^= *byte as u64;
        h = h.wrapping_mul(1099511628211);
    }
    for (idx, slot) in key.iter_mut().enumerate() {
        h ^= ((idx as u64) << 8) | 0x9e37;
        h = h.wrapping_mul(1099511628211);
        *slot = (h & 0xff) as u8;
    }
    key
}

fn initialize_encryption_key(app: &AppHandle) {
    let seed = format!(
        "{}|{}|{}|{}",
        app.config().identifier,
        std::env::consts::OS,
        std::env::var("USER").unwrap_or_default(),
        app.path()
            .app_data_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    );
    let _ = ENCRYPTION_KEY_BYTES.set(derive_encryption_key(&seed));
}

fn active_encryption_key() -> &'static [u8] {
    ENCRYPTION_KEY_BYTES
        .get()
        .map(|k| k.as_slice())
        .unwrap_or(ENCRYPTION_KEY_FALLBACK)
}

fn xor_crypt(input: &[u8]) -> Vec<u8> {
    let key = active_encryption_key();
    input
        .iter()
        .enumerate()
        .map(|(idx, byte)| byte ^ key[idx % key.len()])
        .collect()
}

fn serialize_encrypted(
    cache: &HashMap<String, JsonValue>,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let serialized = serde_json::to_vec(cache)?;
    Ok(xor_crypt(&serialized))
}

fn deserialize_encrypted(
    bytes: &[u8],
) -> Result<HashMap<String, JsonValue>, Box<dyn std::error::Error + Send + Sync>> {
    let decrypted = xor_crypt(bytes);
    Ok(serde_json::from_slice(&decrypted)?)
}

fn map_attachment_commit_response(
    commit_raw: JsonValue,
    fallback_name: String,
    fallback_size: i64,
    fallback_type: String,
    fallback_key: Option<String>,
) -> AttachmentDto {
    let id = commit_raw
        .get("id")
        .and_then(JsonValue::as_str)
        .unwrap_or("attachment")
        .to_string();
    let name = commit_raw
        .get("filename")
        .or_else(|| commit_raw.get("name"))
        .and_then(JsonValue::as_str)
        .unwrap_or(&fallback_name)
        .to_string();
    let size_bytes = commit_raw
        .get("size_bytes")
        .or_else(|| commit_raw.get("size"))
        .and_then(JsonValue::as_i64)
        .unwrap_or(fallback_size);
    let content_type = commit_raw
        .get("content_type")
        .and_then(JsonValue::as_str)
        .map(ToString::to_string)
        .or(Some(fallback_type));
    let storage_key = commit_raw
        .get("storage_key")
        .or_else(|| commit_raw.get("key"))
        .and_then(JsonValue::as_str)
        .map(ToString::to_string)
        .or(fallback_key);
    let download_url = commit_raw
        .get("download_url")
        .and_then(JsonValue::as_str)
        .map(ToString::to_string);

    AttachmentDto {
        id,
        name,
        size_bytes,
        content_type,
        storage_key,
        download_url,
    }
}

fn load_api_base_from_store_for_app(app: &AppHandle) -> Option<String> {
    let store = app
        .store_builder(TOKEN_STORE_FILE)
        .serialize(serialize_encrypted)
        .deserialize(deserialize_encrypted)
        .build()
        .ok()?;
    let raw = store
        .get(API_BASE_STORE_KEY)
        .and_then(|value| value.as_str().map(ToString::to_string))?;
    normalize_api_base(&raw)
}

impl AppState {
    async fn current_api_base(&self) -> String {
        self.api_base.read().await.clone()
    }

    async fn endpoint(&self, path: &str) -> String {
        format!("{}{}", self.current_api_base().await, path)
    }

    fn get_secure_store(&self) -> Result<Arc<tauri_plugin_store::Store<tauri::Wry>>, ApiError> {
        self.app
            .store_builder(TOKEN_STORE_FILE)
            .serialize(serialize_encrypted)
            .deserialize(deserialize_encrypted)
            .build()
            .map_err(|err| ApiError::Storage(err.to_string()))
    }

    async fn persist_api_base(&self, api_base: &str) -> Result<(), ApiError> {
        let store = self.get_secure_store()?;
        store.set(API_BASE_STORE_KEY, JsonValue::String(api_base.to_string()));
        store
            .save()
            .map_err(|err| ApiError::Storage(format!("could not save api_base: {err}")))?;
        Ok(())
    }

    async fn set_api_base(&self, api_base: &str) -> Result<String, ApiError> {
        let normalized = normalize_api_base(api_base)
            .ok_or_else(|| ApiError::InvalidResponse("invalid API base URL".to_string()))?;
        self.persist_api_base(&normalized).await?;
        *self.api_base.write().await = normalized.clone();
        Ok(normalized)
    }

    async fn load_tokens_from_store(&self) -> Result<Option<TokenBundle>, ApiError> {
        let store = self.get_secure_store()?;

        let value = match store.get(TOKEN_STORE_KEY) {
            Some(value) => value,
            None => return Ok(None),
        };

        serde_json::from_value(value)
            .map(Some)
            .map_err(|err| ApiError::Storage(format!("could not deserialize stored tokens: {err}")))
    }

    async fn persist_tokens(&self, tokens: &TokenBundle) -> Result<(), ApiError> {
        let store = self.get_secure_store()?;

        let value = serde_json::to_value(tokens)
            .map_err(|err| ApiError::Storage(format!("could not serialize tokens: {err}")))?;

        store.set(TOKEN_STORE_KEY, value);
        store
            .save()
            .map_err(|err| ApiError::Storage(format!("could not save token store: {err}")))?;
        Ok(())
    }

    async fn clear_tokens(&self) -> Result<(), ApiError> {
        let store = self.get_secure_store()?;

        store.delete(TOKEN_STORE_KEY);
        store
            .save()
            .map_err(|err| ApiError::Storage(format!("could not save token store: {err}")))?;
        *self.tokens.write().await = None;
        Ok(())
    }

    async fn get_tokens(&self) -> Result<Option<TokenBundle>, ApiError> {
        if let Some(tokens) = self.tokens.read().await.clone() {
            return Ok(Some(tokens));
        }

        let loaded = self.load_tokens_from_store().await?;
        *self.tokens.write().await = loaded.clone();
        Ok(loaded)
    }

    async fn require_tokens(&self) -> Result<TokenBundle, ApiError> {
        self.get_tokens().await?.ok_or(ApiError::Unauthenticated)
    }

    async fn send_json(
        &self,
        method: Method,
        path: &str,
        body: Option<JsonValue>,
        auth_required: bool,
    ) -> Result<JsonValue, ApiError> {
        let mut refreshed_once = false;
        let mut rate_retry = 0_u8;

        loop {
            let mut req = self.client.request(method.clone(), self.endpoint(path).await);

            if auth_required {
                let tokens = self.require_tokens().await?;
                req = req.bearer_auth(tokens.access_token);
            }

            if let Some(ref payload) = body {
                req = req.json(payload);
            }

            let resp = req
                .send()
                .await
                .map_err(|err| ApiError::Network(err.to_string()))?;

            if resp.status() == StatusCode::UNAUTHORIZED && auth_required && !refreshed_once {
                self.refresh_tokens().await?;
                refreshed_once = true;
                continue;
            }

            if resp.status() == StatusCode::TOO_MANY_REQUESTS && rate_retry < 2 {
                let wait_ms = 200_u64 * 2_u64.pow(rate_retry.into());
                tokio::time::sleep(Duration::from_millis(wait_ms)).await;
                rate_retry += 1;
                continue;
            }

            if resp.status() == StatusCode::NO_CONTENT {
                return Ok(JsonValue::Null);
            }

            let status = resp.status().as_u16();
            let text = resp
                .text()
                .await
                .map_err(|err| ApiError::Network(err.to_string()))?;

            if !(200..300).contains(&status) {
                if let Ok(err_json) = serde_json::from_str::<JsonValue>(&text) {
                    let error = err_json
                        .get("error")
                        .and_then(JsonValue::as_str)
                        .unwrap_or("unknown_error")
                        .to_string();
                    let message = err_json
                        .get("message")
                        .and_then(JsonValue::as_str)
                        .unwrap_or("Request failed")
                        .to_string();
                    return Err(ApiError::Http {
                        status,
                        error,
                        message,
                    });
                }

                return Err(ApiError::Http {
                    status,
                    error: "http_error".to_string(),
                    message: text,
                });
            }

            if text.is_empty() {
                return Ok(JsonValue::Null);
            }

            return serde_json::from_str(&text).map_err(|err| {
                ApiError::InvalidResponse(format!("failed to decode json body: {err}"))
            });
        }
    }

    async fn refresh_tokens(&self) -> Result<(), ApiError> {
        let _guard = self.refresh_lock.lock().await;

        let current = self.require_tokens().await?;
        let payload = json!({ "refresh_token": current.refresh_token });

        let resp = self
            .client
            .request(Method::POST, self.endpoint("/auth/refresh").await)
            .json(&payload)
            .send()
            .await
            .map_err(|err| ApiError::Network(err.to_string()))?;
        let status = resp.status().as_u16();
        let text = resp
            .text()
            .await
            .map_err(|err| ApiError::Network(err.to_string()))?;
        if !(200..300).contains(&status) {
            if let Ok(err_json) = serde_json::from_str::<JsonValue>(&text) {
                let error = err_json
                    .get("error")
                    .and_then(JsonValue::as_str)
                    .unwrap_or("unauthorized")
                    .to_string();
                let message = err_json
                    .get("message")
                    .and_then(JsonValue::as_str)
                    .unwrap_or("refresh failed")
                    .to_string();
                return Err(ApiError::Http {
                    status,
                    error,
                    message,
                });
            }
            return Err(ApiError::Http {
                status,
                error: "refresh_failed".to_string(),
                message: text,
            });
        }

        let refreshed: JsonValue = serde_json::from_str(&text)
            .map_err(|err| ApiError::InvalidResponse(format!("refresh response invalid: {err}")))?;

        let tokens: TokenBundle = serde_json::from_value(refreshed)
            .map_err(|err| ApiError::InvalidResponse(format!("refresh response invalid: {err}")))?;

        self.persist_tokens(&tokens).await?;
        *self.tokens.write().await = Some(tokens);
        Ok(())
    }

    async fn validate_stored_session(&self) {
        let tokens = match self.get_tokens().await {
            Ok(value) => value,
            Err(err) => {
                log::warn!("could not load stored session: {err}");
                return;
            }
        };

        if tokens.is_none() {
            return;
        }

        if let Err(err) = self.send_json(Method::GET, "/me", None, true).await {
            log::warn!("stored session invalid, clearing tokens: {err}");
            let _ = self.clear_tokens().await;
        }
    }

    async fn upload_attachment_for_message(
        &self,
        payload: AttachmentUploadPayload,
    ) -> Result<AttachmentDto, ApiError> {
        let presign_raw = self
            .send_json(
                Method::POST,
                "/attachments/presign",
                Some(json!({
                    "channel_id": payload.channel_id,
                    "filename": payload.filename,
                    "content_type": payload.content_type,
                    "size_bytes": payload.size_bytes
                })),
                true,
            )
            .await?;

        let presign: AttachmentPresignResponse = serde_json::from_value(presign_raw)
            .map_err(|err| ApiError::InvalidResponse(err.to_string()))?;

        let upload_resp = self
            .client
            .request(Method::PUT, presign.upload_url.clone())
            .header("Content-Type", payload.content_type.clone())
            .body(payload.bytes)
            .send()
            .await
            .map_err(|err| ApiError::Network(err.to_string()))?;

        if !upload_resp.status().is_success() {
            return Err(ApiError::Http {
                status: upload_resp.status().as_u16(),
                error: "upload_failed".to_string(),
                message: "binary upload failed".to_string(),
            });
        }

        let commit_raw = self
            .send_json(
                Method::POST,
                "/attachments/commit",
                Some(json!({
                    "upload_id": presign.upload_id,
                    "message_id": payload.message_id
                })),
                true,
            )
            .await?;
        Ok(map_attachment_commit_response(
            commit_raw,
            payload.filename,
            payload.size_bytes,
            payload.content_type,
            presign.key,
        ))
    }
}

#[tauri::command]
async fn auth_login(
    state: State<'_, AppState>,
    payload: LoginPayload,
) -> CmdResult<AuthSessionDto> {
    let body = json!({
      "email": payload.email,
      "password": payload.password
    });

    let tokens_value = state
        .send_json(Method::POST, "/auth/login", Some(body), false)
        .await
        .map_err(ApiErrorDto::from)?;

    let tokens: TokenBundle = serde_json::from_value(tokens_value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))?;

    state
        .persist_tokens(&tokens)
        .await
        .map_err(ApiErrorDto::from)?;
    *state.tokens.write().await = Some(tokens.clone());

    let me_value = state
        .send_json(Method::GET, "/me", None, true)
        .await
        .map_err(ApiErrorDto::from)?;
    let user: UserDto = serde_json::from_value(me_value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))?;

    Ok(AuthSessionDto {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_expires_at: tokens.access_expires_at,
        refresh_expires_at: tokens.refresh_expires_at,
        user,
    })
}

#[tauri::command]
async fn auth_me(state: State<'_, AppState>) -> CmdResult<UserDto> {
    let me_value = state
        .send_json(Method::GET, "/me", None, true)
        .await
        .map_err(ApiErrorDto::from)?;
    serde_json::from_value(me_value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn auth_logout(state: State<'_, AppState>) -> CmdResult<()> {
    if let Ok(tokens) = state.require_tokens().await {
        let _ = state
            .send_json(
                Method::POST,
                "/auth/logout",
                Some(json!({ "refresh_token": tokens.refresh_token })),
                false,
            )
            .await;
    }

    state.clear_tokens().await.map_err(ApiErrorDto::from)?;
    Ok(())
}

#[tauri::command]
async fn channels_list(state: State<'_, AppState>) -> CmdResult<Vec<ChannelDto>> {
    let value = state
        .send_json(Method::GET, "/channels", None, true)
        .await
        .map_err(ApiErrorDto::from)?;
    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn channels_create(
    state: State<'_, AppState>,
    payload: CreateChannelPayload,
) -> CmdResult<ChannelDto> {
    let value = state
        .send_json(
            Method::POST,
            "/channels",
            Some(json!({ "name": payload.name, "is_private": payload.is_private })),
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;
    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn channels_delete(
    state: State<'_, AppState>,
    payload: DeleteChannelPayload,
) -> CmdResult<()> {
    state
        .send_json(
            Method::DELETE,
            &format!("/channels/{}", payload.channel_id),
            None,
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;
    Ok(())
}

#[tauri::command]
async fn messages_list(
    state: State<'_, AppState>,
    payload: ListMessagesPayload,
) -> CmdResult<MessageListDto> {
    let mut path = format!(
        "/channels/{}/messages?limit={}",
        payload.channel_id,
        payload.limit.unwrap_or(50).clamp(1, 100)
    );
    if let Some(cursor) = payload.cursor {
        path.push_str("&cursor=");
        path.push_str(&cursor);
    }

    let value = state
        .send_json(Method::GET, &path, None, true)
        .await
        .map_err(ApiErrorDto::from)?;

    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn messages_send(
    state: State<'_, AppState>,
    payload: SendMessagePayload,
) -> CmdResult<MessageDto> {
    let value = state
        .send_json(
            Method::POST,
            &format!("/channels/{}/messages", payload.channel_id),
            Some(json!({ "body_md": payload.body_md })),
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;
    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn attachments_upload_commit(
    state: State<'_, AppState>,
    payload: AttachmentUploadPayload,
) -> CmdResult<AttachmentDto> {
    state
        .upload_attachment_for_message(payload)
        .await
        .map_err(ApiErrorDto::from)
}

#[tauri::command]
async fn messages_edit(
    state: State<'_, AppState>,
    payload: EditMessagePayload,
) -> CmdResult<MessageDto> {
    let value = state
        .send_json(
            Method::PATCH,
            &format!("/messages/{}", payload.message_id),
            Some(json!({ "body_md": payload.body_md })),
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;
    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn messages_delete(
    state: State<'_, AppState>,
    payload: DeleteMessagePayload,
) -> CmdResult<()> {
    state
        .send_json(
            Method::DELETE,
            &format!("/messages/{}", payload.message_id),
            None,
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;
    Ok(())
}

#[tauri::command]
async fn thread_get(
    state: State<'_, AppState>,
    payload: ThreadGetPayload,
) -> CmdResult<ThreadSummaryDto> {
    let value = state
        .send_json(
            Method::GET,
            &format!("/threads/{}", payload.root_id),
            None,
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;

    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn thread_replies_list(
    state: State<'_, AppState>,
    payload: ListThreadRepliesPayload,
) -> CmdResult<MessageListDto> {
    let mut path = format!(
        "/threads/{}/replies?limit={}",
        payload.root_id,
        payload.limit.unwrap_or(50).clamp(1, 100)
    );
    if let Some(cursor) = payload.cursor {
        path.push_str("&cursor=");
        path.push_str(&cursor);
    }

    let value = state
        .send_json(Method::GET, &path, None, true)
        .await
        .map_err(ApiErrorDto::from)?;

    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn thread_reply_send(
    state: State<'_, AppState>,
    payload: SendThreadReplyPayload,
) -> CmdResult<MessageDto> {
    let value = state
        .send_json(
            Method::POST,
            &format!("/threads/{}/replies", payload.root_id),
            Some(json!({ "body_md": payload.body_md })),
            true,
        )
        .await
        .map_err(ApiErrorDto::from)?;
    serde_json::from_value(value)
        .map_err(|err| ApiErrorDto::from(ApiError::InvalidResponse(err.to_string())))
}

#[tauri::command]
async fn settings_get_api_base(state: State<'_, AppState>) -> CmdResult<String> {
    Ok(state.current_api_base().await)
}

#[tauri::command]
async fn settings_set_api_base(state: State<'_, AppState>, payload: ApiBasePayload) -> CmdResult<String> {
    state.set_api_base(&payload.api_base).await.map_err(ApiErrorDto::from)
}

fn websocket_url(api_base: &str) -> String {
    let url = api_base.trim_end_matches('/');
    if let Some(rest) = url.strip_prefix("https://") {
        return format!("wss://{rest}/ws");
    }
    if let Some(rest) = url.strip_prefix("http://") {
        return format!("ws://{rest}/ws");
    }
    format!("ws://{}/ws", url)
}

async fn ws_emit<R: Runtime, S: Serialize + Clone>(app: &AppHandle<R>, event: &str, payload: S) {
    if let Err(err) = app.emit(event, payload) {
        log::warn!("failed to emit event {event}: {err}");
    }
}

async fn run_ws_loop(state: AppState, app: AppHandle, mut shutdown_rx: oneshot::Receiver<()>) {
    let mut retry_seconds = 1_u64;

    loop {
        let current_base = state.current_api_base().await;
        let ws_url = websocket_url(&current_base);
        ws_emit(&app, "realtime:status", json!({ "status": "reconnecting" })).await;
        let tokens = match state.require_tokens().await {
            Ok(tokens) => tokens,
            Err(_) => {
                ws_emit(&app, "realtime:status", json!({ "status": "offline" })).await;
                return;
            }
        };

        let request = match ws_url
            .as_str()
            .into_client_request()
            .map_err(|err| ApiError::Realtime(err.to_string()))
        {
            Ok(mut request) => {
                if let Ok(header_value) = format!("Bearer {}", tokens.access_token).parse() {
                    request.headers_mut().insert("Authorization", header_value);
                }
                request
            }
            Err(err) => {
                log::warn!("could not create ws request: {err}");
                ws_emit(&app, "realtime:status", json!({ "status": "offline" })).await;
                return;
            }
        };

        match tokio_tungstenite::connect_async(request).await {
            Ok((socket, _)) => {
                retry_seconds = 1;
                ws_emit(&app, "realtime:status", json!({ "status": "online" })).await;
                let (_, mut reader) = socket.split();

                loop {
                    tokio::select! {
                      _ = &mut shutdown_rx => {
                        ws_emit(&app, "realtime:status", json!({ "status": "offline" })).await;
                        return;
                      }
                      message = reader.next() => {
                        match message {
                          Some(Ok(msg)) if msg.is_text() => {
                            if let Ok(text) = msg.to_text() {
                              if let Ok(payload) = serde_json::from_str::<JsonValue>(text) {
                                ws_emit(&app, "realtime:event", &payload).await;
                                if let Some(event_type) = payload.get("event_type").and_then(JsonValue::as_str) {
                                  ws_emit(&app, &format!("realtime:{event_type}"), &payload).await;
                                }
                              }
                            }
                          }
                          Some(Ok(msg)) if msg.is_close() => break,
                          Some(Ok(_)) => {}
                          Some(Err(err)) => {
                            log::warn!("ws receive error: {err}");
                            break;
                          }
                          None => break,
                        }
                      }
                    }
                }
            }
            Err(err) => {
                log::warn!("ws connect failed: {err}");
            }
        }

        tokio::select! {
          _ = &mut shutdown_rx => {
            ws_emit(&app, "realtime:status", json!({ "status": "offline" })).await;
            return;
          }
          _ = tokio::time::sleep(Duration::from_secs(retry_seconds)) => {
            retry_seconds = (retry_seconds * 2).min(30);
          }
        }
    }
}

#[tauri::command]
async fn realtime_connect(state: State<'_, AppState>) -> CmdResult<()> {
    let mut guard = state.ws_shutdown.lock().await;
    if guard.is_some() {
        return Ok(());
    }

    let (tx, rx) = oneshot::channel();
    *guard = Some(tx);

    let state_clone = state.inner().clone();
    let app = state.app.clone();
    tauri::async_runtime::spawn(async move {
        run_ws_loop(state_clone, app, rx).await;
    });

    Ok(())
}

#[tauri::command]
async fn realtime_disconnect(state: State<'_, AppState>) -> CmdResult<()> {
    if let Some(tx) = state.ws_shutdown.lock().await.take() {
        let _ = tx.send(());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            initialize_encryption_key(app.handle());

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let env_api_base = std::env::var("GALYNX_API_BASE")
                .ok()
                .and_then(|value| normalize_api_base(&value));
            let stored_api_base = load_api_base_from_store_for_app(app.handle());
            let api_base = env_api_base
                .or(stored_api_base)
                .unwrap_or_else(|| DEFAULT_API_BASE.to_string());
            let client = reqwest::Client::builder()
                .build()
                .map_err(|err| tauri::Error::Anyhow(err.into()))?;

            let state = AppState {
                app: app.handle().clone(),
                client,
                api_base: Arc::new(RwLock::new(api_base)),
                tokens: Arc::new(RwLock::new(None)),
                refresh_lock: Arc::new(Mutex::new(())),
                ws_shutdown: Arc::new(Mutex::new(None)),
            };

            app.manage(state.clone());
            tauri::async_runtime::spawn(async move {
                state.validate_stored_session().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_login,
            auth_me,
            auth_logout,
            channels_list,
            channels_create,
            channels_delete,
            messages_list,
            messages_send,
            attachments_upload_commit,
            messages_edit,
            messages_delete,
            thread_get,
            thread_replies_list,
            thread_reply_send,
            settings_get_api_base,
            settings_set_api_base,
            realtime_connect,
            realtime_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn websocket_url_converts_http_and_https() {
        assert_eq!(
            websocket_url("http://localhost:3000/api/v1"),
            "ws://localhost:3000/api/v1/ws"
        );
        assert_eq!(
            websocket_url("https://api.galynx.local/api/v1"),
            "wss://api.galynx.local/api/v1/ws"
        );
    }

    #[test]
    fn derived_key_is_stable_for_same_seed() {
        let a = derive_encryption_key("seed-a");
        let b = derive_encryption_key("seed-a");
        let c = derive_encryption_key("seed-b");
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 32);
    }

    #[test]
    fn xor_crypt_roundtrip() {
        let input = b"top-secret-token-data";
        let encrypted = xor_crypt(input);
        let decrypted = xor_crypt(&encrypted);
        assert_eq!(input.to_vec(), decrypted);
    }

    #[test]
    fn attachment_commit_mapper_uses_fallbacks() {
        let mapped = map_attachment_commit_response(
            json!({ "id": "att-1" }),
            "report.pdf".to_string(),
            1200,
            "application/pdf".to_string(),
            Some("workspace/key".to_string()),
        );
        assert_eq!(mapped.id, "att-1");
        assert_eq!(mapped.name, "report.pdf");
        assert_eq!(mapped.size_bytes, 1200);
        assert_eq!(mapped.content_type.as_deref(), Some("application/pdf"));
        assert_eq!(mapped.storage_key.as_deref(), Some("workspace/key"));
    }

    #[test]
    fn api_base_normalization() {
        assert_eq!(
            normalize_api_base("http://localhost:3000").as_deref(),
            Some("http://localhost:3000/api/v1")
        );
        assert_eq!(
            normalize_api_base("https://galynx.local/api/").as_deref(),
            Some("https://galynx.local/api/v1")
        );
        assert_eq!(
            normalize_api_base("https://galynx.local/api/v1").as_deref(),
            Some("https://galynx.local/api/v1")
        );
        assert!(normalize_api_base("localhost:3000").is_none());
    }
}
