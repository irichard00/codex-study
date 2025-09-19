# Quickstart Guide

**Feature**: TypeScript Web-Based Implementation of Codex
**Date**: 2025-09-19

## Prerequisites

- Node.js 20+ and npm 10+
- Git
- Modern web browser (Chrome 100+, Firefox 100+, Safari 15+, or Edge 100+)

## Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd codex-study/codex-ts

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configuration

Create a `config.toml` file in the project root (or copy from existing Rust version):

```toml
# Basic configuration
sandbox_mode = "workspace-write"
auth_enabled = false
port = 3000

# MCP servers (optional)
[[mcp_servers]]
name = "example-server"
url = "ws://localhost:8080"
capabilities = ["completion", "search"]

# Notification settings (optional)
[notifications]
enabled = true
desktop = true
```

### 3. Start the Application

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run start
```

The application will be available at `http://localhost:3000`

## Basic Usage

### 1. Initial Setup

1. Open your browser and navigate to `http://localhost:3000`
2. You'll see the Codex web interface
3. Select or create a workspace directory
4. The system will initialize a session

### 2. Core Features

#### Chat Interface
- Type your message in the input field
- Press Enter or click Send to interact with the AI agent
- View responses in real-time
- Edit previous messages by clicking on them

#### File Operations
- Click the file browser icon to explore your workspace
- Double-click files to open them in the editor
- Use the search box for fuzzy file search
- Save changes with Ctrl+S (Cmd+S on Mac)

#### Command Execution
- Type commands prefixed with `/` for quick actions
- Examples:
  - `/search <query>` - Search files
  - `/run <command>` - Execute shell command
  - `/config` - Open configuration

#### MCP Integration
- Connect to MCP servers via Settings → Connections
- View connection status in the sidebar
- Send requests through the chat interface

### 3. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send message |
| Ctrl+K | Quick file search |
| Ctrl+S | Save current file |
| Ctrl+/ | Toggle sidebar |
| Esc | Cancel current operation |
| Alt+↑/↓ | Navigate message history |

## Testing the Installation

### Automated Test Suite

Run the following command to verify your installation:

```bash
npm test
```

Expected output:
```
✓ Server starts successfully
✓ WebSocket connection established
✓ Session creation works
✓ File operations permitted
✓ Agent responds to messages
✓ Configuration loads correctly
```

### Manual Test Scenarios

#### Scenario 1: Basic Interaction
1. Start the application
2. Send message: "Hello, can you help me?"
3. **Expected**: Agent responds with greeting
4. **Verification**: Response appears in chat

#### Scenario 2: File Operations
1. Click file browser
2. Navigate to a text file
3. Open and edit the file
4. Save changes
5. **Expected**: File saved successfully notification
6. **Verification**: Changes persisted to disk

#### Scenario 3: Code Generation
1. Send message: "Create a simple Python hello world script"
2. **Expected**: Agent generates code
3. Click "Save to file" button
4. **Verification**: File created in workspace

#### Scenario 4: WebSocket Reconnection
1. Open developer tools (F12)
2. Go to Network tab
3. Disconnect network (offline mode)
4. Wait 5 seconds
5. Reconnect network
6. **Expected**: "Reconnected" notification
7. **Verification**: Can continue chatting

#### Scenario 5: Configuration Update
1. Click Settings icon
2. Change sandbox mode to "read-only"
3. Save configuration
4. Try to edit a file
5. **Expected**: "Permission denied" message
6. **Verification**: File remains unchanged

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Error: EADDRINUSE: address already in use :::3000
# Solution: Use a different port
PORT=3001 npm run start
```

#### WebSocket Connection Failed
```bash
# Check if server is running
curl http://localhost:3000/health

# Check WebSocket endpoint
wscat -c ws://localhost:3000/ws
```

#### Configuration Not Loading
```bash
# Verify config file location
ls -la config.toml

# Validate TOML syntax
npx toml-cli validate config.toml
```

#### Browser Compatibility Issues
- Ensure you're using a supported browser version
- Clear browser cache and cookies
- Disable browser extensions that might interfere

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set environment variable
DEBUG=codex:* npm run dev
```

## Migration from Rust CLI

### For Existing Users

1. **Configuration Migration**:
   ```bash
   # Copy existing config
   cp ~/.codex/config.toml ./codex-ts/config.toml
   ```

2. **Workspace Migration**:
   - Your existing workspace files remain unchanged
   - Point the web app to your current workspace directory

3. **Feature Parity Check**:
   - [x] File operations
   - [x] Configuration management
   - [x] MCP protocol support
   - [x] Conversation history
   - [x] Command execution
   - [ ] Shell completions (N/A for web)
   - [x] Notifications

## Performance Benchmarks

Run performance tests:

```bash
npm run benchmark
```

Expected results:
- Page load: <2s
- WebSocket latency: <50ms
- File search (10k files): <500ms
- Message response: <100ms

## Next Steps

1. **Customize Settings**: Adjust configuration for your workflow
2. **Connect MCP Servers**: Add your MCP server endpoints
3. **Explore Advanced Features**: Try code generation, file search, and more
4. **Report Issues**: File bugs at the project repository

## Quick Commands Reference

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code

# Production
npm run start        # Start production server
npm run stop         # Stop server
npm run restart      # Restart server
npm run logs         # View logs

# Utilities
npm run migrate      # Migrate from Rust config
npm run benchmark    # Run performance tests
npm run clean        # Clean build artifacts
```

---
*For detailed documentation, see the full user guide.*