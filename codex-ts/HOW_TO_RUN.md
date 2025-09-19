# How to Run Codex TypeScript

A step-by-step guide to get the TypeScript web-based Codex running on your machine.

## Prerequisites

Before starting, ensure you have:
- **Node.js** version 20 or higher
- **npm** version 10 or higher
- A modern web browser (Chrome 100+, Firefox 100+, Safari 15+, or Edge 100+)
- At least 500MB of free disk space

### Check your versions:
```bash
node --version  # Should show v20.x.x or higher
npm --version   # Should show 10.x.x or higher
```

## Quick Start (3 minutes)

### 1. Navigate to the Project
```bash
cd codex-ts
```

### 2. Install Dependencies
```bash
npm install
```
This will install dependencies for all workspaces (backend, frontend, shared).

### 3. Start the Application
```bash
npm run dev
```
This starts both backend (port 3000) and frontend (port 5173) servers.

### 4. Open in Browser
Navigate to: **http://localhost:5173**

## Detailed Setup

### Step 1: Clone or Navigate to Repository
```bash
# If you need to clone
git clone <repository-url>
cd codex-study/codex-ts

# Or if already cloned
cd /path/to/codex-study/codex-ts
```

### Step 2: Environment Configuration (Optional)

Create a `.env` file in the backend directory:
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your preferences:
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:5173
CONFIG_PATH=./config.toml
```

### Step 3: Configuration File (Optional)

Create a `config.toml` in the backend directory for custom settings:
```bash
cd backend
cat > config.toml << 'EOF'
# Codex Configuration
sandbox_mode = "workspace-write"  # Options: "read-only", "workspace-write", "danger-full-access"
auth_enabled = false
port = 3000

# MCP Servers (optional)
[[mcp_servers]]
name = "example-server"
url = "ws://localhost:8080"
capabilities = ["completion", "search"]

# Notifications (optional)
[notifications]
enabled = true
desktop = false
sound = false
EOF
```

### Step 4: Install Dependencies

From the root `codex-ts` directory:
```bash
# Install all workspace dependencies
npm install

# This installs for:
# - backend (Fastify, TypeScript, etc.)
# - frontend (Svelte, SvelteKit, etc.)
# - shared (Zod schemas)
```

### Step 5: Run the Application

#### Option A: Run Both Services (Recommended)
```bash
npm run dev
```
This runs both backend and frontend concurrently.

#### Option B: Run Services Separately
In separate terminal windows:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
# Backend runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
# Frontend runs on http://localhost:5173
```

### Step 6: Access the Application

1. Open your browser
2. Navigate to **http://localhost:5173**
3. You'll see the Codex welcome screen

## Using the Application

### Initial Setup
1. **Enter Workspace Directory**:
   - Provide an absolute path to your working directory
   - Example: `/home/username/projects` or `C:\Users\username\projects`
   - This directory will be the root for all file operations

2. **Start Session**:
   - Click "Start Session" to initialize
   - The system will create a session and agent

### Main Interface

Once connected, you'll see:

```
┌─────────────────────────────────────┐
│  Sidebar          │  Chat Interface  │
│                   │                  │
│  [Show Files]     │  Messages...     │
│  File Browser     │                  │
│  - Directory      │                  │
│  - Files          │  [Input field]   │
│                   │  [Send]          │
└─────────────────────────────────────┘
```

### Features Available

#### Chat with AI
- Type messages in the input field
- Press Enter or click Send
- View responses in real-time

#### File Operations
- Click "Show Files" to open file browser
- Navigate directories
- Click files to view (editing coming soon)

#### Commands (Placeholders - not fully implemented)
- File operations: "create file X", "search for Y"
- Code generation: "generate a function that..."
- System info: Basic queries

## Building for Production

### 1. Build All Components
```bash
npm run build
```

### 2. Start Production Server
```bash
# Backend only (API server)
cd backend
npm start

# In another terminal, serve frontend
cd frontend
npm run preview
```

### 3. Production Configuration
Update `.env` for production:
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=strong-random-secret-key
LOG_LEVEL=error
CORS_ORIGIN=https://your-domain.com
```

## Docker Deployment (Coming Soon)

```bash
# Build Docker image
docker build -t codex-ts .

# Run container
docker run -p 3000:3000 -p 5173:5173 codex-ts
```

## Troubleshooting

### Port Already in Use
```bash
# Error: EADDRINUSE: address already in use :::3000
```
**Solution**: Kill the process using the port or change ports:
```bash
# Find process
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Or use different ports
PORT=3001 npm run dev:backend
```

### WebSocket Connection Failed
```
WebSocket connection to 'ws://localhost:3000/ws' failed
```
**Solutions**:
1. Ensure backend is running
2. Check CORS settings in backend
3. Verify firewall isn't blocking WebSocket

### Module Not Found
```bash
Error: Cannot find module '@shared/types'
```
**Solution**: Rebuild shared types:
```bash
cd shared
npm run build
cd ..
npm install
```

### Permission Denied for File Operations
```
Error: EACCES: permission denied
```
**Solution**: Ensure the workspace directory exists and has write permissions:
```bash
mkdir -p /your/workspace/path
chmod 755 /your/workspace/path
```

### Browser Console Errors
Open Developer Tools (F12) and check:
1. Network tab for failed requests
2. Console for JavaScript errors
3. WebSocket connection status

## Development Tips

### Hot Reload
Both frontend and backend support hot reload:
- Frontend: Changes reflect immediately
- Backend: Server restarts automatically

### Debugging

#### Backend Debugging
```bash
# Enable debug logs
DEBUG=codex:* npm run dev:backend
```

#### Frontend Debugging
1. Open browser DevTools (F12)
2. Use Sources tab for breakpoints
3. Network tab for API calls
4. Console for errors

### Testing
```bash
# Run all tests
npm test

# Run specific workspace tests
npm run test:backend
npm run test:frontend

# Run with coverage
npm run test:coverage
```

## Common Issues & Solutions

### Issue: "Session not found"
**Cause**: Session expired or server restarted
**Solution**: Refresh the page and create a new session

### Issue: Files not showing in browser
**Cause**: Invalid workspace path
**Solution**: Ensure the path exists and is absolute

### Issue: AI responses not working
**Cause**: AI provider not configured
**Solution**: Currently uses placeholder responses (AI integration pending)

### Issue: Slow performance
**Cause**: Development mode overhead
**Solution**: Build for production: `npm run build`

## Project Structure
```
codex-ts/
├── backend/           # Fastify API server
│   ├── src/
│   │   ├── server.ts  # Main server file
│   │   ├── services/  # Business logic
│   │   ├── api/       # REST endpoints
│   │   └── websocket/ # WebSocket handlers
│   └── package.json
├── frontend/          # Svelte web app
│   ├── src/
│   │   ├── routes/    # Page components
│   │   ├── components/# UI components
│   │   └── services/  # API clients
│   └── package.json
├── shared/            # Shared TypeScript types
│   └── types/         # Zod schemas
└── package.json       # Root workspace config
```

## Available Scripts

From root `codex-ts/` directory:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend in dev mode |
| `npm run dev:backend` | Start only backend server |
| `npm run dev:frontend` | Start only frontend server |
| `npm run build` | Build all packages for production |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all code |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Remove build artifacts |

## System Requirements

### Minimum:
- **CPU**: 2 cores
- **RAM**: 2GB
- **Storage**: 500MB
- **Node.js**: v20+

### Recommended:
- **CPU**: 4+ cores
- **RAM**: 4GB+
- **Storage**: 1GB+
- **Network**: Stable connection for WebSocket

## Support & Resources

### Logs Location
- Backend logs: Console output
- Frontend logs: Browser console (F12)

### Configuration Files
- Backend config: `backend/config.toml`
- Environment: `backend/.env`
- TypeScript: `*/tsconfig.json`
- Package configs: `*/package.json`

### Getting Help
1. Check console/terminal for error messages
2. Review the [README.md](./README.md) for overview
3. See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for feature status
4. Open browser DevTools for client-side issues

## Next Steps

Once running successfully:
1. Explore the chat interface
2. Try file operations in your workspace
3. Test WebSocket real-time updates
4. Review code structure for customization

---

**Note**: This is a development version. Many features from the Rust implementation are not yet available. See FEATURE_COMPARISON.md for details.