# Feature Specification: Align codex-chrome Model Client with Rust Implementation

**Feature Branch**: `010-refactor-the-codex`
**Created**: 2025-10-02
**Status**: Draft
**Input**: User description: "refactor the codex-chrome/src/models to make it consistent with original rust code: codex-rs/core/src/client.rs, codex-chrome/ is converted from codex-rs, it is converted from rust into typescript and codex-chrome is a chrome extension agent that run in browser. And codex-chrome/src/models are converted from codex-rs/core/src/client.rs, however, we still see several inconsistency implementation. This task is to make the implementation is consistent from original rust code including 1. same method names 2. same method input and output 3. same necessary struct name"

## Execution Flow (main)
```
1. Parse user description from Input
   → Identify: Rust codebase (source of truth), TypeScript codebase (target), specific inconsistencies
2. Extract key concepts from description
   → Actors: Developer maintaining codex-chrome
   → Actions: Rename methods, align parameters, rename types
   → Data: Model client implementation, method signatures, type definitions
   → Constraints: Must maintain browser compatibility, preserve existing functionality
3. For each unclear aspect:
   → [RESOLVED] Source file identified: codex-rs/core/src/client.rs
   → [RESOLVED] Target directory identified: codex-chrome/src/models
   → [RESOLVED] Scope is limited to method names, inputs/outputs, and struct names
4. Fill User Scenarios & Testing section
   → Primary scenario: Developer updates TypeScript to match Rust implementation
5. Generate Functional Requirements
   → All requirements are testable through code inspection and type checking
6. Identify Key Entities
   → ModelClient, method signatures, type definitions
7. Run Review Checklist
   → No implementation details specified (implementation is code refactoring itself)
   → No [NEEDS CLARIFICATION] markers remain
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
A developer working on the codex-chrome browser extension needs to maintain consistency with the original Rust codebase (codex-rs). The TypeScript model client implementation was ported from Rust but has diverged in naming conventions and method signatures. The developer needs to refactor the TypeScript code to exactly match the Rust implementation's method names, input/output signatures, and type names while preserving all existing functionality in the browser environment.

### Acceptance Scenarios

1. **Given** the TypeScript ModelClient implementation, **When** a developer compares it with the Rust client.rs implementation, **Then** all public method names must match exactly (e.g., `get_model_context_window` in Rust should be `getModelContextWindow` in TypeScript following TypeScript naming conventions).

2. **Given** a method exists in both Rust and TypeScript implementations, **When** the developer examines the method signatures, **Then** the input parameters and return types must align in structure and purpose (accounting for language-specific type differences like `Option<u64>` → `number | undefined`).

3. **Given** struct/type definitions in the Rust implementation, **When** the developer reviews the TypeScript type definitions, **Then** necessary types must have equivalent names and structures (e.g., `ResponseEvent`, `TokenUsage`, `RateLimitSnapshot`).

4. **Given** the refactored TypeScript code, **When** the existing browser extension functionality is tested, **Then** all features must continue to work without regression.

### Edge Cases

- What happens when Rust-specific features (like `Arc`, `OnceLock`) have no direct TypeScript equivalent? → Document the TypeScript approach and ensure functional equivalence
- How does the system handle method names that exist in TypeScript but not in Rust? → Flag for review and determine if they should be removed or documented as extensions
- What about methods that exist in Rust but serve no purpose in the browser environment (e.g., file I/O)? → Explicitly document why they are excluded

---

## Requirements

### Functional Requirements

- **FR-001**: The TypeScript ModelClient implementation MUST use method names that correspond to Rust implementation method names, following TypeScript camelCase convention (e.g., Rust `get_model` → TypeScript `getModel`)

- **FR-002**: All public methods in codex-rs/core/src/client.rs ModelClient struct MUST have equivalent methods in the TypeScript ModelClient with matching input parameters and return types (accounting for Rust-to-TypeScript type mappings)

- **FR-003**: The system MUST preserve Rust struct names in TypeScript as type/interface names where those structs are part of the public API (e.g., `ResponseEvent`, `TokenUsage`, `RateLimitSnapshot`, `ModelProviderInfo`)

- **FR-004**: Method input parameters MUST maintain the same order and semantic meaning as the Rust implementation, with type conversions documented (e.g., `Option<T>` → `T | undefined`)

- **FR-005**: Method return types MUST align structurally with Rust return types, using appropriate TypeScript equivalents (e.g., `Result<T>` → `Promise<T>`, `Option<T>` → `T | undefined`)

- **FR-006**: The refactored TypeScript code MUST maintain backward compatibility with existing codex-chrome extension functionality

- **FR-007**: Type definitions for request/response structures (e.g., `ResponsesApiRequest`, `StreamAttemptError`) MUST use naming consistent with Rust implementation

- **FR-008**: Private helper methods MUST align with Rust implementation where those helpers serve the same purpose (e.g., `parse_rate_limit_snapshot` → `parseRateLimitSnapshot`)

- **FR-009**: The system MUST document any intentional deviations from the Rust implementation that are required for browser compatibility

### Key Entities

- **ModelClient**: Core client class/struct that provides model interaction capabilities. Rust implementation serves as source of truth for method names and signatures.

- **ResponseEvent**: Event type emitted during model response streaming. Must preserve exact variant names from Rust enum (Created, OutputItemDone, Completed, etc.).

- **Method Signatures**: The contract between caller and implementation, including parameter names, types, order, and return types. Must maintain semantic equivalence across languages.

- **Type Mappings**: Translation rules between Rust and TypeScript types (e.g., `Arc<T>` → shared reference pattern, `Option<T>` → `T | undefined`, `Result<T, E>` → `Promise<T>`).

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none remaining)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed
