# Codex TypeScript - Web-Based Implementation

A modern TypeScript implementation of Codex with a Svelte-based web interface, replacing the original Rust CLI with a full-featured web application.

## Features

- 🌐 **Web-Based Interface**: Modern Svelte UI accessible from any browser
- 🔄 **Real-Time Communication**: WebSocket-based live updates
- 📁 **File Management**: Browse, read, write, and search files in your workspace
- 🤖 **AI Agent Integration**: Chat interface for AI-powered assistance
- 🔌 **MCP Protocol Support**: Connect to Model Context Protocol servers
- 🔒 **Sandbox Security**: Configurable security policies
- ⚙️ **Configuration Management**: TOML-based configuration

## Architecture

```
codex-ts/
├── backend/          # Fastify server with TypeScript
├── frontend/         # Svelte/SvelteKit web application
└── shared/           # Shared TypeScript types (Zod schemas)
```

## Prerequisites

- Node.js 20+ and npm 10+
- Modern web browser (Chrome 100+, Firefox 100+, Safari 15+, or Edge 100+)

## Quick Start

### 1. Install Dependencies

```bash
cd codex-ts
npm install
```

### 2. Configure (Optional)

Create a `config.toml` file in the backend directory:

```toml
sandbox_mode = "workspace-write"
auth_enabled = false
port = 3000

[[mcp_servers]]
name = "example-server"
url = "ws://localhost:8080"
capabilities = ["completion", "search"]

[notifications]
enabled = true
desktop = false
```

### 3. Start Development Server

```bash
# Start both backend and frontend
npm run dev

# Or start separately:
npm run dev:backend  # Backend on http://localhost:3000
npm run dev:frontend # Frontend on http://localhost:5173
```

### 4. Access the Application

Open your browser and navigate to http://localhost:5173

## Building for Production

```bash
# Build all components
npm run build

# Start production server
cd backend && npm start
cd frontend && npm run preview
```

## API Documentation

### REST Endpoints

- `POST /api/sessions` - Create a new session
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/agents` - Create an agent
- `GET /api/sessions/:id/conversations` - Get conversation history
- `GET /api/sessions/:id/files` - Browse files
- `POST /api/sessions/:id/files/search` - Search files

### WebSocket Protocol

Connect to `ws://localhost:3000/ws?sessionId={sessionId}`

Message types:
- Client → Server: `SEND_MESSAGE`, `EXECUTE_TASK`, `FILE_OPERATION`, `SEARCH_FILES`
- Server → Client: `AGENT_STATUS`, `CONVERSATION_MESSAGE`, `FILE_CHANGE`, `SEARCH_RESULTS`

## Project Structure

### Backend Services
- **SessionService**: Manages user sessions and workspace contexts
- **AgentService**: Handles AI agent operations and state
- **ConversationService**: Manages chat history and context
- **FileService**: File system operations with security validation
- **MCPService**: Model Context Protocol client implementation
- **ConfigurationService**: TOML configuration management

### Frontend Components
- **ChatInterface**: Main chat UI for interacting with the AI
- **FileBrowser**: File explorer for workspace navigation
- **CodeEditor**: Syntax-highlighted code viewing/editing (coming soon)
- **SettingsPanel**: Configuration management UI (coming soon)

### Shared Types
All data models are defined using Zod schemas in the shared directory:
- Session, Configuration, Agent, Conversation
- Task, MCPConnection, FileOperation
- Notification, WebSocketMessage

## Testing

```bash
# Run all tests
npm test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run E2E tests
cd frontend && npm run test:e2e
```

## Development

### Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
CONFIG_PATH=./config.toml
```

### Debugging

```bash
# Enable debug logging
DEBUG=codex:* npm run dev
```

### Code Style

```bash
# Format code
npm run format

# Lint code
npm run lint
```

## Migration from Rust CLI

### For Existing Users

1. Copy your existing `config.toml`:
   ```bash
   cp ~/.codex/config.toml ./codex-ts/backend/config.toml
   ```

2. Your workspace files remain unchanged - just specify the path when creating a session

3. Feature comparison:
   - ✅ File operations
   - ✅ Configuration management
   - ✅ MCP protocol support
   - ✅ Conversation history
   - ✅ Real-time updates (new!)
   - ✅ Web-based UI (new!)
   - ⚠️ Shell completions (N/A for web)
   - ⚠️ OS-level sandboxing (limited in web environment)

## Security Considerations

- **File Access**: Restricted to specified workspace directory
- **Authentication**: JWT-based (optional)
- **Rate Limiting**: Configurable per-endpoint and WebSocket
- **Input Validation**: Zod schemas on all inputs
- **CORS**: Configured for frontend origin only
- **CSP Headers**: Content Security Policy via Helmet.js

## Troubleshooting

### WebSocket Connection Failed
- Check if backend is running on port 3000
- Verify CORS settings in backend
- Check browser console for errors

### File Access Denied
- Ensure workspace directory exists
- Check sandbox mode in configuration
- Verify file permissions

### Performance Issues
- Enable production build: `npm run build`
- Check browser dev tools for bottlenecks
- Monitor WebSocket message frequency

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TDD approach (tests first)
4. Ensure all tests pass
5. Submit a pull request

## License

MIT

## Acknowledgments

- Original Rust implementation by OpenAI Codex team
- Built with Fastify, Svelte, and TypeScript
- Powered by Zod for runtime type safety

---

For detailed documentation, see the `/specs/001-turn-codex-rs/` directory.