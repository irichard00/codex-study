# Contract: JSON Data Types & Serialization

**Version**: 1.0.0
**Date**: 2025-10-01

## Overview

Defines the exact JSON serialization format for rollout data, ensuring compatibility between Rust CLI and TypeScript Chrome extension.

## Timestamp Format

**Standard**: ISO 8601 with milliseconds
**Format**: `YYYY-MM-DDTHH:mm:ss.sssZ`
**Example**: `"2025-10-01T12:00:00.123Z"`

## UUID Format

**Standard**: UUID v4
**Format**: 8-4-4-4-12 hexadecimal
**Example**: `"5973b6c0-94b8-487b-a530-2aeb6098ae0e"`

## RolloutLine JSON Schema

```json
{
  "timestamp": "2025-10-01T12:00:00.123Z",
  "type": "session_meta",
  "payload": { ... }
}
```

**Fields**:
- `timestamp`: ISO 8601 string (required)
- `type`: Discriminator string (required)
- `payload`: Type-specific object (required)

## Type Discriminators

| Type | Discriminator | Payload Type |
|------|---------------|--------------|
| SessionMeta | `"session_meta"` | SessionMetaLine |
| ResponseItem | `"response_item"` | ResponseItem |
| Compacted | `"compacted"` | CompactedItem |
| TurnContext | `"turn_context"` | TurnContextItem |
| EventMsg | `"event_msg"` | EventMsg |

## Example: SessionMeta

```json
{
  "timestamp": "2025-10-01T12:00:00.000Z",
  "type": "session_meta",
  "payload": {
    "id": "5973b6c0-94b8-487b-a530-2aeb6098ae0e",
    "timestamp": "2025-10-01T12:00:00.000Z",
    "cwd": "/home/user/project",
    "originator": "chrome-extension",
    "cliVersion": "1.0.0",
    "instructions": "Help me debug",
    "git": {
      "branch": "main",
      "commit": "abc123",
      "dirty": false,
      "remote": "origin"
    }
  }
}
```

## JSONL Export Format

```
{"timestamp":"2025-10-01T12:00:00.000Z","type":"session_meta","payload":{...}}
{"timestamp":"2025-10-01T12:00:01.123Z","type":"response_item","payload":{...}}
{"timestamp":"2025-10-01T12:00:02.456Z","type":"response_item","payload":{...}}
```

**Requirements**:
- One JSON object per line
- No trailing newline after last line (optional)
- UTF-8 encoding
- Compact format (no extra whitespace)

## Validation

**Serialization**:
```typescript
JSON.stringify(rolloutLine); // Produces valid JSON
```

**Deserialization**:
```typescript
JSON.parse(jsonString); // Parses to RolloutLine
```

**Cross-version compatibility**: Rust `serde_json` and TypeScript `JSON` must produce/parse identical output.

## References

- Rust serde: `codex-rs/protocol/src/protocol.rs`
- TypeScript types: `../data-model.md`
