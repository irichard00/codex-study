# Rust Implementation Patterns to Replicate

**Source**: `codex-rs/core/src/client.rs`
**Target**: `codex-chrome/src/models/`
**Purpose**: Document key patterns from Rust implementation for TypeScript port

## 1. Method Signatures (Lines 111-454)

### Core Public Methods

#### getModelContextWindow() - Line 111-115
```rust
pub fn get_model_context_window(&self) -> Option<u64> {
    self.config
        .model_context_window
        .or_else(|| get_model_info(&self.config.model_family).map(|info| info.context_window))
}
```
**TypeScript equivalent**:
```typescript
getModelContextWindow(): number | undefined {
  return this.config.modelContextWindow ??
    getModelInfo(this.config.modelFamily)?.contextWindow;
}
```

#### getAutoCompactTokenLimit() - Line 117-121
```rust
pub fn get_auto_compact_token_limit(&self) -> Option<i64> {
    self.config.model_auto_compact_token_limit.or_else(|| {
        get_model_info(&self.config.model_family).and_then(|info| info.auto_compact_token_limit)
    })
}
```
**TypeScript equivalent**:
```typescript
getAutoCompactTokenLimit(): number | undefined {
  return this.config.modelAutoCompactTokenLimit ??
    getModelInfo(this.config.modelFamily)?.autoCompactTokenLimit;
}
```

#### stream() - Line 126-166
```rust
pub async fn stream(&self, prompt: &Prompt) -> Result<ResponseStream> {
    match self.provider.wire_api {
        WireApi::Responses => self.stream_responses(prompt).await,
        WireApi::Chat => {
            // Aggregation logic for Chat Completions
            // ...
        }
    }
}
```
**Key Pattern**: Dispatch based on `wire_api` setting
- `Responses` → Direct Responses API
- `Chat` → Aggregated Chat Completions

**TypeScript equivalent**:
```typescript
async stream(prompt: Prompt): Promise<ResponseStream> {
  switch (this.provider.wireApi) {
    case 'Responses':
      return this.streamResponses(prompt);
    case 'Chat':
      return this.streamChatAggregated(prompt);
  }
}
```

## 2. SSE Processing (Lines 637-860)

### Event Processing Flow

#### Initial Setup - Line 637-665
```rust
async fn process_sse(
    resp: Response,
    provider: ModelProviderInfo,
    otel_event_manager: OtelEventManager,
) -> Result<ResponseStream> {
    let (tx_event, rx_event) = mpsc::channel::<Result<ResponseEvent>>(1600);

    // Parse rate limits from headers FIRST
    if let Some(snapshot) = parse_rate_limit_snapshot(resp.headers()) {
        let _ = tx_event.send(Ok(ResponseEvent::RateLimits { snapshot })).await;
    }

    // Then process body events
    let body_stream = resp.bytes_stream();
    // ...
}
```

**Key Pattern**: Rate limits yielded FIRST, then stream events

#### SSE Line Processing - Line 679-712
```rust
let mut lines = stream.lines();
while let Some(line) = lines.next().await {
    let line = line?;

    if line.starts_with("data: ") {
        let data = &line[6..]; // Remove "data: " prefix

        if data == "[DONE]" {
            break;
        }

        let event: SseEvent = serde_json::from_str(data)?;
        // Process event...
    }
}
```

**Key Pattern**:
- Strip "data: " prefix
- Check for [DONE] signal
- Parse JSON
- Process event by type

#### Event Type Mapping - Line 715-858
```rust
match event.r#type.as_str() {
    "response.created" => {
        tx_event.send(Ok(ResponseEvent::Created)).await?;
    }
    "response.output_item.done" => {
        if let Some(item) = event.item {
            tx_event.send(Ok(ResponseEvent::OutputItemDone { item })).await?;
        }
    }
    "response.output_text.delta" => {
        if let Some(delta) = event.delta {
            tx_event.send(Ok(ResponseEvent::OutputTextDelta { delta })).await?;
        }
    }
    "response.reasoning_summary_text.delta" => {
        if let Some(delta) = event.delta {
            tx_event.send(Ok(ResponseEvent::ReasoningSummaryDelta { delta })).await?;
        }
    }
    "response.reasoning_text.delta" => {
        if let Some(delta) = event.delta {
            tx_event.send(Ok(ResponseEvent::ReasoningContentDelta { delta })).await?;
        }
    }
    "response.completed" => {
        // Store for yielding at END
        response_completed = Some(event.response);
    }
    "response.failed" => {
        let error_msg = event.response
            .and_then(|r| r.error)
            .and_then(|e| e.message)
            .unwrap_or_else(|| "Response failed".to_string());
        return Err(CodexErr::UnexpectedResponse(error_msg));
    }
    // Ignored events
    "response.in_progress" | "response.output_text.done" | ... => {}
    _ => {
        debug!("Unknown SSE event type: {}", event.r#type);
    }
}
```

**Key Pattern**:
- Completed event STORED, not yielded immediately
- Failed event throws immediately
- Some events ignored (in_progress, etc.)

#### Stream Completion - Line 811-824
```rust
// After stream ends
if let Some(completed) = response_completed {
    tx_event.send(Ok(ResponseEvent::Completed {
        response_id: completed.id,
        token_usage: completed.usage.map(convert_token_usage),
    })).await?;
} else {
    return Err(CodexErr::UnexpectedResponse("Stream ended without completed event"));
}
```

**Key Pattern**: Completed event yielded LAST, after all other events

## 3. Retry Logic (Lines 245-264)

### Retry Loop
```rust
let max_attempts = self.provider.request_max_retries();
for attempt in 0..=max_attempts {
    match self.attempt_stream_responses(attempt, &payload_json, &auth_manager).await {
        Ok(stream) => {
            return Ok(stream);
        }
        Err(StreamAttemptError::Fatal(e)) => {
            return Err(e);  // Don't retry fatal errors
        }
        Err(retryable_attempt_error) => {
            if attempt == max_attempts {
                return Err(retryable_attempt_error.into_error());
            }

            // Sleep with exponential backoff
            tokio::time::sleep(retryable_attempt_error.delay(attempt)).await;
        }
    }
}
```

**Key Patterns**:
- Max retries from provider config
- Fatal errors exit immediately (401, 404, etc.)
- Retryable errors (429, 5xx) use backoff
- Last attempt throws error

### Error Classification - Line 457-499
```rust
enum StreamAttemptError {
    RetryableHttpError { status: StatusCode, retry_after: Option<Duration> },
    RetryableTransportError(reqwest::Error),
    Fatal(CodexErr),
}

impl StreamAttemptError {
    fn delay(&self, attempt: u64) -> Duration {
        match self {
            Self::RetryableHttpError { retry_after: Some(d), .. } => *d,
            _ => backoff(attempt),
        }
    }
}
```

**Key Patterns**:
- 429 with Retry-After → use server delay
- Other retryable → use exponential backoff
- Fatal → no delay, exit immediately

### Backoff Calculation (referenced from util)
```rust
pub fn backoff(attempt: u64) -> Duration {
    let base_ms = 1000;
    let max_ms = 32000;
    let jitter = rand::random::<f64>() * 0.1; // 10% jitter

    let delay_ms = (base_ms * 2_u64.pow(attempt as u32)).min(max_ms);
    let jittered = delay_ms as f64 * (1.0 + jitter);

    Duration::from_millis(jittered as u64)
}
```

**Key Pattern**: Exponential backoff with jitter capped at max delay

## 4. Request Headers (Lines 286-305)

### Header Construction
```rust
let mut req_builder = self
    .provider
    .create_request_builder(&self.client, &auth)
    .await
    .json(payload_json);

// OpenAI-specific headers
if let Some(org_id) = &self.provider.openai_organization {
    req_builder = req_builder.header("OpenAI-Organization", org_id);
}

if self.provider.is_responses_api() {
    req_builder = req_builder.header("OpenAI-Beta", "responses=experimental");
}

req_builder = req_builder
    .header("conversation_id", &self.conversation_id.to_string())
    .header("session_id", &self.conversation_id.to_string());
```

**Required Headers for Responses API**:
- `Authorization: Bearer {token}`
- `OpenAI-Beta: responses=experimental`
- `conversation_id: {id}`
- `session_id: {id}`
- `Accept: text/event-stream`
- `OpenAI-Organization: {org}` (optional)

## 5. Azure Workaround (Lines 223, 241-243)

### Azure Detection and Store Flag
```rust
let azure_workaround = self.provider.base_url.contains("azure");

let payload = ResponsesApiRequest {
    // ... other fields
    store: azure_workaround,  // Set to true for Azure
    // ...
};

if azure_workaround {
    attach_item_ids(&mut payload_json, &input_with_instructions);
}
```

**Key Pattern**:
- Detect Azure by checking if baseUrl contains "azure"
- Set `store: true` in request
- Attach item IDs to reasoning items

## 6. Rate Limit Parsing (Lines 580-619)

### Header Parsing
```rust
fn parse_rate_limit_snapshot(headers: &HeaderMap) -> Option<RateLimitSnapshot> {
    let primary = parse_rate_limit_window(
        headers,
        "x-codex-primary-used-percent",
        "x-codex-primary-window-minutes",
        "x-codex-primary-resets-in-seconds",
    );

    let secondary = parse_rate_limit_window(
        headers,
        "x-codex-secondary-used-percent",
        "x-codex-secondary-window-minutes",
        "x-codex-secondary-resets-in-seconds",
    );

    if primary.is_none() && secondary.is_none() {
        return None;
    }

    Some(RateLimitSnapshot { primary, secondary })
}

fn parse_rate_limit_window(
    headers: &HeaderMap,
    used_percent_key: &str,
    window_minutes_key: &str,
    resets_key: &str,
) -> Option<RateLimitWindow> {
    let used_percent = headers.get(used_percent_key)?
        .to_str().ok()?
        .parse::<f64>().ok()?;

    Some(RateLimitWindow {
        used_percent,
        window_minutes: parse_header_u64(headers, window_minutes_key),
        resets_in_seconds: parse_header_u64(headers, resets_key),
    })
}
```

**Key Patterns**:
- Parse both primary and secondary windows
- Return None if both missing
- Parse float for used_percent, int for others
- Gracefully handle missing/invalid values

## 7. Token Usage Conversion (Lines 525-540)

### API Format → Internal Format
```rust
fn convert_token_usage(api_usage: ResponseCompletedUsage) -> TokenUsage {
    TokenUsage {
        input_tokens: api_usage.input_tokens,
        cached_input_tokens: api_usage.input_tokens_details
            .and_then(|d| d.cached_tokens)
            .unwrap_or(0),
        output_tokens: api_usage.output_tokens,
        reasoning_output_tokens: api_usage.output_tokens_details
            .and_then(|d| d.reasoning_tokens)
            .unwrap_or(0),
        total_tokens: api_usage.total_tokens,
    }
}
```

**Key Pattern**: Extract nested optional fields with defaults

## 8. Key Differences for TypeScript/Browser Port

### Authentication
- **Rust**: Uses AuthManager with OAuth flows, token refresh
- **Browser**: API key only via Authorization header (no OAuth)

### Async/Networking
- **Rust**: reqwest, tokio::mpsc channels, futures streams
- **Browser**: fetch(), Promise-based queue, ReadableStream

### SSE Parsing
- **Rust**: eventsource_stream crate
- **Browser**: Manual ReadableStream parsing with TextDecoder

### Type System
- **Rust**: Result<T>, Option<T>, enums with pattern matching
- **Browser**: Promise<T>, T | undefined, discriminated unions

## Summary: Critical Patterns to Preserve

1. **Event Ordering**: RateLimits → stream events → Completed (last)
2. **Completed Event Handling**: Store and emit at END, not inline
3. **Error Classification**: Fatal (no retry) vs Retryable (with backoff)
4. **Retry Logic**: Max attempts, exponential backoff, Retry-After respect
5. **Wire API Dispatch**: Responses vs Chat based on provider config
6. **Header Requirements**: All OpenAI-Beta, conversation_id, session_id headers
7. **Azure Workaround**: Detect by URL, set store=true
8. **Rate Limit Parsing**: Primary/secondary windows from headers
9. **SSE Event Types**: Complete mapping with ignored events
10. **snake_case Fields**: All data structures match Rust serde serialization

---

**Next Steps**:
- Use this document as reference for T025-T049 (Core Implementation)
- Ensure TypeScript port preserves ALL patterns above
- Validate against Rust implementation line-by-line
