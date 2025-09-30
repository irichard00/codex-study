# Quickstart: TaskRunner Implementation Inspection

**Purpose**: Run the code inspection analysis to compare TaskRunner.ts with run_task and generate improvement suggestions.

## Prerequisites

- Access to both codebases:
  - `codex-chrome/` (TypeScript implementation)
  - `codex-rs/` (Rust reference implementation)
- Understanding of SQ/EQ architecture pattern
- Familiarity with the protocol types (Event, EventMsg, InputItem, etc.)

## Quick Start

### Step 1: Locate the Code

**TypeScript Implementation**:
```bash
# Target file
cat codex-chrome/src/core/TaskRunner.ts

# Expected: 613 lines, class TaskRunner with run() and executeWithCoordination() methods
```

**Rust Reference**:
```bash
# Reference implementation
head -n 286 codex-rs/core/src/codex.rs | tail -n 286 | grep -A 286 "async fn run_task"

# Or directly view lines 1635-1920
sed -n '1635,1920p' codex-rs/core/src/codex.rs
```

---

### Step 2: Run Structural Comparison

**Compare Key Sections**:

1. **Task Initialization**:
   - Rust: Lines 1641-1665 (event emission, review mode setup)
   - TypeScript: Lines 113-137 (TaskStarted event, review mode branching)

2. **Main Turn Loop**:
   - Rust: Lines 1673-1896 (loop with break conditions)
   - TypeScript: Lines 143-188 (while loop with taskComplete flag)

3. **Turn Result Processing**:
   - Rust: Lines 1726-1843 (match on ResponseItem variants)
   - TypeScript: Lines 306-359 (processTurnResult method)

4. **Error Handling**:
   - Rust: Lines 1883-1895 (turn error branch)
   - TypeScript: Lines 181-187, 378-393 (handleTurnError method)

5. **Task Completion**:
   - Rust: Lines 1914-1919 (remove task, emit TaskComplete)
   - TypeScript: Lines 190-201 (emit TaskComplete with result)

---

### Step 3: Verify Event Emission

**Expected Events** (in order):

1. ✅ **TaskStarted** - emitted at task initialization
   - Rust: Line 1644-1650
   - TypeScript: Line 121-126

2. ✅ **TurnAborted** - emitted on cancellation or error
   - Rust: Implicit (session handles)
   - TypeScript: Line 154-155, 434-441

3. ✅ **Error** - emitted on task failure
   - Rust: Line 1885-1890
   - TypeScript: Line 207-212

4. ✅ **TaskComplete** - emitted at task end
   - Rust: Line 1915-1918
   - TypeScript: Line 191-196

**Verification**:
```bash
# Check event emission in TypeScript
grep -n "emitEvent" codex-chrome/src/core/TaskRunner.ts

# Check event emission in Rust
grep -n "send_event" codex-rs/core/src/codex.rs | sed -n '1635,1920p'
```

---

### Step 4: Check Response Item Handling

**Response Item Types to Verify**:

| Type | Rust Handled | TS Handled | Location (Rust) | Location (TS) |
|------|--------------|------------|-----------------|---------------|
| Message (assistant) | ✅ | ✅ | Line 1746-1748 | Line 325-327 |
| FunctionCall | ✅ | ⚠️ | Line 1762-1773 | Generic handling |
| CustomToolCall | ✅ | ⚠️ | Line 1774-1785 | Generic handling |
| LocalShellCall | ✅ | ⚠️ | Line 1751-1761 | Not explicit |
| Reasoning | ✅ | ❌ | Line 1810-1823 | Missing |

**Test Command**:
```bash
# Search for response item handling in TypeScript
grep -n "processedItem\|ResponseItem\|item.role" codex-chrome/src/core/TaskRunner.ts

# Search for response item handling in Rust
sed -n '1744,1830p' codex-rs/core/src/codex.rs | grep -n "ResponseItem::"
```

---

### Step 5: Analyze Token Management

**Compare Token Limits**:

1. **Rust Approach**:
   ```rust
   // Line 1731-1733: Get limit from client
   let limit = turn_context.client.get_auto_compact_token_limit().unwrap_or(i64::MAX);

   // Line 1738-1740: Check if reached
   let token_limit_reached = total_usage_tokens
       .map(|tokens| (tokens as i64) >= limit)
       .unwrap_or(false);
   ```

2. **TypeScript Approach**:
   ```typescript
   // Line 69: Hardcoded threshold
   private static readonly COMPACTION_THRESHOLD = 0.75;

   // Line 349-352: Check threshold
   const tokenLimitReached = totalTokenUsage && contextWindow
     ? totalTokenUsage.total_tokens >= contextWindow * 0.9
     : false;
   ```

**Expected Finding**: ⚠️ Mismatch in threshold calculation approach

---

### Step 6: Identify Code Duplication

**Dual Execution Paths**:

```bash
# Compare run() and executeWithCoordination() methods
diff <(sed -n '113,219p' codex-chrome/src/core/TaskRunner.ts) \
     <(sed -n '471,509p' codex-chrome/src/core/TaskRunner.ts)

# Expected: High similarity (~80% overlap)
```

**Analysis Questions**:
1. Why do both methods exist?
2. What's different between them?
3. Could they share common logic?

---

### Step 7: Review Mode Verification

**Check History Isolation**:

1. **Rust Approach**:
   - Isolated history: `review_thread_history: Vec<ResponseItem>` (Line 1657)
   - Not persisted: No call to `sess.record_conversation_items()` in review mode

2. **TypeScript Approach**:
   - Isolated history: Local `reviewThreadHistory` array (Line 129)
   - Not persisted: Check line 340-346 for conditional recording

**Test**:
```typescript
// Verify review mode doesn't record to session
if (this.options.reviewMode) {
  reviewHistory.push(...itemsToRecord);  // ✅ Local only
} else {
  await this.session.recordConversationItems(itemsToRecord);  // ✅ Session recording
}
```

---

### Step 8: Generate Improvement Suggestions

Based on findings, create structured suggestions using the data model:

```json
{
  "id": "IS-XXX",
  "category": "[critical_bug|architectural_mismatch|feature_gap|code_duplication|acceptable_adaptation]",
  "severity": "[critical|medium|low]",
  "title": "Brief description",
  "description": "Detailed explanation",
  "location": {
    "file": "codex-chrome/src/core/TaskRunner.ts",
    "lineStart": 123,
    "lineEnd": 456
  },
  "impact": "What breaks or degrades",
  "recommendedFix": "How to fix",
  "rustReference": {
    "file": "codex-rs/core/src/codex.rs",
    "lineStart": 1635,
    "note": "Reference behavior"
  }
}
```

---

## Expected Findings Summary

Based on initial research, expect to find:

1. ⚠️ **Token threshold mismatch** (75% vs 90%)
2. ⚠️ **Code duplication** in dual execution paths
3. ⚠️ **Missing response item handlers** (Reasoning type)
4. ⚠️ **Max turns safeguard** (TypeScript addition)
5. ✅ **Event emission patterns** preserved
6. ✅ **Review mode isolation** implemented correctly
7. ✅ **Cancellation mechanisms** functional

---

## Validation Checklist

After analysis, verify:

- [ ] All 15 functional requirements from spec.md addressed
- [ ] Each difference categorized (bug/architecture/gap/duplication/adaptation)
- [ ] Severity assigned to all issues (critical/medium/low)
- [ ] Line numbers provided for all findings
- [ ] Rust reference code cited for comparison
- [ ] Recommended fixes are actionable and specific
- [ ] SQ/EQ architecture preservation evaluated
- [ ] Feature parity percentage calculated

---

## Next Steps

1. Run analysis following steps 1-7
2. Document findings in structured format (see data-model.md)
3. Generate ComparisonResult JSON with all suggestions
4. Review findings with team
5. Prioritize fixes based on severity
6. Create tasks.md for implementation (via /tasks command)

---

## Troubleshooting

**Issue**: Can't find Rust function
- **Solution**: `grep -n "async fn run_task" codex-rs/core/src/codex.rs`

**Issue**: TypeScript file has changed
- **Solution**: Check git log for recent changes to TaskRunner.ts

**Issue**: Unclear if difference is bug or adaptation
- **Solution**: Check comments in TypeScript code explaining rationale; if no explanation, likely a bug

**Issue**: Can't determine impact
- **Solution**: Trace through execution flow in both implementations, look for divergent behavior