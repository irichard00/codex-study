# Research: Replace ConversationStore with RolloutRecorder

**Date**: 2025-10-01
**Feature**: 006-use-the-rolloutrecorder
**Research Focus**: How codex-rs uses RolloutRecorder in Session, patterns to replicate in codex-chrome

---

## 1. How codex-rs Uses RolloutRecorder

### 1.1 Initialization Pattern (codex-rs/core/src/codex.rs:359-399)

```rust
// Step 1: Determine if creating new or resuming existing session
let (conversation_id, rollout_params) = match &initial_history {
    InitialHistory::Empty | InitialHistory::Forked(_) => {
        let conversation_id = ConversationId::new();
        (
            conversation_id,
            RolloutRecorderParams::new(conversation_id, user_instructions.clone()),
        )
    }
    InitialHistory::Resumed(resumed_history) => (
        resumed_history.conversation_id,
        RolloutRecorderParams::resume(resumed_history.rollout_path.clone()),
    ),
};

// Step 2: Initialize RolloutRecorder asynchronously
let rollout_fut = RolloutRecorder::new(&config, rollout_params);

// Step 3: Wait for initialization (along with other async tasks)
let (rollout_recorder, mcp_res, default_shell, (history_log_id, history_entry_count)) =
    tokio::join!(rollout_fut, mcp_fut, default_shell_fut, history_meta_fut);

// Step 4: Handle initialization errors gracefully
let rollout_recorder = rollout_recorder.map_err(|e| {
    error!("failed to initialize rollout recorder: {e:#}");
    anyhow::anyhow!("failed to initialize rollout recorder: {e:#}")
})?;

// Step 5: Store in SessionServices wrapped in Mutex<Option<>>
rollout: Mutex::new(Some(rollout_recorder)),
```

**Key Decisions**:
- **Wrapped in `Mutex<Option<RolloutRecorder>>`**: Allows taking ownership for shutdown/cleanup
- **Async initialization**: Non-blocking creation with error handling
- **Two modes**: Create new session OR resume existing session from path
- **Graceful degradation**: Errors are logged but don't crash the session

---

### 1.2 Recording Pattern (codex-rs/core/src/codex.rs:746-755)

```rust
async fn persist_rollout_items(&self, items: &[RolloutItem]) {
    if let Ok(guard) = self.services.rollout.lock().await {
        if let Some(recorder) = guard.as_ref() {
            if let Err(e) = recorder.record_items(items).await {
                error!("failed to record rollout items: {e:#}");
            }
        }
    }
}
```

**Key Patterns**:
1. **Lock the Mutex**: `rollout.lock().await`
2. **Check if Some**: Handle Option wrapper
3. **Call record_items**: Pass RolloutItem array
4. **Log errors, don't panic**: Persistence failures are logged but don't stop execution

**What gets recorded**:
- `RolloutItem::ResponseItem(response_item)` - AI responses, tool calls
- `RolloutItem::EventMsg(event_msg)` - User messages, system events
- `RolloutItem::TurnContext(turn_context)` - Turn-level metadata
- `RolloutItem::SessionMeta(session_meta)` - Session initialization metadata
- `RolloutItem::Compacted(compacted)` - Compacted history summaries

---

### 1.3 Persistence Policy (codex-rs/core/src/rollout/policy.rs)

**Filtering Logic**:
```rust
pub(crate) fn is_persisted_response_item(item: &RolloutItem) -> bool {
    match item {
        RolloutItem::ResponseItem(item) => should_persist_response_item(item),
        RolloutItem::EventMsg(ev) => should_persist_event_msg(ev),
        // Always persist executive markers
        RolloutItem::Compacted(_) | RolloutItem::TurnContext(_) | RolloutItem::SessionMeta(_) => true,
    }
}
```

**What IS persisted**:
- ResponseItem: Message, Reasoning, LocalShellCall, FunctionCall, FunctionCallOutput, CustomToolCall, CustomToolCallOutput, WebSearchCall
- EventMsg: UserMessage, AgentMessage, AgentReasoning, TokenCount, EnteredReviewMode, ExitedReviewMode, TurnAborted
- Executive markers: SessionMeta, TurnContext, Compacted

**What is NOT persisted**:
- ResponseItem: Other (unknown types)
- EventMsg: Delta events (streaming), TaskStarted, TaskComplete, SessionConfigured, temporary UI events

**Decision**: The recorder itself filters what gets persisted. Caller can send everything; recorder decides.

---

### 1.4 Reconstruction from Rollout (codex-rs/core/src/codex.rs:685-720)

When resuming a session, rollout items are converted back to conversation history:

```rust
fn reconstruct_history_from_rollout(
    &self,
    turn_context: &TurnContext,
    rollout_items: &[RolloutItem],
) -> ConversationHistory {
    let mut history = ConversationHistory::new(turn_context);

    for item in rollout_items {
        match item {
            RolloutItem::ResponseItem(response_item) => {
                history.add_response_item(response_item.clone());
            }
            RolloutItem::Compacted(compacted) => {
                // Add compacted summary to history
                history.add_compacted_item(compacted.message.clone());
            }
            // Other types ignored during reconstruction (metadata, events)
            _ => {}
        }
    }

    history
}
```

**Key Insight**: Only `ResponseItem` and `Compacted` are added to live conversation history. Other rollout items (SessionMeta, TurnContext, EventMsg) are metadata for debugging/replay but not part of the AI conversation context.

---

### 1.5 Shutdown Pattern (codex-rs/core/src/codex.rs:1416-1429)

```rust
// Gracefully flush and shutdown rollout recorder
if let Ok(mut guard) = sess.services.rollout.lock().await {
    if let Some(recorder) = guard.take() {  // Take ownership from Option
        if let Err(e) = recorder.shutdown().await {
            warn!("failed to shutdown rollout recorder: {e}");
            sess.send_event_msg(EventMsg::Error(ErrorEvent {
                message: "Failed to shutdown rollout recorder".to_string(),
            })).await;
        }
    }
}
```

**Pattern**: `.take()` moves the recorder out of the Option, allowing graceful shutdown before session ends.

---

## 2. Migration Strategy for codex-chrome

### 2.1 Session Integration Pattern

**Apply to `codex-chrome/src/core/Session.ts`**:

```typescript
// SessionServices.ts - Add rollout to services
export class SessionServices {
  mcp_connection_manager: McpConnectionManager;
  session_manager: ExecSessionManager;
  rollout: RolloutRecorder | null;  // Replaces ConversationStore
  // ... other services
}

// Session.ts - Initialize in constructor
async initializeSession(initialHistory: InitialHistory): Promise<void> {
  // Determine mode: create or resume
  const params = initialHistory.type === 'resumed'
    ? { type: 'resume', conversationId: initialHistory.conversationId }
    : { type: 'create', conversationId: uuidv4(), instructions: this.userInstructions };

  // Initialize RolloutRecorder
  try {
    this.services.rollout = await RolloutRecorder.create(params, this.config);
  } catch (e) {
    console.error('Failed to initialize rollout recorder:', e);
    // Graceful degradation: continue without persistence
    this.services.rollout = null;
  }

  // Reconstruct history if resuming
  if (initialHistory.type === 'resumed') {
    const rolloutItems = await this.services.rollout?.getRolloutHistory();
    if (rolloutItems) {
      this.reconstructHistoryFromRollout(rolloutItems);
    }
  }
}
```

### 2.2 Recording Pattern

**Replace ConversationStore calls**:

```typescript
// OLD: ConversationStore
await this.conversationStore.addMessage(conversationId, message);

// NEW: RolloutRecorder
async persistRolloutItems(items: RolloutItem[]): Promise<void> {
  if (this.services.rollout) {
    try {
      await this.services.rollout.recordItems(items);
    } catch (e) {
      console.error('Failed to record rollout items:', e);
      // Don't throw - persistence failure should not stop execution
    }
  }
}

// Usage:
await this.persistRolloutItems([
  { type: 'response_item', payload: { type: 'Message', content: 'Hello' } },
  { type: 'event_msg', payload: { type: 'UserMessage', content: 'Hi' } }
]);
```

### 2.3 ~~Data Migration~~ (NOT NEEDED - Fresh Start)

**Decision**: No data migration will be performed. Users will start with empty conversation history when the extension updates to use RolloutRecorder.

**Rationale**:
- Simplifies implementation (no migration code needed)
- Reduces risk of data corruption during migration
- Cleaner cutover to new storage system
- Users can manually export/backup important conversations before updating if needed

**Impact**:
- Existing conversations in ConversationStore will be inaccessible after update
- Users start fresh with RolloutRecorder
- ConversationStore database can be manually deleted by users (optional cleanup)

**~~Migration pseudocode~~** (Removed - not applicable)

### 2.4 Cleanup & TTL

**Replace ConversationStore.cleanup() with RolloutRecorder.cleanupExpired()**:

```typescript
// service-worker.ts - Schedule cleanup with Chrome alarms
chrome.alarms.create('rollout-cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'rollout-cleanup') {
    try {
      const cleaned = await RolloutRecorder.cleanupExpired();
      console.log(`Cleaned up ${cleaned.count} expired rollouts`);
    } catch (e) {
      console.error('Cleanup failed:', e);
    }
  }
});
```

---

## 3. Key Differences: Rust vs TypeScript/Chrome

| Aspect | codex-rs (Rust) | codex-chrome (TypeScript) |
|--------|-----------------|---------------------------|
| **Storage** | File system (.jsonl files) | IndexedDB (RolloutRecorder) |
| **Concurrency** | Tokio async + Mutex | Single-threaded event loop (no Mutex needed) |
| **Error Handling** | Result<T, E> with explicit error propagation | try/catch with graceful degradation |
| **Initialization** | `tokio::join!` for parallel async | Sequential `await` (or Promise.all) |
| **Shutdown** | Explicit `.shutdown()` call | Implicit (IndexedDB auto-commits) |
| **TTL** | Not implemented in Rust (relies on manual cleanup) | Built into IndexedDB RolloutRecorder |

---

## 4. Decisions & Rationale

### Decision 1: Keep RolloutRecorder nullable in SessionServices
**Rationale**: Matches Rust's `Option<RolloutRecorder>` pattern. Allows session to continue even if persistence fails.

### Decision 2: Filter in RolloutRecorder.recordItems()
**Rationale**: Follows Rust pattern where recorder applies persistence policy. Simplifies caller logic.

### ~~Decision 3: Migrate data~~ (REMOVED - No migration)
**Updated**: No migration performed. Users start fresh.

### ~~Decision 4: Preserve conversation IDs~~ (REMOVED - No migration)
**Updated**: Not applicable - no migration.

### Decision 5: Use RolloutRecorder.listConversations() for UI
**Rationale**: Replaces ConversationStore.listConversations() with cursor-based pagination. More efficient for large datasets.

---

## 5. Alternatives Considered

### Alternative 1: Keep ConversationStore, sync to RolloutRecorder
**Rejected**: Adds complexity, doubles storage usage, violates DRY principle.

### Alternative 2: Lazy migration (convert on-demand)
**Rejected**: Inconsistent state during transition. Harder to test and debug.

### Alternative 3: Fresh start, no migration
**ACCEPTED**: Users start fresh with RolloutRecorder. Simplifies implementation, reduces risk.

---

## 6. Open Questions Resolved

1. ~~**How to handle mid-migration failures?**~~ → Not applicable (no migration)
2. ~~**Backward compatibility during transition?**~~ → Not applicable (no migration)
3. **ToolCallRecord mapping?** → Will be handled naturally in new Session implementation (embed in response_item)
4. ~~**ConversationStore-specific fields (searchIndex)?**~~ → Not applicable (no migration)
5. **Database cleanup timing?** → Old CodexConversations DB remains (users can manually delete if desired)

---

## 7. Implementation Checklist

- [x] Research codex-rs/core/src/codex.rs session patterns
- [x] Research codex-rs/core/src/rollout/recorder.rs implementation
- [x] Understand persistence policy and filtering logic
- [x] ~~Define migration strategy~~ → Confirmed: No migration (fresh start)
- [ ] Implement Session.ts integration (Phase 2 tasks)
- [ ] ~~Implement migration utility~~ → Not needed
- [ ] Update SessionServices.ts (Phase 2 tasks)
- [ ] Update StorageQuotaManager.ts (Phase 2 tasks)
- [ ] Remove ConversationStore.ts (Phase 2 tasks)
- [ ] Update service-worker.ts for cleanup scheduling (Phase 2 tasks)

---

**Research Complete**: All patterns understood. **No migration needed** - code replacement only. Ready for Phase 1 (Design & Contracts).
