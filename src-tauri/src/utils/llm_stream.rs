//! Shared SSE streaming utilities for LLM providers.
//!
//! Parses Server-Sent Events (SSE) from OpenAI-compatible, Anthropic,
//! Gemini, and Ollama streaming endpoints, emitting text deltas via
//! a caller-supplied callback.

use futures_util::StreamExt;
use reqwest::Response;

/// Parse an SSE stream from an OpenAI-compatible chat/completions endpoint.
/// Calls `on_chunk` for each text delta.
pub async fn stream_openai_compatible<F>(
    response: Response,
    on_chunk: &mut F,
) -> Result<String, String>
where
    F: FnMut(&str) + Send,
{
    let mut stream = response.bytes_stream();
    let mut accumulated = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if data == "[DONE]" {
                    return Ok(accumulated);
                }
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = parsed
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"))
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        accumulated.push_str(delta);
                        on_chunk(delta);
                    }
                }
            }
        }
    }

    Ok(accumulated)
}

/// Parse an SSE stream from Anthropic's messages endpoint.
/// Calls `on_chunk` for each text delta.
pub async fn stream_anthropic<F>(response: Response, on_chunk: &mut F) -> Result<String, String>
where
    F: FnMut(&str) + Send,
{
    let mut stream = response.bytes_stream();
    let mut accumulated = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    match event_type {
                        "content_block_delta" => {
                            if let Some(text) = parsed
                                .get("delta")
                                .and_then(|d| d.get("text"))
                                .and_then(|t| t.as_str())
                            {
                                accumulated.push_str(text);
                                on_chunk(text);
                            }
                        }
                        "message_stop" => {
                            return Ok(accumulated);
                        }
                        "error" => {
                            let msg = parsed
                                .get("error")
                                .and_then(|e| e.get("message"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("Unknown Anthropic streaming error");
                            return Err(msg.to_string());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    Ok(accumulated)
}

/// Parse a streaming response from Gemini's generateContent endpoint
/// with `?alt=sse`.
pub async fn stream_gemini<F>(response: Response, on_chunk: &mut F) -> Result<String, String>
where
    F: FnMut(&str) + Send,
{
    let mut stream = response.bytes_stream();
    let mut accumulated = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(text) = parsed
                        .get("candidates")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("content"))
                        .and_then(|c| c.get("parts"))
                        .and_then(|p| p.get(0))
                        .and_then(|p| p.get("text"))
                        .and_then(|t| t.as_str())
                    {
                        accumulated.push_str(text);
                        on_chunk(text);
                    }
                }
            }
        }
    }

    Ok(accumulated)
}

/// Parse Ollama streaming response (NDJSON, one JSON object per line).
pub async fn stream_ollama<F>(response: Response, on_chunk: &mut F) -> Result<String, String>
where
    F: FnMut(&str) + Send,
{
    let mut stream = response.bytes_stream();
    let mut accumulated = String::new();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim_end_matches('\r').to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.trim().is_empty() {
                continue;
            }
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(line.trim()) {
                if let Some(err) = parsed.get("error").and_then(|e| e.as_str()) {
                    if !err.is_empty() {
                        return Err(format!("Ollama error: {err}"));
                    }
                }
                if let Some(text) = parsed
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                {
                    if !text.is_empty() {
                        accumulated.push_str(text);
                        on_chunk(text);
                    }
                }
                if parsed
                    .get("done")
                    .and_then(|d| d.as_bool())
                    .unwrap_or(false)
                {
                    return Ok(accumulated);
                }
            }
        }
    }

    Ok(accumulated)
}
