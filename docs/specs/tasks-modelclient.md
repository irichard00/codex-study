# Implementation Tasks: ModelClient Alignment

## Overview
Detailed task breakdown for aligning the TypeScript ModelClient with the Rust implementation to support OpenAI Responses API and advanced streaming features.

## Task Organization
- **Priority**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
- **Effort**: XS (< 2h), S (2-4h), M (4-8h), L (8-16h), XL (> 16h)
- **Dependencies**: Listed for each task

---

## Phase 1: Core Types and Infrastructure

### TASK-001: Create ResponseEvent Types
**Priority**: P0
**Effort**: S
**Dependencies**: None
**Description**: Port ResponseEvent enum and all variants from Rust to TypeScript

**Implementation Steps**:
1. Create `src/models/types/ResponseEvent.ts`
2. Define ResponseEvent discriminated union type
3. Add all 9 event variants from Rust
4. Create type guards for runtime validation
5. Add unit tests for type checking

**Acceptance Criteria**:
- All event types match Rust naming exactly
- Type guards correctly identify event types
- Passes TypeScript strict mode compilation

---

### TASK-002: Implement TokenUsage Types
**Priority**: P0
**Effort**: XS
**Dependencies**: None
**Description**: Create TokenUsage interface with cached and reasoning token support

**Implementation Steps**:
1. Create `src/models/types/TokenUsage.ts`
2. Define TokenUsage interface with 5 fields
3. Add TokenUsageInfo for session tracking
4. Create aggregation utilities
5. Add validation functions

**Acceptance Criteria**:
- Includes cached_input_tokens field
- Includes reasoning_output_tokens field
- Aggregation correctly sums token counts

---

### TASK-003: Add RateLimit Types
**Priority**: P0
**Effort**: XS
**Dependencies**: None
**Description**: Create RateLimitSnapshot and RateLimitWindow types

**Implementation Steps**:
1. Create `src/models/types/RateLimits.ts`
2. Define RateLimitSnapshot interface
3. Define RateLimitWindow interface
4. Add parsing utilities for headers
5. Create mock data for testing

**Acceptance Criteria**:
- Types match Rust structure
- Optional fields handled correctly
- Header parsing extracts all fields

---

### TASK-004: Update Retry Logic
**Priority**: P0
**Effort**: M
**Dependencies**: None
**Description**: Implement exponential backoff with proportional jitter

**Implementation Steps**:
1. Update `src/models/ModelClient.ts`
2. Add calculateBackoff method with proper formula
3. Implement proportional jitter (10%)
4. Add retry configuration options
5. Create comprehensive retry tests

**Acceptance Criteria**:
- Backoff follows exponential curve
- Jitter is proportional (10% of delay)
- Max retries configurable
- Handles rate limit delays

---

## Phase 2: SSE Processing

### TASK-005: Create SSE Event Parser
**Priority**: P0
**Effort**: L
**Dependencies**: TASK-001
**Description**: Build comprehensive SSE event parser for Responses API

**Implementation Steps**:
1. Create `src/models/SSEEventParser.ts`
2. Implement SSE text parsing logic
3. Add event type routing (15+ types)
4. Handle malformed events gracefully
5. Add streaming tests with mock data

**Acceptance Criteria**:
- Parses all 15+ SSE event types
- Handles multi-line events
- Recovers from parse errors
- Emits proper ResponseEvents

---

### TASK-006: Process SSE Stream Function
**Priority**: P0
**Effort**: L
**Dependencies**: TASK-005
**Description**: Port process_sse function from Rust

**Implementation Steps**:
1. Create async generator for SSE processing
2. Implement buffer management
3. Add idle timeout detection
4. Handle stream completion events
5. Integrate error recovery

**Acceptance Criteria**:
- Processes events in real-time
- Handles idle timeout (30s)
- Completes on response.completed
- Emits errors properly

---

### TASK-007: Integrate with StreamProcessor
**Priority**: P1
**Effort**: M
**Dependencies**: TASK-005, TASK-006
**Description**: Extend StreamProcessor for ResponseEvent handling

**Implementation Steps**:
1. Update `src/core/StreamProcessor.ts`
2. Add ResponseEvent emission support
3. Implement event batching for UI
4. Add backpressure handling
5. Create performance tests

**Acceptance Criteria**:
- Batches UI updates efficiently
- Applies backpressure when needed
- Memory usage stays under 50MB
- Processing time < 10ms per event

---

## Phase 3: Responses API Client

### TASK-008: Create OpenAIResponsesClient
**Priority**: P0
**Effort**: XL
**Dependencies**: TASK-001, TASK-005
**Description**: Implement full Responses API client

**Implementation Steps**:
1. Create `src/models/OpenAIResponsesClient.ts`
2. Extend ModelClient base class
3. Implement streamResponses method
4. Add request payload construction
5. Handle authentication headers
6. Create integration tests

**Acceptance Criteria**:
- Supports /v1/responses endpoint
- Handles streaming SSE responses
- Includes all required headers
- Authentication works correctly

---

### TASK-009: Add Request Types
**Priority**: P0
**Effort**: S
**Dependencies**: None
**Description**: Create ResponsesApiRequest and related types

**Implementation Steps**:
1. Create `src/models/types/ResponsesAPI.ts`
2. Define ResponsesApiRequest interface
3. Add Reasoning configuration types
4. Add TextControls for GPT-5
5. Create request builders

**Acceptance Criteria**:
- All fields from Rust included
- Optional fields handled correctly
- Serializes to correct JSON

---

### TASK-010: Implement Prompt Interface
**Priority**: P1
**Effort**: M
**Dependencies**: TASK-009
**Description**: Create Prompt class matching Rust

**Implementation Steps**:
1. Define Prompt interface
2. Add instruction formatting logic
3. Implement tool JSON generation
4. Add output schema support
5. Create prompt builder utilities

**Acceptance Criteria**:
- Matches Rust Prompt struct
- Formats instructions correctly
- Tools serialize properly

---

## Phase 4: Rate Limiting

### TASK-011: Create RateLimitManager
**Priority**: P1
**Effort**: M
**Dependencies**: TASK-003
**Description**: Build rate limit tracking and management

**Implementation Steps**:
1. Create `src/models/RateLimitManager.ts`
2. Implement header parsing logic
3. Add snapshot storage
4. Create retry decision logic
5. Add rate limit tests

**Acceptance Criteria**:
- Parses all x-codex headers
- Tracks primary/secondary windows
- Calculates retry delays
- Updates from response headers

---

### TASK-012: Parse Retry-After Header
**Priority**: P1
**Effort**: S
**Dependencies**: None
**Description**: Extract retry delays from error messages

**Implementation Steps**:
1. Port regex pattern from Rust
2. Implement parseRetryAfter function
3. Handle both seconds and milliseconds
4. Add error message parsing
5. Create parsing tests

**Acceptance Criteria**:
- Matches "Please try again in X.Ys" format
- Handles millisecond format
- Returns Duration object
- Fallback for unparseable

---

## Phase 5: Token Usage Tracking

### TASK-013: Create TokenUsageTracker
**Priority**: P1
**Effort**: M
**Dependencies**: TASK-002
**Description**: Implement session-level token aggregation

**Implementation Steps**:
1. Create `src/models/TokenUsageTracker.ts`
2. Add update method for new usage
3. Implement history tracking
4. Add compaction detection
5. Create aggregation tests

**Acceptance Criteria**:
- Aggregates across turns
- Tracks last usage separately
- Detects when to compact
- History queryable by time

---

### TASK-014: Add Token Usage to Events
**Priority**: P1
**Effort**: S
**Dependencies**: TASK-002, TASK-005
**Description**: Extract token usage from response.completed

**Implementation Steps**:
1. Update SSE parser for usage extraction
2. Map OpenAI usage to TokenUsage
3. Include cached/reasoning tokens
4. Emit with Completed event
5. Add usage validation

**Acceptance Criteria**:
- Extracts all usage fields
- Maps correctly to TokenUsage
- Included in Completed event

---

## Phase 6: Authentication

### TASK-015: Create AuthManager Interface
**Priority**: P2
**Effort**: M
**Dependencies**: None
**Description**: Build authentication abstraction layer

**Implementation Steps**:
1. Create `src/models/AuthManager.ts`
2. Define AuthManager interface
3. Add CodexAuth types
4. Create ChromeAuthManager implementation
5. Add storage encryption

**Acceptance Criteria**:
- Supports API key auth
- Secure storage in Chrome
- Token refresh capability
- Account ID extraction

---

### TASK-016: Add API Key Storage
**Priority**: P2
**Effort**: S
**Dependencies**: TASK-015
**Description**: Secure API key storage in Chrome extension

**Implementation Steps**:
1. Use chrome.storage.local API
2. Implement encryption/decryption
3. Add key validation
4. Create settings UI
5. Add security tests

**Acceptance Criteria**:
- Keys stored securely
- Not visible in dev tools
- Validates on save
- User-friendly UI

---

## Phase 7: Error Handling

### TASK-017: Enhance Error Types
**Priority**: P1
**Effort**: S
**Dependencies**: None
**Description**: Extend ModelClientError with Rust features

**Implementation Steps**:
1. Update ModelClientError class
2. Add UsageLimitReachedError
3. Include rate limit info
4. Add plan type tracking
5. Create error factories

**Acceptance Criteria**:
- Matches Rust error types
- Includes all metadata
- Serializable for logging
- User-friendly messages

---

### TASK-018: Handle Response Failures
**Priority**: P1
**Effort**: M
**Dependencies**: TASK-005, TASK-017
**Description**: Process response.failed SSE events

**Implementation Steps**:
1. Parse response.failed events
2. Extract error details
3. Determine if retryable
4. Emit appropriate errors
5. Add failure tests

**Acceptance Criteria**:
- Handles all failure types
- Extracts retry delays
- Identifies retryable errors
- Clean error propagation

---

## Phase 8: Testing

### TASK-019: Create Mock SSE Streams
**Priority**: P1
**Effort**: M
**Dependencies**: TASK-005
**Description**: Build test infrastructure for SSE

**Implementation Steps**:
1. Create MockSSEStream class
2. Add event sequence builder
3. Implement error injection
4. Create fixture loader
5. Add timing controls

**Acceptance Criteria**:
- Simulates real SSE streams
- Controllable timing
- Error injection capability
- Loads from fixtures

---

### TASK-020: Integration Test Suite
**Priority**: P1
**Effort**: L
**Dependencies**: TASK-008, TASK-019
**Description**: Comprehensive integration tests

**Implementation Steps**:
1. Test streaming scenarios
2. Test error recovery
3. Test rate limiting
4. Test token tracking
5. Create CI pipeline

**Acceptance Criteria**:
- 80% code coverage
- All scenarios tested
- Runs in CI/CD
- Performance benchmarks

---

## Phase 9: Performance Optimization

### TASK-021: Optimize SSE Parsing
**Priority**: P2
**Effort**: M
**Dependencies**: TASK-005
**Description**: Improve SSE processing performance

**Implementation Steps**:
1. Profile current implementation
2. Optimize hot paths
3. Add buffer pooling
4. Implement lazy parsing
5. Create benchmarks

**Acceptance Criteria**:
- < 10ms per event
- Memory efficient
- No memory leaks
- Benchmark suite

---

### TASK-022: Add Request Queuing
**Priority**: P3
**Effort**: M
**Dependencies**: TASK-008
**Description**: Queue requests to avoid rate limits

**Implementation Steps**:
1. Create request queue
2. Add priority support
3. Implement rate limiting
4. Add queue persistence
5. Create queue tests

**Acceptance Criteria**:
- FIFO with priority
- Respects rate limits
- Persists across restarts
- Configurable limits

---

## Phase 10: Documentation

### TASK-023: API Documentation
**Priority**: P2
**Effort**: M
**Dependencies**: All code tasks
**Description**: Complete API documentation

**Implementation Steps**:
1. Document all public APIs
2. Add code examples
3. Create migration guide
4. Add troubleshooting
5. Generate API docs

**Acceptance Criteria**:
- All APIs documented
- Examples for each feature
- Migration path clear
- Troubleshooting complete

---

### TASK-024: Update README
**Priority**: P2
**Effort**: S
**Dependencies**: TASK-023
**Description**: Update project documentation

**Implementation Steps**:
1. Update feature list
2. Add configuration section
3. Update examples
4. Add performance notes
5. Update dependencies

**Acceptance Criteria**:
- Accurate feature list
- Clear setup instructions
- Working examples
- Performance guidance

---

## Execution Order

### Week 1: Foundation
1. TASK-001: ResponseEvent Types
2. TASK-002: TokenUsage Types
3. TASK-003: RateLimit Types
4. TASK-004: Update Retry Logic

### Week 2: SSE Processing
5. TASK-005: SSE Event Parser
6. TASK-006: Process SSE Stream
7. TASK-007: StreamProcessor Integration
8. TASK-019: Mock SSE Streams

### Week 3: Responses API
9. TASK-008: OpenAIResponsesClient
10. TASK-009: Request Types
11. TASK-010: Prompt Interface
12. TASK-020: Integration Tests

### Week 4: Enhanced Features
13. TASK-011: RateLimitManager
14. TASK-012: Parse Retry-After
15. TASK-013: TokenUsageTracker
16. TASK-014: Token Usage Events
17. TASK-017: Error Types
18. TASK-018: Handle Failures

### Week 5: Polish
19. TASK-015: AuthManager
20. TASK-016: API Key Storage
21. TASK-021: Optimize Performance
22. TASK-023: Documentation
23. TASK-024: Update README

## Success Metrics
- All tasks completed: 100%
- Test coverage: > 80%
- Performance: < 10ms per SSE event
- Memory usage: < 50MB for streams
- Documentation: 100% public APIs