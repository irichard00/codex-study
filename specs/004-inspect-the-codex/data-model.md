# Data Model: Code Inspection Analysis

**Date**: 2025-09-29
**Purpose**: Define structures for categorizing and representing inspection findings

## Core Entities

### 1. ImprovementSuggestion

Represents a single actionable recommendation from the inspection.

**Fields**:
- `id`: Unique identifier (string, format: "IS-001", "IS-002", etc.)
- `category`: Classification of the issue
  - Values: "critical_bug" | "architectural_mismatch" | "feature_gap" | "code_duplication" | "acceptable_adaptation"
- `severity`: Impact level
  - Values: "critical" | "medium" | "low"
- `title`: Brief description (string, max 100 chars)
- `description`: Detailed explanation of the issue (string)
- `location`: Code location reference
  - `file`: File path (string)
  - `lineStart`: Starting line number (number)
  - `lineEnd`: Ending line number (number, optional)
  - `functionName`: Function/method name (string, optional)
- `impact`: Description of functional impact (string)
- `recommendedFix`: Suggested approach to resolve (string)
- `rustReference`: Reference to corresponding Rust code
  - `file`: File path in codex-rs (string)
  - `lineStart`: Starting line number (number)
  - `lineEnd`: Ending line number (number, optional)
  - `note`: Explanation of Rust behavior (string, optional)

**Validation Rules**:
- `id` must be unique across all suggestions
- `category` must be one of the defined enum values
- `severity` must be one of: critical, medium, low
- `location.file` must exist in the codebase
- `location.lineStart` must be > 0
- If `category` is "acceptable_adaptation", `severity` should typically be "low"
- If `severity` is "critical", `recommendedFix` is mandatory

**Example**:
```json
{
  "id": "IS-001",
  "category": "architectural_mismatch",
  "severity": "medium",
  "title": "Token compaction threshold mismatch",
  "description": "TypeScript uses 75% threshold (COMPACTION_THRESHOLD) while Rust uses 90% threshold, causing earlier compaction in browser extension",
  "location": {
    "file": "codex-chrome/src/core/TaskRunner.ts",
    "lineStart": 69,
    "functionName": "TaskRunner class constants"
  },
  "impact": "Browser extension will compact conversation context earlier than CLI, potentially losing more history than necessary",
  "recommendedFix": "Change COMPACTION_THRESHOLD to 0.9 to match Rust behavior, or document why earlier compaction is needed for browser environment",
  "rustReference": {
    "file": "codex-rs/core/src/codex.rs",
    "lineStart": 1850,
    "note": "Rust uses 90% threshold: total_usage_tokens >= limit check"
  }
}
```

---

### 2. ComparisonResult

Represents the overall results of comparing two implementations.

**Fields**:
- `rustImplementation`: Metadata about Rust code
  - `file`: File path (string)
  - `functionName`: Function name (string)
  - `lineStart`: Starting line (number)
  - `lineEnd`: Ending line (number)
  - `lineCount`: Total lines (number)
- `typeScriptImplementation`: Metadata about TypeScript code
  - `file`: File path (string)
  - `className`: Class name (string)
  - `lineStart`: Starting line (number)
  - `lineEnd`: Ending line (number)
  - `lineCount`: Total lines (number)
- `analysisDate`: When analysis was performed (ISO 8601 string)
- `suggestions`: Array of ImprovementSuggestion objects
- `summary`: High-level summary
  - `totalIssues`: Total count (number)
  - `criticalCount`: Count of critical issues (number)
  - `mediumCount`: Count of medium issues (number)
  - `lowCount`: Count of low severity issues (number)
  - `categoryBreakdown`: Object with counts per category
- `architecturePreserved`: Boolean indicating if SQ/EQ architecture is intact
- `featureParity`: Percentage of feature parity (0-100)

**Validation Rules**:
- `suggestions` array must not contain duplicate IDs
- `summary.totalIssues` must equal length of `suggestions` array
- `summary.criticalCount + mediumCount + lowCount` must equal `totalIssues`
- `featureParity` must be between 0 and 100

---

### 3. DifferencePoint

Represents a specific difference found during line-by-line analysis.

**Fields**:
- `aspect`: What is being compared
  - Values: "event_emission" | "loop_logic" | "error_handling" | "state_management" | "history_recording" | "cancellation" | "response_handling"
- `rustBehavior`: Description of Rust implementation behavior (string)
- `typeScriptBehavior`: Description of TypeScript implementation behavior (string)
- `matches`: Boolean - do they match semantically?
- `notes`: Additional context or explanation (string, optional)
- `relatedSuggestion`: Link to ImprovementSuggestion ID if actionable (string, optional)

**Example**:
```json
{
  "aspect": "loop_logic",
  "rustBehavior": "Infinite loop with explicit break when responses.is_empty()",
  "typeScriptBehavior": "While loop with taskComplete flag and MAX_TURNS limit",
  "matches": false,
  "notes": "TypeScript adds max turns safeguard (50 turns) not present in Rust",
  "relatedSuggestion": "IS-005"
}
```

---

### 4. ResponseItemTypeAnalysis

Tracks which response item types are handled in each implementation.

**Fields**:
- `typeName`: Name of the response item type (string)
  - Examples: "Message", "FunctionCall", "CustomToolCall", "LocalShellCall", "Reasoning"
- `handledInRust`: Boolean
- `rustLocation`: Location in Rust code (line number or null)
- `handledInTypeScript`: Boolean
- `typeScriptLocation`: Location in TypeScript code (line number or null)
- `behaviorMatch`: Boolean - if handled in both, do they match?
- `gap`: Boolean - is this a missing feature in TypeScript?

**Validation Rules**:
- If `handledInRust` is true, `rustLocation` must be provided
- If `handledInTypeScript` is true, `typeScriptLocation` must be provided
- `gap` is true only when `handledInRust` is true and `handledInTypeScript` is false
- `behaviorMatch` can only be true when both `handledInRust` and `handledInTypeScript` are true

---

### 5. CodeDuplicationAnalysis

Identifies duplicate code within the TypeScript implementation.

**Fields**:
- `path1`: First code location
  - `file`: File path (string)
  - `functionName`: Function name (string)
  - `lineStart`: Starting line (number)
  - `lineEnd`: Ending line (number)
- `path2`: Second code location (same structure as path1)
- `overlapPercentage`: Percentage of code overlap (0-100)
- `description`: What functionality is duplicated (string)
- `recommendation`: How to consolidate (string)

**Example**:
```json
{
  "path1": {
    "file": "codex-chrome/src/core/TaskRunner.ts",
    "functionName": "run",
    "lineStart": 143,
    "lineEnd": 188
  },
  "path2": {
    "file": "codex-chrome/src/core/TaskRunner.ts",
    "functionName": "executeWithCoordination",
    "lineStart": 514,
    "lineEnd": 548
  },
  "overlapPercentage": 80,
  "description": "Turn loop logic with pending input, turn execution, and result processing",
  "recommendation": "Extract shared turn loop logic into private method runTurnLoop(), have both run() and executeWithCoordination() call it with appropriate state tracking"
}
```

---

## Relationships

```
ComparisonResult
  └── suggestions: ImprovementSuggestion[]
        └── location references DifferencePoint or CodeDuplicationAnalysis

DifferencePoint
  └── relatedSuggestion: ImprovementSuggestion.id

ResponseItemTypeAnalysis
  └── Can generate ImprovementSuggestion when gap=true

CodeDuplicationAnalysis
  └── Generates ImprovementSuggestion with category="code_duplication"
```

---

## State Transitions

### ImprovementSuggestion Lifecycle
1. **Identified**: Suggestion created during analysis
2. **Validated**: Confirmed as actual issue (not false positive)
3. **Categorized**: Category and severity assigned
4. **Documented**: Full description and recommended fix added
5. **Ready**: Included in final ComparisonResult

### ComparisonResult Status
- **In Progress**: Analysis ongoing
- **Complete**: All aspects analyzed, suggestions documented
- **Reviewed**: Human reviewed the findings
- **Implemented**: Fixes applied based on suggestions

---

## Usage Notes

1. **Categorization Guidelines**:
   - `critical_bug`: Breaks functionality, data loss, crashes
   - `architectural_mismatch`: Violates SQ/EQ pattern or core design
   - `feature_gap`: Missing functionality present in Rust
   - `code_duplication`: Repeated logic, maintenance burden
   - `acceptable_adaptation`: Intentional difference for browser context

2. **Severity Assignment**:
   - `critical`: Must fix before production use
   - `medium`: Should fix, impacts quality or maintainability
   - `low`: Nice to have, minor improvements

3. **Creating Suggestions**:
   - Always provide line numbers for traceability
   - Reference corresponding Rust code when applicable
   - Be specific in recommended fixes
   - Explain impact in terms of user-facing behavior or developer experience