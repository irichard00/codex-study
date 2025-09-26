# Implementation Tasks: ModelClient Alignment Refactoring

## Overview
Refactor the TypeScript ModelClient to achieve feature parity with the Rust implementation, adding OpenAI Responses API support, comprehensive SSE event processing, rate limiting, and enhanced token tracking.

## Task Execution Order

### Phase 1: Setup & Testing Infrastructure
These tasks establish the foundation and test harness.

**[X] T001: Create Type Directories [P]**
- Create directory structure at `codex-chrome/src/models/types/`
- Create empty type files: ResponseEvent.ts, TokenUsage.ts, RateLimits.ts, ResponsesAPI.ts
- Add index.ts for barrel exports

**[X] T002: Setup Test Infrastructure [P]**
- Create test directory at `codex-chrome/src/models/__tests__/`
- Install test dependencies: @vitest/ui if needed
- Create test configuration for model tests
- Add mock data fixtures directory

**[X] T003: Create Feature Branch [P]**
- Run `git checkout -b feature/modelclient-alignment`
- Update package.json with any new dependencies
- Create .env.example with OPENAI_API_KEY placeholder

### Phase 2: Core Type Implementation
These tasks can be executed in parallel groups.

**[X] T004: Implement ResponseEvent Types [P]**
- File: `codex-chrome/src/models/types/ResponseEvent.ts`
- Create ResponseEvent discriminated union with 9 variants
- Add ResponseItem interface with all fields from Rust
- Create ContentBlock interface
- Add type guards: isResponseEvent, isOutputItemDone, etc.
- Export all types

**[X] T005: Implement TokenUsage Types [P]**
- File: `codex-chrome/src/models/types/TokenUsage.ts`
- Create TokenUsage interface with 5 fields (including cached/reasoning)
- Create TokenUsageInfo interface for session tracking
- Add aggregation helper functions
- Create zero-initialized factory function

**[X] T006: Implement RateLimit Types [P]**
- File: `codex-chrome/src/models/types/RateLimits.ts`
- Create RateLimitSnapshot interface
- Create RateLimitWindow interface
- Add type guards for validation
- Create factory functions

**[X] T007: Write Unit Tests for Types [P]**
- File: `codex-chrome/src/models/__tests__/types.test.ts`
- Test type guards for ResponseEvent
- Test TokenUsage aggregation
- Test RateLimit validation
- Verify TypeScript compilation

### Phase 3: SSE Processing Implementation
These tasks build on the types and need sequential execution in some cases.

**[X] T008: Create SSEEventParser Class**
- File: `codex-chrome/src/models/SSEEventParser.ts`
- Implement parse() method for raw SSE text
- Add processEvent() for routing events
- Handle all 15+ event types from Rust
- Add error recovery for malformed events
- Include parseRetryAfter() method with regex

**[X] T009: Create SSE Event Tests [P]**
- File: `codex-chrome/src/models/__tests__/SSEEventParser.test.ts`
- Test parsing of each event type
- Test malformed event handling
- Test retry-after extraction
- Use mock SSE data fixtures

**[X] T010: Update ModelClient Base Class**
- File: `codex-chrome/src/models/ModelClient.ts`
- Update calculateBackoff() with proportional jitter (10%)
- Modify withRetry() to use new backoff
- Add isRetryableError() method
- Update RetryConfig interface

**[X] T011: Create ResponseStream Class [P]**
- File: `codex-chrome/src/models/ResponseStream.ts`
- Implement async iterator protocol
- Add event buffering
- Handle backpressure
- Support abort signals

### Phase 4: Responses API Client
Core implementation of the new OpenAI Responses API support.

**[X] T012: Create OpenAIResponsesClient**
- File: `codex-chrome/src/models/OpenAIResponsesClient.ts`
- Extend ModelClient base class
- Implement streamResponses() method
- Add processSSEStream() private method
- Handle authentication headers
- Parse response headers for rate limits

**[X] T013: Implement Request Types [P]**
- File: `codex-chrome/src/models/types/ResponsesAPI.ts`
- Create ResponsesApiRequest interface
- Add Prompt interface
- Create Reasoning and TextControls types
- Add ModelFamily and ModelProviderInfo interfaces

**[X] T014: Create Responses API Tests**
- File: `codex-chrome/src/models/__tests__/OpenAIResponsesClient.test.ts`
- Test request payload construction
- Test SSE stream processing
- Mock fetch responses
- Verify header handling

### Phase 5: Rate Limiting & Token Tracking
Enhanced features for production use.

**[X] T015: Create RateLimitManager [P]**
- File: `codex-chrome/src/models/RateLimitManager.ts`
- Implement updateFromHeaders() method
- Parse x-codex-primary-* headers
- Track snapshot history
- Add shouldRetry() logic
- Calculate retry delays

**[X] T016: Create TokenUsageTracker [P]**
- File: `codex-chrome/src/models/TokenUsageTracker.ts`
- Implement update() for new usage
- Track session totals
- Add shouldCompact() detection
- Provide getUsageForRange() queries

**[X] T017: Integration Tests for Features**
- File: `codex-chrome/src/models/__tests__/integration.test.ts`
- Test rate limit header parsing
- Test token usage aggregation
- Test retry with rate limits
- End-to-end streaming test

### Phase 6: StreamProcessor Integration
Wire the new features into existing infrastructure.

**[X] T018: Extend StreamProcessor**
- File: `codex-chrome/src/core/StreamProcessor.ts`
- Add processResponsesStream() method
- Integrate ResponseEvent emission
- Support new event types
- Maintain backward compatibility

**[X] T019: Update Chrome Message Routing**
- File: `codex-chrome/src/core/MessageRouter.ts`
- Add routes for ResponseEvent types
- Handle new streaming events
- Update type definitions
- Test message passing

### Phase 7: Authentication & Storage
Secure API key management for Chrome extension.

**[X] T020: Create ChromeAuthManager [P]**
- File: `codex-chrome/src/models/ChromeAuthManager.ts`
- Implement AuthManager interface
- Use chrome.storage.local for keys
- Add encryption/decryption
- Handle token refresh stubs

**[X] T021: Create Settings UI Component [P]**
- File: `codex-chrome/src/sidepanel/Settings.svelte`
- Add API key input field
- Implement secure storage
- Add validation feedback
- Create save/update handlers

### Phase 8: Error Handling Enhancement
Robust error management matching Rust implementation.

**[X] T022: Extend Error Types**
- File: `codex-chrome/src/models/ModelClientError.ts`
- Add UsageLimitReachedError class
- Include rate limit metadata
- Add plan type tracking
- Create error factories

**[X] T023: Add Error Recovery Tests [P]**
- File: `codex-chrome/src/models/__tests__/error-handling.test.ts`
- Test usage limit errors
- Test network failures
- Test retry scenarios
- Verify error metadata

### Phase 9: Performance & Polish
Final optimizations and production readiness.

**[X] T024: Performance Optimization**
- File: Multiple files in `codex-chrome/src/models/`
- Profile SSE parsing performance
- Optimize hot paths in event processing
- Add memory pooling for buffers
- Implement lazy parsing where possible
- Target < 10ms per event

**[X] T025: Add Request Queuing [P]**
- File: `codex-chrome/src/models/RequestQueue.ts`
- Implement FIFO queue with priority
- Respect rate limits automatically
- Add persistence across restarts
- Create queue management API

**[X] T026: Documentation Update [P]**
- Files: README.md, CHANGELOG.md, docs/
- Update README.md with new features
- Document API changes in CHANGELOG.md
- Add migration guide from old client
- Create usage examples
- Update TypeDoc comments

**[X] T027: Integration with Existing Code**
- Files: Multiple existing files in `codex-chrome/src/`
- Update imports in existing files
- Replace old OpenAIClient usage
- Test with existing features
- Verify Chrome extension still works
- Run full test suite

## Parallel Execution Examples

Group 1 - Initial setup (run these first):
```bash
# Can run in parallel with Task agent
/task "Create Type Directories" T001 [P]
/task "Setup Test Infrastructure" T002 [P]
/task "Create Feature Branch" T003 [P]
```

Group 2 - Core types (after setup):
```bash
# Different files, can parallelize
/task "Implement ResponseEvent Types" T004 [P]
/task "Implement TokenUsage Types" T005 [P]
/task "Implement RateLimit Types" T006 [P]
/task "Write Unit Tests for Types" T007 [P]
```

Group 3 - Features (after types):
```bash
# Independent features
/task "Create RateLimitManager" T015 [P]
/task "Create TokenUsageTracker" T016 [P]
/task "Create ChromeAuthManager" T020 [P]
```

Group 4 - Documentation & Testing:
```bash
# Can run while implementation continues
/task "Add Error Recovery Tests" T023 [P]
/task "Documentation Update" T026 [P]
```

## Task Dependencies
- **T001-T003** must complete before any implementation
- **T004-T006** (types) must complete before T008 (SSEEventParser)
- **T008** (SSEEventParser) must complete before T012 (OpenAIResponsesClient)
- **T012** (OpenAIResponsesClient) must complete before T014 (tests)
- **T010** (ModelClient update) should happen before T012
- **T018** (StreamProcessor) depends on T011 (ResponseStream)
- **T027** (Integration) must be last, after all other tasks

## Critical Path
1. T001-T003 (Setup) → 2 hours
2. T004-T006 (Types) → 4 hours
3. T008 (SSEEventParser) → 6 hours
4. T012 (OpenAIResponsesClient) → 8 hours
5. T027 (Integration) → 4 hours
**Total Critical Path: ~24 hours**

## Notes
- Tasks marked [P] can be executed in parallel
- Each task specifies exact file paths for implementation
- All tasks are self-contained with clear acceptance criteria
- Use feature flags for gradual rollout: `ENABLE_RESPONSES_API`
- Maintain backward compatibility with existing OpenAIClient
- Target 80% test coverage for new code
- Performance target: < 10ms per SSE event processing