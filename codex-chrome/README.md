# Codex Chrome Extension

A Chrome extension that ports the codex-rs agent architecture to the browser, preserving the SQ/EQ (Submission Queue/Event Queue) pattern.

## Prerequisites

- Node.js 20+ and npm
- Chrome browser (for testing)

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd codex-chrome
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see Configuration section below)

## Configuration

### Environment Variables (T035)

The extension uses environment variables for build-time configuration. This allows you to pre-configure the extension with your API keys and preferences before building.

#### Quick Start

1. Copy the example configuration:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API keys:
```bash
# Minimal configuration
CODEX_MODEL_SELECTED=gpt-4
CODEX_MODEL_PROVIDER=openai
CODEX_PROVIDER_OPENAI_API_KEY=sk-proj-your-api-key-here
```

3. Build the extension:
```bash
npm run build
```

#### Configuration Files

The extension loads configuration from multiple files in order of priority:

1. **`.env.defaults`** - Default values (committed to repo)
2. **`.env`** - Your main configuration (git-ignored)
3. **`.env.<environment>`** - Environment-specific overrides (e.g., `.env.development`, `.env.production`, `.env.test`)
4. **`.env.local`** - Local overrides, highest priority (git-ignored)

#### Environment-Specific Loading

The extension supports different configurations for different environments:

```bash
# Development build (loads .env.development)
NODE_ENV=development npm run build

# Production build (loads .env.production)
NODE_ENV=production npm run build

# Test build (loads .env.test)
NODE_ENV=test npm run build
```

#### Available Configuration Options

**Model Configuration:**
```bash
CODEX_MODEL_SELECTED=gpt-4              # Model to use
CODEX_MODEL_PROVIDER=openai             # Provider (openai, anthropic, custom)
CODEX_MODEL_CONTEXT_WINDOW=128000       # Context window size
CODEX_MODEL_MAX_OUTPUT_TOKENS=4096      # Max output tokens (must be <= context window)
CODEX_MODEL_AUTO_COMPACT_TOKEN_LIMIT=100000  # Auto-compaction threshold
CODEX_MODEL_REASONING_EFFORT=medium     # low, medium, high
CODEX_MODEL_REASONING_SUMMARY=brief     # none, brief, detailed
CODEX_MODEL_VERBOSITY=medium            # low, medium, high
```

**Provider Configuration:**
```bash
# OpenAI
CODEX_PROVIDER_OPENAI_API_KEY=sk-proj-xxx
CODEX_PROVIDER_OPENAI_BASE_URL=https://api.openai.com/v1
CODEX_PROVIDER_OPENAI_ORGANIZATION=org-xxx
CODEX_PROVIDER_OPENAI_TIMEOUT=30000

# Anthropic
CODEX_PROVIDER_ANTHROPIC_API_KEY=sk-ant-api03-xxx
CODEX_PROVIDER_ANTHROPIC_BASE_URL=https://api.anthropic.com
CODEX_PROVIDER_ANTHROPIC_VERSION=2023-06-01

# Custom Provider (for local LLMs)
CODEX_PROVIDER_CUSTOM_API_KEY=xxx
CODEX_PROVIDER_CUSTOM_BASE_URL=http://localhost:8080/v1
```

**User Preferences:**
```bash
CODEX_PREFERENCES_AUTO_SYNC=true        # Sync across devices
CODEX_PREFERENCES_TELEMETRY_ENABLED=false  # Analytics
CODEX_PREFERENCES_THEME=system          # light, dark, system
```

**Cache Settings:**
```bash
CODEX_CACHE_ENABLED=true
CODEX_CACHE_TTL=3600                    # Time-to-live in seconds
CODEX_CACHE_MAX_SIZE=52428800           # Max size in bytes (50MB)
CODEX_CACHE_COMPRESSION_ENABLED=true
CODEX_CACHE_PERSIST_TO_STORAGE=true
```

**Extension Settings:**
```bash
CODEX_EXTENSION_ENABLED=true
CODEX_EXTENSION_CONTENT_SCRIPT_ENABLED=true
CODEX_EXTENSION_ALLOWED_ORIGINS=https://github.com,https://gitlab.com
CODEX_EXTENSION_STORAGE_QUOTA_WARNING=80  # Percentage (0-100)
CODEX_EXTENSION_UPDATE_CHANNEL=stable     # stable, beta
```

**Extension Permissions:**
```bash
CODEX_EXTENSION_PERMISSIONS_TABS=true
CODEX_EXTENSION_PERMISSIONS_STORAGE=true
CODEX_EXTENSION_PERMISSIONS_NOTIFICATIONS=false
CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_READ=true
CODEX_EXTENSION_PERMISSIONS_CLIPBOARD_WRITE=true
```

#### Validation

The build process validates your configuration:

```bash
# Manually validate configuration
npm run validate:env

# Validation happens automatically during build
npm run build
```

Common validation rules:
- At least one provider must have an API key
- `maxOutputTokens` must not exceed `contextWindow`
- Storage quota warning must be between 0-100
- Selected provider must be configured

#### Security Notes

- **Never commit `.env` files with real API keys**
- API keys are replaced with placeholders at build time
- Sensitive values are never logged or exposed in build output
- Use `.env.local` for personal overrides that should never be shared

#### Troubleshooting Configuration

If your configuration isn't working:

1. Check validation output during build:
```bash
npm run build
# Look for "Environment validation" messages
```

2. Verify file loading order:
```bash
# Check which files are being loaded
ls -la .env*
```

3. Test with minimal configuration:
```bash
# Create a minimal .env
echo "CODEX_PROVIDER_OPENAI_API_KEY=sk-xxx" > .env
echo "CODEX_MODEL_SELECTED=gpt-4" >> .env
echo "CODEX_MODEL_PROVIDER=openai" >> .env
```

4. Check generated build config:
```bash
# After build, check the generated config
cat src/config/build-config.ts
```

## Building the Extension

### Production Build

Build the extension for production:
```bash
npm run build
```

This will:
- Compile TypeScript files
- Build the Svelte UI components
- Bundle all assets with Vite
- Copy manifest.json to dist/
- Copy and fix HTML files (sidepanel.html, welcome.html) to dist/
- Create placeholder SVG icons if needed
- Output everything to the `dist/` directory

The build script automatically handles path corrections for Chrome extension compatibility.

### Development Build

For development with file watching:
```bash
npm run build:watch
```

This will rebuild automatically when files change.

## Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** toggle in the top right corner
3. Click **"Load unpacked"** button
4. Select the `dist/` directory from this project
5. The Codex extension icon should appear in your toolbar

## Using the Extension

### Opening the Side Panel
- Click the Codex icon in the toolbar
- Or press `Alt+Shift+C` (keyboard shortcut)

### Context Menu Actions
- Select text on any webpage
- Right-click and choose:
  - "Explain with Codex" - Get explanations
  - "Improve with Codex" - Get suggestions for improvement
  - "Extract data with Codex" - Extract structured data from the page

### Quick Action
- Press `Alt+Shift+Q` to analyze the current page

## Development

### Project Structure
```
codex-chrome/
├── src/
│   ├── protocol/        # Protocol types (Submission, Op, Event, EventMsg)
│   ├── core/           # Core agent logic (CodexAgent, Session, QueueProcessor)
│   ├── background/     # Service worker
│   ├── content/        # Content script for DOM access
│   ├── sidepanel/      # Svelte UI components
│   └── welcome/        # Welcome page
├── dist/               # Built extension (git-ignored)
├── manifest.json       # Chrome extension manifest
├── vite.config.mjs     # Vite build configuration
└── tsconfig.json       # TypeScript configuration
```

### Available Scripts

```bash
# Build for production
npm run build

# Build and watch for changes
npm run build:watch

# Run type checking
npm run type-check

# Run linter
npm run lint

# Format code
npm run format

# Run tests
npm run test
```

### Type Checking

Run TypeScript type checking without building:
```bash
npm run type-check
```

## Architecture

The extension preserves the core SQ/EQ architecture from codex-rs with performance enhancements:

- **Submission Queue**: User requests (Op operations)
- **Event Queue**: Agent responses (EventMsg)
- **CodexAgent**: Main coordinator class
- **Session**: Conversation state management
- **MessageRouter**: Chrome extension message passing

### Performance Features (Phase 9)

#### SSE Event Parser Optimizations
- **Memory Pooling**: Reuses event objects to reduce garbage collection pressure
- **Hot Path Optimization**: Cached event type mappings for faster processing
- **Lazy Parsing**: Early exit for ignored event types
- **Performance Monitoring**: < 10ms target per event processing with built-in metrics

#### Request Queue System
- **Priority-based FIFO Queue**: Urgent > High > Normal > Low priority handling
- **Rate Limiting**: Configurable per-minute and per-hour request limits
- **Persistence**: Queue survives Chrome extension restarts via chrome.storage
- **Retry Logic**: Exponential backoff with configurable max retries
- **Analytics**: Success rate, wait times, and queue trends

#### Model Client Improvements
- **Streaming Response Processing**: Enhanced SSE parsing with error recovery
- **Queue Integration**: Automatic request queuing with priority support
- **Memory Management**: Buffer pooling and cleanup for long-running sessions

## Troubleshooting

### Build Errors

If you encounter build errors:

1. Clear the dist directory:
```bash
rm -rf dist/
```

2. Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

3. Run the build again:
```bash
npm run build
```

### Extension Not Loading

- Ensure you're loading the `dist/` directory, not the project root
- Check Chrome console for errors: View → Developer → JavaScript Console
- Make sure "Developer mode" is enabled in chrome://extensions/

### Content Script Issues

If the content script isn't working on certain pages:
- Chrome blocks content scripts on chrome:// URLs and the Chrome Web Store
- Some websites with strict CSP may block the content script
- Try refreshing the page after loading the extension

## License

ISC