# Research: Missing Session Methods

## Updated Requirements (2025-10-01)

**Browser-Only Scope**: This implementation is for codex-chrome, a browser-based agent. The following constraints apply:

1. **EXCLUDE MCP-related code**: Model Context Protocol (MCP) requires server-side processes and file system access, which are not available in browser environments
2. **EXCLUDE file operation code**: Direct file system operations are not available in browser sandboxes
3. **Preserve method names**: Keep original Rust method names whenever possible for consistency with codex-rs architecture
4. **Maximize code reuse**: Utilize existing codex-chrome components (SessionState, RolloutRecorder, event emitters, etc.)

**Impact on Implementation**:
- Original count: 33 missing methods
- Browser-compatible methods: **22 methods** (after excluding MCP and file operations)
- Excluded methods: **11 methods** (MCP integration, shell execution, file operations)

## Summary

This research compares the Rust `Session` implementation in `codex-rs/core/src/codex.rs` with the TypeScript `Session` implementation in `codex-chrome/src/core/Session.ts` to identify missing methods and functionality.

**Key Findings:**
- The TypeScript Session has **33 missing methods** from the Rust implementation
- **Browser-compatible subset**: **22 methods** can be implemented in browser environment
- **Browser-excluded methods**: **11 methods** rely on file system or MCP server access
- Missing functionality spans 7 major categories: initialization, approval handling, event management, task lifecycle, rollout recording, token/rate limit tracking, and utility methods
- The Rust implementation uses a more sophisticated architecture with `SessionState`, `SessionServices`, `ActiveTurn`, and `TurnState` separation
- Several Rust-specific patterns (channels, Arc/Mutex, async traits) need TypeScript adaptations

## Comparison Methodology

1. **Rust Analysis**: Examined `codex-rs/core/src/codex.rs` (lines 334-1080), `codex-rs/core/src/tasks/mod.rs`, and `codex-rs/core/src/state/` modules
2. **TypeScript Analysis**: Examined `codex-chrome/src/core/Session.ts` (complete file)
3. **Method Extraction**: Identified all public, pub(crate), and private methods in impl Session
4. **Cross-Reference**: Matched methods by name and functionality between implementations
5. **Categorization**: Grouped missing methods by functional area

## Missing Methods by Category

### Category 1: Session Initialization & Configuration

#### 1.1 `new()` - Static async factory method
**Status**: **PARTIALLY EXCLUDED** (MCP components excluded, core initialization retained)

**Rust Signature:**
```rust
async fn new(
    configure_session: ConfigureSession,
    config: Arc<Config>,
    auth_manager: Arc<AuthManager>,
    tx_event: Sender<Event>,
    initial_history: InitialHistory,
) -> anyhow::Result<(Arc<Self>, TurnContext)>
```

**Purpose:** Creates a new Session with full initialization including:
- RolloutRecorder initialization (new or resumed) ✅ **BROWSER-COMPATIBLE**
- ~~MCP connection manager setup~~ ❌ **EXCLUDED (requires server processes)**
- ~~Default shell discovery~~ ❌ **EXCLUDED (no shell in browser)**
- History metadata loading ✅ **BROWSER-COMPATIBLE**
- Parallel async task execution for startup optimization ✅ **BROWSER-COMPATIBLE**

**Dependencies:**
- `ConfigureSession` struct
- `Arc<Config>`, `Arc<AuthManager>`
- `Sender<Event>` (tokio channel)
- `InitialHistory` enum (New/Resumed/Forked)
- `RolloutRecorder` ✅ **EXISTS in codex-chrome**
- ~~`McpConnectionManager`~~ ❌ **EXCLUDED**
- `OtelEventManager` (optional telemetry)

**Browser-Specific Adaptation:**
- Replace Arc/Mutex with plain references
- Replace tokio::join! with Promise.all()
- Use existing `RolloutRecorder` from codex-chrome
- Remove MCP and shell initialization
- Use Chrome Storage API for metadata

**Current State in TS:**
- Has basic constructor but missing full initialization logic
- `initialize()` method exists but is simplified
- Missing parallel initialization of services

**Code Reuse Opportunities:**
- `src/core/RolloutRecorder.ts` - Already exists
- `src/core/SessionState.ts` - Already exists
- Event emitter pattern already in Session

---

#### 1.2 `record_initial_history()` - Record history on session start
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
async fn record_initial_history(
    &self,
    turn_context: &TurnContext,
    conversation_history: InitialHistory,
)
```

**Purpose:** Records initial conversation history based on session mode:
- New sessions: builds and records initial context
- Resumed sessions: reconstructs history from rollout items
- Forked sessions: similar to resumed but persists items

**Dependencies:**
- `InitialHistory` enum
- `build_initial_context()` method
- `reconstruct_history_from_rollout()` method ✅ (already exists in Session.ts)
- `persist_rollout_items()` method ✅ (RolloutRecorder exists)

**Browser-Specific Adaptation:**
- Pattern matching on InitialHistory type (use discriminated union)
- Async/await for rollout operations
- Load from Chrome Storage API instead of file system

**Current State in TS:**
- Partial implementation in `initializeSession()`
- Missing comprehensive handling of New/Resumed/Forked modes

**Code Reuse:**
- `RolloutRecorder.load()` - Already implemented
- `reconstructHistoryFromRollout()` - Already exists (private)
- `SessionState.recordItems()` - Already exists

---

#### 1.3 `next_internal_sub_id()` - Generate internal submission IDs
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
fn next_internal_sub_id(&self) -> String
```

**Purpose:** Generates unique internal submission IDs for auto-generated operations (e.g., auto-compact)

**Dependencies:**
- `AtomicU64` counter (in Rust)

**Browser-Specific Adaptation:**
- Use simple counter with increment (JavaScript is single-threaded)
- Or use `crypto.randomUUID()` for browser-native UUID generation

**Current State in TS:** Missing entirely

**Code Reuse:**
- Simple implementation, no dependencies needed

---

### Category 2: Approval Handling

#### 2.1 `request_command_approval()` - Request user approval for command execution
**Status**: ❌ **EXCLUDED (shell command execution not available in browser)**

**Rust Signature:**
```rust
pub async fn request_command_approval(
    &self,
    sub_id: String,
    call_id: String,
    command: Vec<String>,
    cwd: PathBuf,
    reason: Option<String>,
) -> ReviewDecision
```

**Purpose:**
- Requests approval for executing a shell command
- Registers approval callback in active turn state
- Sends ExecApprovalRequest event
- Awaits user decision via oneshot channel

**Browser Limitation:**
- Browser environment cannot execute shell commands
- No `cwd` (current working directory) concept in browser
- While the approval pattern is valid, shell execution is not

**Future Possibility:**
- Could be adapted for browser-specific operations (DOM manipulation, API calls)
- Generic approval pattern is valuable but not needed for current browser agent scope

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 2.2 `request_patch_approval()` - Request approval for patch operations
**Status**: ❌ **EXCLUDED (file system patches not available in browser)**

**Rust Signature:**
```rust
pub async fn request_patch_approval(
    &self,
    sub_id: String,
    call_id: String,
    action: &ApplyPatchAction,
    reason: Option<String>,
    grant_root: Option<PathBuf>,
) -> oneshot::Receiver<ReviewDecision>
```

**Purpose:**
- Requests approval for applying file patches
- Similar to command approval but for file changes
- Returns receiver for async decision

**Browser Limitation:**
- Browser cannot modify local file system directly
- File patches require file system access
- No equivalent browser API for patch operations

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 2.3 `notify_approval()` - Notify waiting task of approval decision
**Status**: ✅ **BROWSER-COMPATIBLE** (generic approval pattern)

**Rust Signature:**
```rust
pub async fn notify_approval(&self, sub_id: &str, decision: ReviewDecision)
```

**Purpose:**
- Retrieves pending approval from active turn state
- Sends decision through oneshot channel
- Removes approval from pending map

**Dependencies:**
- `ActiveTurn.turn_state.pending_approvals` HashMap
- `ReviewDecision` enum

**Browser-Specific Adaptation:**
- Resolve stored Promise with decision
- Clean up approval from pending map
- Can be used for future browser-specific approval workflows

**Current State in TS:** Missing entirely

**Code Reuse:**
- Generic pattern, no complex dependencies
- Store Promise resolvers in Map<string, (decision: ReviewDecision) => void>

---

### Category 3: Event Management

#### 3.1 `send_event()` - Persist and dispatch events
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
pub(crate) async fn send_event(&self, event: Event)
```

**Purpose:**
- Persists event to rollout recorder as EventMsg
- Sends event through event channel to clients
- Central event dispatch point

**Dependencies:**
- `RolloutItem::EventMsg` ✅ (exists in protocol types)
- `tx_event` channel sender (use event emitter)

**Browser-Specific Adaptation:**
- Use existing event emitter pattern in Session
- Add rollout persistence via RolloutRecorder

**Current State in TS:**
- `emitEvent()` exists but doesn't persist to rollout
- Missing rollout integration

**Code Reuse:**
- Enhance existing `emitEvent()` method
- Use existing `RolloutRecorder.persist()`

---

#### 3.2 `on_exec_command_begin()` - Emit command execution start event
**Status**: ❌ **EXCLUDED (shell command execution not available in browser)**

**Rust Signature:**
```rust
async fn on_exec_command_begin(
    &self,
    turn_diff_tracker: &mut TurnDiffTracker,
    exec_command_context: ExecCommandContext,
)
```

**Purpose:**
- Emits ExecCommandBegin or PatchApplyBegin event
- Tracks diff for patch operations
- Parses command for structured representation

**Browser Limitation:**
- Tracks shell command execution lifecycle
- Browser cannot execute shell commands
- TurnDiffTracker requires file system access

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 3.3 `on_exec_command_end()` - Emit command execution end event
**Status**: ❌ **EXCLUDED (shell command execution not available in browser)**

**Rust Signature:**
```rust
async fn on_exec_command_end(
    &self,
    turn_diff_tracker: &mut TurnDiffTracker,
    sub_id: &str,
    call_id: &str,
    output: &ExecToolCallOutput,
    is_apply_patch: bool,
)
```

**Purpose:**
- Emits ExecCommandEnd or PatchApplyEnd event
- Includes stdout, stderr, exit code, duration
- Emits TurnDiff event for patch operations

**Browser Limitation:**
- Completes shell command execution lifecycle
- No shell execution in browser
- No file diffs to track

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 3.4 `run_exec_with_events()` - Execute command with full event lifecycle
**Status**: ❌ **EXCLUDED (shell command execution not available in browser)**

**Rust Signature:**
```rust
async fn run_exec_with_events<'a>(
    &self,
    turn_diff_tracker: &mut TurnDiffTracker,
    begin_ctx: ExecCommandContext,
    exec_args: ExecInvokeArgs<'a>,
) -> crate::error::Result<ExecToolCallOutput>
```

**Purpose:**
- Wraps command execution with begin/end events
- Handles errors gracefully
- Emits events even on failure

**Browser Limitation:**
- Executes shell commands with event tracking
- Browser has no shell execution capability
- Would require native messaging host (outside current scope)

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 3.5 `notify_background_event()` - Emit background notification
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
async fn notify_background_event(&self, sub_id: &str, message: impl Into<String>)
```

**Purpose:** Helper to emit BackgroundEvent for diagnostics

**Dependencies:** `BackgroundEventEvent` type (protocol event)

**Browser-Specific Adaptation:** Simple event emission via `send_event()`

**Current State in TS:** Missing entirely

**Code Reuse:**
- Use enhanced `send_event()` method
- Protocol types already exist

---

#### 3.6 `notify_stream_error()` - Emit streaming error
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
async fn notify_stream_error(&self, sub_id: &str, message: impl Into<String>)
```

**Purpose:** Helper to emit StreamError events

**Dependencies:** `StreamErrorEvent` type (protocol event)

**Browser-Specific Adaptation:** Simple event emission via `send_event()`

**Current State in TS:** Missing entirely

**Code Reuse:**
- Use enhanced `send_event()` method
- Protocol types already exist

---

#### 3.7 `send_token_count_event()` - Send token usage update
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
async fn send_token_count_event(&self, sub_id: &str)
```

**Purpose:**
- Retrieves current token info and rate limits from state
- Emits TokenCount event

**Dependencies:**
- `TokenCountEvent` (protocol type)
- `SessionState.token_info_and_rate_limits()` or equivalent

**Browser-Specific Adaptation:**
- Integrate with SessionState token tracking
- Emit via `send_event()`

**Current State in TS:** Missing entirely

**Code Reuse:**
- Use existing SessionState token tracking
- Protocol types already exist

---

### Category 4: Task Lifecycle Management

#### 4.1 `spawn_task()` - Spawn new task with lifecycle management
**Rust Signature:**
```rust
pub async fn spawn_task<T: SessionTask>(
    self: &Arc<Self>,
    turn_context: Arc<TurnContext>,
    sub_id: String,
    input: Vec<InputItem>,
    task: T,
)
```

**Location:** `codex-rs/core/src/tasks/mod.rs`

**Purpose:**
- Aborts all existing tasks (TurnAbortReason::Replaced)
- Spawns new task with tokio::spawn
- Registers task in ActiveTurn
- Emits TaskComplete on finish

**Dependencies:**
- `SessionTask` trait
- `Arc<Self>` pattern
- `RunningTask` struct
- `AbortHandle` from tokio

**TypeScript Adaptation:**
- Use async function instead of trait
- Track running task with AbortController
- Promise-based task execution

**Current State in TS:** Missing entirely

---

#### 4.2 `abort_all_tasks()` - Abort all running tasks
**Rust Signature:**
```rust
pub async fn abort_all_tasks(self: &Arc<Self>, reason: TurnAbortReason)
```

**Location:** `codex-rs/core/src/tasks/mod.rs`

**Purpose:**
- Takes all running tasks from ActiveTurn
- Calls handle_task_abort for each
- Clears pending input/approvals

**Dependencies:**
- `TurnAbortReason` enum
- `take_all_running_tasks()` helper

**TypeScript Adaptation:**
- AbortController.abort() for each task
- Clear pending maps

**Current State in TS:** Missing entirely

---

#### 4.3 `on_task_finished()` - Handle task completion
**Rust Signature:**
```rust
pub async fn on_task_finished(
    self: &Arc<Self>,
    sub_id: String,
    last_agent_message: Option<String>,
)
```

**Location:** `codex-rs/core/src/tasks/mod.rs`

**Purpose:**
- Removes task from ActiveTurn
- Clears ActiveTurn if no tasks remain
- Emits TaskComplete event

**Dependencies:**
- `TaskCompleteEvent`

**TypeScript Adaptation:**
- Task cleanup logic

**Current State in TS:** Partially in `endTurn()`

---

#### 4.4 `register_new_active_task()` - Register task in active turn
**Rust Signature:**
```rust
async fn register_new_active_task(&self, sub_id: String, task: RunningTask)
```

**Location:** `codex-rs/core/src/tasks/mod.rs`

**Purpose:**
- Creates new ActiveTurn if needed
- Adds task to ActiveTurn.tasks map

**Dependencies:**
- `ActiveTurn::default()`
- `RunningTask` struct

**TypeScript Adaptation:**
- Create/update ActiveTurn instance

**Current State in TS:** Missing entirely

---

#### 4.5 `take_all_running_tasks()` - Extract all running tasks
**Rust Signature:**
```rust
async fn take_all_running_tasks(&self) -> Vec<(String, RunningTask)>
```

**Location:** `codex-rs/core/src/tasks/mod.rs`

**Purpose:**
- Takes ownership of ActiveTurn
- Clears pending input/approvals
- Drains tasks from ActiveTurn

**Dependencies:**
- `ActiveTurn.drain_tasks()`

**TypeScript Adaptation:**
- Return and clear task map

**Current State in TS:** Missing entirely

---

#### 4.6 `handle_task_abort()` - Handle individual task abort
**Rust Signature:**
```rust
async fn handle_task_abort(
    self: &Arc<Self>,
    sub_id: String,
    task: RunningTask,
    reason: TurnAbortReason,
)
```

**Location:** `codex-rs/core/src/tasks/mod.rs`

**Purpose:**
- Checks if task already finished
- Aborts task handle
- Calls task-specific abort logic (e.g., exit review mode)
- Emits TurnAborted event

**Dependencies:**
- `SessionTask.abort()` method
- `TurnAbortedEvent`

**TypeScript Adaptation:**
- AbortController pattern
- Task-specific cleanup

**Current State in TS:** Missing entirely

---

#### 4.7 `interrupt_task()` - Public interrupt interface
**Rust Signature:**
```rust
pub async fn interrupt_task(self: &Arc<Self>)
```

**Purpose:**
- Public API to interrupt current task
- Calls abort_all_tasks with Interrupted reason

**TypeScript Adaptation:**
- Simple wrapper around abort_all_tasks

**Current State in TS:**
- `requestInterrupt()` exists but different behavior
- Missing abort_all_tasks integration

---

#### 4.8 `interrupt_task_sync()` - Synchronous interrupt for Drop
**Rust Signature:**
```rust
fn interrupt_task_sync(&self)
```

**Purpose:**
- Non-blocking interrupt for Drop impl
- Uses try_lock to avoid deadlock
- Aborts all task handles

**TypeScript Adaptation:**
- Not needed (no Drop trait in TypeScript)
- Could be cleanup method for destructor pattern

**Current State in TS:** Not applicable

---

### Category 5: Rollout Recording & History

#### 5.1 `record_conversation_items()` - Record items to history and rollout
**Rust Signature:**
```rust
async fn record_conversation_items(&self, items: &[ResponseItem])
```

**Purpose:**
- Appends items to in-memory history
- Persists ResponseItems to rollout

**Dependencies:**
- `record_into_history()`
- `persist_rollout_response_items()`

**TypeScript Adaptation:**
- Integrate with existing SessionState

**Current State in TS:**
- `recordConversationItems()` exists but simplified
- Missing rollout persistence integration

---

#### 5.2 `reconstruct_history_from_rollout()` - Rebuild history from rollout
**Rust Signature:**
```rust
fn reconstruct_history_from_rollout(
    &self,
    turn_context: &TurnContext,
    rollout_items: &[RolloutItem],
) -> Vec<ResponseItem>
```

**Purpose:**
- Processes rollout items (ResponseItem, Compacted)
- Rebuilds conversation history
- Handles compacted history with summaries

**Dependencies:**
- `ConversationHistory` helper
- `build_compacted_history()` function
- `collect_user_messages()` utility

**TypeScript Adaptation:**
- Port compaction logic

**Current State in TS:**
- `reconstructHistoryFromRollout()` exists (private)
- Simplified implementation

---

#### 5.3 `record_into_history()` - Append to in-memory history only
**Rust Signature:**
```rust
async fn record_into_history(&self, items: &[ResponseItem])
```

**Purpose:**
- Pure history append without persistence
- Locks SessionState and records items

**Dependencies:**
- `SessionState.record_items()`

**TypeScript Adaptation:**
- Direct SessionState integration

**Current State in TS:** Missing (logic embedded in other methods)

---

#### 5.4 `replace_history()` - Replace entire history
**Rust Signature:**
```rust
async fn replace_history(&self, items: Vec<ResponseItem>)
```

**Purpose:**
- Completely replaces conversation history
- Used for compaction

**Dependencies:**
- `SessionState.replace_history()`

**TypeScript Adaptation:**
- SessionState method call

**Current State in TS:** Missing entirely

---

#### 5.5 `persist_rollout_response_items()` - Persist response items to rollout
**Rust Signature:**
```rust
async fn persist_rollout_response_items(&self, items: &[ResponseItem])
```

**Purpose:**
- Converts ResponseItems to RolloutItems
- Calls persist_rollout_items

**Dependencies:**
- `RolloutItem::ResponseItem` conversion

**TypeScript Adaptation:**
- Map to RolloutItem format

**Current State in TS:** Missing (logic in `persistRolloutItems()`)

---

#### 5.6 `record_input_and_rollout_usermsg()` - Record user input with dual persistence
**Rust Signature:**
```rust
async fn record_input_and_rollout_usermsg(&self, response_input: &ResponseInputItem)
```

**Purpose:**
- Converts input to ResponseItem
- Records to conversation history
- Derives UserMessage events
- Persists only UserMessage to rollout (not full ResponseItem)

**Dependencies:**
- `map_response_item_to_event_messages()` function
- `RolloutItem::EventMsg(EventMsg::UserMessage(...))`

**TypeScript Adaptation:**
- Dual persistence pattern

**Current State in TS:** Missing entirely

---

### Category 6: Token & Rate Limit Tracking

#### 6.1 `update_token_usage_info()` - Update token counts from model response
**Rust Signature:**
```rust
async fn update_token_usage_info(
    &self,
    sub_id: &str,
    turn_context: &TurnContext,
    token_usage: Option<&TokenUsage>,
)
```

**Purpose:**
- Updates SessionState token info
- Sends token count event

**Dependencies:**
- `TokenUsage` protocol type
- `SessionState.update_token_info_from_usage()`

**TypeScript Adaptation:**
- Integrate with TokenUsageInfo type

**Current State in TS:**
- `addTokenUsage()` exists but simplified
- Missing event emission

---

#### 6.2 `update_rate_limits()` - Update rate limit snapshot
**Rust Signature:**
```rust
async fn update_rate_limits(&self, sub_id: &str, new_rate_limits: RateLimitSnapshot)
```

**Purpose:**
- Updates SessionState rate limits
- Sends token count event

**Dependencies:**
- `RateLimitSnapshot` type
- `SessionState.set_rate_limits()`

**TypeScript Adaptation:**
- Add RateLimitSnapshot type if missing

**Current State in TS:** Missing entirely

---

### Category 7: Utility & Helper Methods

#### 7.1 `turn_input_with_history()` - Build full turn input
**Rust Signature:**
```rust
pub async fn turn_input_with_history(&self, extra: Vec<ResponseItem>) -> Vec<ResponseItem>
```

**Purpose:**
- Combines session history with new turn items
- Used for each model turn

**Dependencies:**
- `history_snapshot()`

**TypeScript Adaptation:**
- Array concatenation

**Current State in TS:**
- `buildTurnInputWithHistory()` exists but different signature

---

#### 7.2 `inject_input()` - Inject input into running task
**Rust Signature:**
```rust
pub async fn inject_input(&self, input: Vec<InputItem>) -> Result<(), Vec<InputItem>>
```

**Purpose:**
- Attempts to inject input into active turn
- Returns input back if no active turn
- Used for interrupting running tasks with new input

**Dependencies:**
- `ActiveTurn.turn_state.push_pending_input()`

**TypeScript Adaptation:**
- Result type pattern (success/failure)

**Current State in TS:** Missing entirely

---

#### 7.3 `call_tool()` - Call MCP tool
**Status**: ❌ **EXCLUDED (MCP requires server processes)**

**Rust Signature:**
```rust
pub async fn call_tool(
    &self,
    server: &str,
    tool: &str,
    arguments: Option<serde_json::Value>,
) -> anyhow::Result<CallToolResult>
```

**Purpose:**
- Delegates to MCP connection manager
- Calls specific tool on server

**Browser Limitation:**
- MCP (Model Context Protocol) requires server-side processes
- MCP servers run as native processes with file system access
- No browser-compatible MCP implementation exists

**Future Possibility:**
- Could implement browser-native tools without MCP protocol
- HTTP-based tool APIs could replace MCP in browser

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 7.4 `notifier()` - Get user notifier service
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
pub(crate) fn notifier(&self) -> &UserNotifier
```

**Purpose:**
- Returns reference to notifier service

**Dependencies:**
- `SessionServices.notifier` or equivalent

**Browser-Specific Adaptation:**
- Simple getter method
- Can use Chrome notifications API or in-UI notifications

**Current State in TS:** Missing entirely

**Code Reuse:**
- Could integrate with existing UI components
- Chrome notifications API available

---

#### 7.5 `user_shell()` - Get user shell configuration
**Status**: ❌ **EXCLUDED (no shell in browser)**

**Rust Signature:**
```rust
fn user_shell(&self) -> &shell::Shell
```

**Purpose:**
- Returns reference to user's shell config (bash, zsh, etc.)

**Browser Limitation:**
- Browser environment has no shell access
- No shell configuration concept in browser
- Not applicable to browser agent

**Current State in TS:** Missing entirely (and not needed for browser)

---

#### 7.6 `show_raw_agent_reasoning()` - Check if showing raw reasoning
**Status**: ✅ **BROWSER-COMPATIBLE**

**Rust Signature:**
```rust
fn show_raw_agent_reasoning(&self) -> bool
```

**Purpose:**
- Feature flag for showing model reasoning

**Dependencies:**
- `SessionServices.show_raw_agent_reasoning` or config setting

**Browser-Specific Adaptation:**
- Simple boolean getter
- Can be stored in Chrome storage or session config

**Current State in TS:** Missing entirely

**Code Reuse:**
- Simple getter, can read from config or settings

---

#### 7.7 Drop implementation (destructor)
**Rust Signature:**
```rust
impl Drop for Session {
    fn drop(&mut self) {
        self.interrupt_task_sync();
    }
}
```

**Purpose:**
- Cleanup on Session destruction
- Interrupts any running tasks

**TypeScript Adaptation:**
- Not directly applicable (no destructors)
- Could implement cleanup() method

**Current State in TS:**
- `close()` and `shutdown()` exist for cleanup

---

## Browser-Specific Adaptations

### Methods Excluded (Browser Limitations)

The following **11 methods** are EXCLUDED from browser implementation due to environment constraints:

#### MCP-Related Methods (3 excluded)
1. **`call_tool()`** - ❌ EXCLUDED
   - Requires MCP server processes and file system access
   - MCP is designed for desktop environments with native process execution
   - No browser-compatible MCP client exists

2. **Part of `new()`** - MCP connection manager setup - ❌ EXCLUDED
   - Initializes MCP server connections
   - Requires native process spawning

3. **McpConnectionManager dependency** - ❌ EXCLUDED
   - Entire service not applicable in browser

#### File Operation & Shell Methods (8 excluded)
4. **`user_shell()`** - ❌ EXCLUDED
   - Returns shell configuration (bash, zsh, etc.)
   - Browsers have no shell access

5. **Part of `new()`** - Default shell discovery - ❌ EXCLUDED
   - Discovers user's default shell
   - Not applicable in browser

6. **`on_exec_command_begin()`** - ❌ EXCLUDED
   - Emits shell command execution start events
   - Browser cannot execute shell commands directly

7. **`on_exec_command_end()`** - ❌ EXCLUDED
   - Emits shell command execution end events
   - Browser cannot execute shell commands directly

8. **`run_exec_with_events()`** - ❌ EXCLUDED
   - Wraps shell command execution with events
   - Requires native process execution

9. **`request_patch_approval()`** - ❌ EXCLUDED
   - Requests approval for file system patches
   - Browser cannot modify local files directly

10. **`request_command_approval()`** - ❌ EXCLUDED (for shell commands)
    - While approval pattern is valid, shell command execution is not
    - Could be adapted for browser-specific operations in future

11. **TurnDiffTracker dependency** - ❌ EXCLUDED
    - Tracks file system diffs
    - Not applicable without file operations

### Browser-Compatible Methods (22 methods)

The following **22 methods** CAN be implemented in browser environment:

#### Category 1: Session Initialization (2 methods)
- `new()` - PARTIAL (exclude MCP/shell, keep RolloutRecorder init)
- `record_initial_history()` - ✅ Full implementation
- `next_internal_sub_id()` - ✅ Full implementation

#### Category 2: Event Management (4 methods)
- `send_event()` - ✅ Full implementation (integrate with RolloutRecorder)
- `notify_background_event()` - ✅ Full implementation
- `notify_stream_error()` - ✅ Full implementation
- `send_token_count_event()` - ✅ Full implementation

#### Category 3: Approval Handling (1 method)
- `notify_approval()` - ✅ Full implementation (generic approval pattern)

#### Category 4: Task Lifecycle (8 methods)
- `spawn_task()` - ✅ Full implementation (use AbortController)
- `abort_all_tasks()` - ✅ Full implementation
- `on_task_finished()` - ✅ Full implementation
- `register_new_active_task()` - ✅ Full implementation
- `take_all_running_tasks()` - ✅ Full implementation
- `handle_task_abort()` - ✅ Full implementation
- `interrupt_task()` - ✅ Full implementation
- `interrupt_task_sync()` - N/A (no Drop trait, use cleanup())

#### Category 5: Rollout Recording & History (5 methods)
- `record_conversation_items()` - ✅ Full implementation
- `reconstruct_history_from_rollout()` - ✅ Full implementation (enhance existing)
- `record_into_history()` - ✅ Full implementation
- `replace_history()` - ✅ Full implementation
- `persist_rollout_response_items()` - ✅ Full implementation
- `record_input_and_rollout_usermsg()` - ✅ Full implementation

#### Category 6: Token & Rate Limit Tracking (2 methods)
- `update_token_usage_info()` - ✅ Full implementation
- `update_rate_limits()` - ✅ Full implementation

#### Category 7: Utility Methods (2 methods)
- `turn_input_with_history()` - ✅ Full implementation (align signature)
- `inject_input()` - ✅ Full implementation
- `notifier()` - ✅ Full implementation
- `show_raw_agent_reasoning()` - ✅ Full implementation

### Alternative Approaches for Browser

#### Instead of Shell Execution:
- **Chrome Extension APIs**: Use `chrome.runtime`, `chrome.scripting` for page manipulation
- **Content Scripts**: Execute JavaScript in web page contexts
- **Web APIs**: Leverage browser capabilities (fetch, storage, messaging)

#### Instead of File System Operations:
- **Chrome Storage API**: For persistence (`chrome.storage.local`, `chrome.storage.sync`)
- **IndexedDB**: For larger data storage
- **Download API**: For exporting data (`chrome.downloads`)
- **FileSystem Access API**: For user-initiated file operations (where available)

#### Instead of MCP:
- **Browser-Native Tools**: Implement tools as browser APIs
- **Web Services**: Call HTTP APIs for external functionality
- **Extension Messages**: Inter-component communication via Chrome messaging

### Existing codex-chrome Components to Leverage

#### Core Infrastructure (Already Implemented)
1. **`RolloutRecorder`** (`src/core/RolloutRecorder.ts`)
   - Persists rollout items
   - Loads rollout history
   - Reuse for all rollout operations

2. **`SessionState`** (`src/core/SessionState.ts`)
   - Manages conversation history
   - Tracks token usage
   - Reuse for state management

3. **Event Emitter Pattern** (in `Session.ts`)
   - `emitEvent()` method exists
   - Event listener infrastructure
   - Enhance for rollout integration

4. **`AgentTask` & `TaskRunner`** (`src/core/AgentTask.ts`, `src/core/TaskRunner.ts`)
   - Task execution pattern exists
   - Reuse for spawn_task() implementation

5. **Protocol Types** (`src/protocol/types.ts`)
   - Event, EventMsg, RolloutItem types
   - Already compatible with Rust protocol

#### Additional Components Available
6. **`ModelClientFactory`** (`src/models/ModelClientFactory.ts`)
   - Model client management
   - Token usage tracking

7. **Chrome Extension Architecture**
   - Background service worker
   - Content scripts
   - Side panel UI
   - Message passing infrastructure

---

## TypeScript Adaptations Needed

### 1. Async Patterns
- **Rust**: Uses tokio channels (mpsc, oneshot), Arc<Mutex<T>>
- **TypeScript**: Use Promises, event emitters, WeakMap for weak references

### 2. Error Handling
- **Rust**: Result<T, E>, anyhow::Result<T>
- **TypeScript**: try/catch, custom Result type, or throw exceptions

### 3. Ownership & Lifetimes
- **Rust**: Arc<T> for shared ownership, &self for borrowing
- **TypeScript**: Plain references, WeakRef for weak references

### 4. Concurrency
- **Rust**: tokio::spawn, async/await, Mutex/RwLock
- **TypeScript**: Promise.all(), async/await, no mutex needed (single-threaded)

### 5. Trait System
- **Rust**: SessionTask trait with async methods
- **TypeScript**: Interface or abstract class

### 6. Pattern Matching
- **Rust**: match expressions on enums
- **TypeScript**: if/else or switch on type/kind field

### 7. Channels for Communication
- **Rust**: oneshot::channel() for single-use request/response
- **TypeScript**: Promise with external resolver/rejector

### 8. Abort Handling
- **Rust**: AbortHandle from tokio tasks
- **TypeScript**: AbortController/AbortSignal

## Dependencies Required

### New Types Needed
1. **ReviewDecision** - Enum/union for approval decisions (Approve, Reject, Abort)
2. **TurnAbortReason** - Enum/union (Interrupted, Replaced, Error)
3. **ExecCommandContext** - Context for command execution
4. **ApplyPatchAction** - Patch operation descriptor
5. **ExecToolCallOutput** - Command execution result
6. **CallToolResult** - MCP tool call result
7. **RateLimitSnapshot** - Rate limit state
8. **BackgroundEventEvent**, **StreamErrorEvent** - Event types
9. **TaskCompleteEvent**, **TurnAbortedEvent** - Task lifecycle events
10. **ExecApprovalRequestEvent**, **ApplyPatchApprovalRequestEvent** - Approval events
11. **ExecCommandBeginEvent**, **ExecCommandEndEvent** - Command lifecycle events
12. **PatchApplyBeginEvent**, **PatchApplyEndEvent** - Patch lifecycle events
13. **TurnDiffEvent** - Diff tracking event
14. **TokenCountEvent** - Token usage event

### New Services/Managers Needed
1. **McpConnectionManager** - MCP server connection management
2. **TurnDiffTracker** - Track file changes across turn
3. **UserNotifier** - User notification service
4. **Shell** configuration type
5. **TaskRunner** infrastructure (possibly separate from Session)

### Modifications to Existing Types
1. **ActiveTurn** - Add tasks map, turn_state, drain/clear methods
2. **TurnState** - Add pending_approvals map, pending_input queue
3. **SessionState** - Ensure all token/rate limit methods exist
4. **SessionServices** - Add notifier, user_shell, show_raw_agent_reasoning

## Implementation Priority (Browser-Compatible Methods Only)

Based on dependencies and functionality layers, suggested implementation order for **22 browser-compatible methods**:

### Phase 1: Core State Management (Foundation) - 5 methods
1. **TurnAbortReason**, **ReviewDecision** enums (types)
2. **update_rate_limits()** - Rate limit tracking
3. **send_token_count_event()** - Token usage events
4. **record_into_history()** - History management
5. **replace_history()** - History replacement
6. **show_raw_agent_reasoning()**, **notifier()** - Utility getters

**Code Reuse:**
- Leverage existing `SessionState` for history operations
- Use existing event emitter pattern

### Phase 2: Event Infrastructure - 4 methods
7. **send_event()** - Fix to persist to rollout (enhance existing `emitEvent()`)
8. **notify_background_event()** - Background notifications
9. **notify_stream_error()** - Error notifications
10. **persist_rollout_response_items()** - Rollout persistence

**Code Reuse:**
- Integrate with existing `RolloutRecorder`
- Enhance existing event emitter

### Phase 3: Approval System - 1 method
11. **notify_approval()** - Generic approval notification pattern

**Code Reuse:**
- Use Promise-based approval pattern
- Store resolvers in ActiveTurn state

### Phase 4: Task Lifecycle (Core) - 8 methods
12. **RunningTask** type (new type definition)
13. **register_new_active_task()** - Task registration
14. **take_all_running_tasks()** - Task extraction
15. **handle_task_abort()** - Individual task abort
16. **abort_all_tasks()** - Abort all tasks
17. **spawn_task()** - Task spawning
18. **on_task_finished()** - Task completion
19. **interrupt_task()** - Public interrupt API

**Code Reuse:**
- Leverage existing `AgentTask` and `TaskRunner`
- Use AbortController for task cancellation
- Integrate with existing ActiveTurn pattern

### Phase 5: Rollout & History - 4 methods
20. **record_conversation_items()** - Enhance existing implementation
21. **record_input_and_rollout_usermsg()** - Dual persistence pattern
22. **reconstruct_history_from_rollout()** - Enhance existing (private method)
23. **update_token_usage_info()** - Token tracking with events

**Code Reuse:**
- Use existing `RolloutRecorder` methods
- Leverage existing `SessionState` history management
- Integrate with existing token tracking

### Phase 6: Advanced Features - 2 methods
24. **inject_input()** - Input injection for running tasks
25. **next_internal_sub_id()** - Internal ID generation

**Code Reuse:**
- Integrate with ActiveTurn pending input queue

### Phase 7: Initialization & Utilities - 2 methods
26. **new()** factory method - Refactor constructor (PARTIAL - exclude MCP/shell)
27. **record_initial_history()** - Session startup
28. **turn_input_with_history()** - Align signature with Rust

**Code Reuse:**
- Use existing initialization pattern
- Leverage Promise.all() for parallel init
- Reuse RolloutRecorder, SessionState

### Phase 8: Polish & Testing
29. Error handling improvements
30. TypeScript type refinements
31. Integration testing
32. Documentation

**Note on Excluded Methods:**
The following are NOT included in this roadmap (browser limitations):
- ~~`call_tool()`~~ (MCP)
- ~~`user_shell()`~~ (shell config)
- ~~`on_exec_command_begin/end()`~~ (shell execution)
- ~~`run_exec_with_events()`~~ (shell execution)
- ~~`request_command_approval()`~~ (shell commands)
- ~~`request_patch_approval()`~~ (file patches)
- ~~TurnDiffTracker~~ (file diffs)
- ~~MCP/shell initialization parts of `new()`~~

---

## Notes on Browser/Chrome Extension Environment

### Considerations:
1. **No Native Process Execution**: Command execution must go through Chrome APIs or content scripts
2. **Storage Limitations**: IndexedDB or Chrome Storage API instead of file system
3. **MCP Integration**: May need browser-compatible MCP client or bridge
4. **Event Handling**: Chrome message passing between background/content/sidepanel
5. **Concurrency Model**: Single-threaded JavaScript (no true parallelism)
6. **Session Persistence**: Must handle tab/extension lifecycle differently than CLI

### Browser-Specific Adaptations:
- Replace shell command execution with Chrome-specific APIs
- Use Chrome Storage API for rollout persistence
- Implement MCP over Chrome message passing or WebSocket
- Handle session restoration on extension restart
- Use service worker for background Session management

---

## Summary Statistics

### Original Analysis (All Methods)
- **Total Missing Methods**: 33
- **Public Methods**: 11
- **Private/Internal Methods**: 22
- **Event-Related**: 9
- **Task Lifecycle**: 9
- **Approval System**: 3
- **History/Rollout**: 7
- **Token/Rate Limit**: 2
- **Utility**: 3

### Browser-Compatible Subset (Updated 2025-10-01)
- **Browser-Compatible Methods**: 22 ✅
- **Excluded Methods**: 11 ❌
  - MCP-related: 3 methods
  - Shell/File operations: 8 methods

**Breakdown by Category (Browser-Compatible Only):**
- **Initialization**: 3 methods (1 partial)
- **Event Management**: 4 methods
- **Approval System**: 1 method (generic pattern only)
- **Task Lifecycle**: 8 methods
- **Rollout/History**: 6 methods
- **Token/Rate Limit**: 2 methods
- **Utility**: 2 methods

**Estimated Implementation Effort (Browser-Compatible Scope)**:
- Phase 1-2: ~1 week (foundation + events)
- Phase 3-4: ~2 weeks (approval + task lifecycle)
- Phase 5-6: ~1 week (rollout + advanced features)
- Phase 7-8: ~1 week (initialization + polish)
- **Total**: 4-6 weeks for browser-compatible implementation

**Reduced Scope Impact**:
- ~2-3 weeks saved by excluding MCP/shell/file operations
- Focus on core browser agent functionality
- Leverage existing codex-chrome components for faster development

**Critical Path**:
1. Task lifecycle management (most complex, 8 methods)
2. Event infrastructure + rollout integration
3. Initialization refactoring

**Code Reuse Opportunities**:
- `RolloutRecorder` - Already exists, use for all persistence
- `SessionState` - Already exists, use for history/tokens
- `AgentTask`/`TaskRunner` - Already exists, integrate with task lifecycle
- Event emitter - Already exists, enhance for rollout
- Protocol types - Already exists, fully compatible
