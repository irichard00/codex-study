# Data Model: AgentConfig Integration

## Core Entities

### AgentConfig (Singleton Service)
**Purpose**: Central configuration service managing all extension settings
**Location**: `src/config/AgentConfig.ts`

**Key Properties**:
- `currentConfig: IChromeConfig` - Active configuration state
- `storage: ConfigStorage` - Persistence layer
- `eventHandlers: Map` - Event subscription management
- `initialized: boolean` - Initialization state

**Key Methods**:
- `getConfig()` - Retrieve current configuration
- `updateConfig(config)` - Update configuration with validation
- `getModelConfig()` - Get model-specific configuration
- `on(event, handler)` - Subscribe to configuration changes
- `off(event, handler)` - Unsubscribe from changes

### IChromeConfig
**Purpose**: Root configuration interface
**Location**: `src/config/types.ts`

**Structure**:
```typescript
{
  version: string
  model: IModelConfig
  providers: Record<string, IProviderConfig>
  profiles?: Record<string, IProfileConfig>
  activeProfile?: string
  tools: IToolsConfig
  security: ISecurityConfig
  ui: IUIConfig
  system: ISystemConfig
}
```

### IModelConfig
**Purpose**: Model selection and parameters

**Fields**:
- `selected: string` - Active model identifier
- `provider: string` - Provider ID for the model
- `contextWindow: number` - Maximum context size
- `maxOutputTokens: number` - Maximum response size
- `temperature?: number` - Model temperature
- `reasoningEffort?: string` - Reasoning level
- `reasoningSummary?: boolean` - Include reasoning summary

### IProviderConfig
**Purpose**: API provider configuration

**Fields**:
- `id: string` - Unique provider identifier
- `name: string` - Display name
- `type: string` - Provider type (openai, anthropic, etc.)
- `apiKey: string` - Authentication key
- `apiBase?: string` - Custom API endpoint
- `organization?: string` - Organization identifier
- `models: string[]` - Available models

### IProfileConfig
**Purpose**: Named configuration presets

**Fields**:
- `name: string` - Profile identifier
- `displayName: string` - User-friendly name
- `model: string` - Preferred model
- `provider: string` - Preferred provider
- `modelSettings?: object` - Model overrides
- `toolSettings?: object` - Tool overrides
- `lastUsed?: number` - Last activation timestamp

### IToolsConfig
**Purpose**: Tool availability flags

**Fields**:
- `includePlanTool: boolean` - Enable planning tool
- `includeApplyPatchTool: boolean` - Enable patch tool
- `includeViewImageTool: boolean` - Enable image viewing
- `includeWebSearch: boolean` - Enable web search
- `customTools?: Record<string, boolean>` - Custom tool flags

### ISecurityConfig
**Purpose**: Security and execution policies

**Fields**:
- `approvalPolicy: 'never' | 'onFailure' | 'unlessTrusted' | 'always'`
- `sandboxPolicy: 'readOnly' | 'workspaceWrite' | 'fullAccess'`
- `trustedProjects: string[]` - Trusted project paths
- `shellEnvironmentPolicy: 'inherit' | 'clean' | 'custom'`

### IUIConfig
**Purpose**: User interface preferences

**Fields**:
- `hideAgentReasoning: boolean` - Hide reasoning output
- `showRawAgentReasoning: boolean` - Show raw reasoning
- `theme: 'light' | 'dark' | 'auto'` - UI theme
- `notificationsEnabled: boolean` - Enable notifications
- `notifyCommand?: string` - External notification command

### ISystemConfig
**Purpose**: System-level configuration

**Fields**:
- `cwd: string` - Working directory
- `userInstructions?: string` - Custom instructions
- `baseInstructions?: string` - System prompt overrides
- `debugMode: boolean` - Enable debug logging

## Entity Relationships

```
AgentConfig (1) ──manages──> (1) IChromeConfig
     │
     ├──uses──> ConfigStorage
     ├──emits──> IConfigChangeEvent
     └──validates──> ConfigValidators

IChromeConfig (1) ──contains──> (1) IModelConfig
              (1) ──contains──> (*) IProviderConfig
              (1) ──contains──> (*) IProfileConfig
              (1) ──contains──> (1) IToolsConfig
              (1) ──contains──> (1) ISecurityConfig
              (1) ──contains──> (1) IUIConfig
              (1) ──contains──> (1) ISystemConfig

Components (*) ──depend on──> (1) AgentConfig
     │
     ├── CodexAgent
     ├── ModelClientFactory
     ├── Session
     ├── TaskRunner
     ├── ToolRegistry
     ├── ApprovalManager
     └── UI Components
```

## State Transitions

### Config Initialization Flow
```
Uninitialized → Loading → Initialized → Ready
                   ↓
                Failed → Default Applied → Ready
```

### Config Update Flow
```
Current State → Validation → Storage Update → Event Emission → New State
                    ↓
                Invalid → Error Thrown → Current State Retained
```

### Profile Activation Flow
```
Profile Selected → Validation → Apply Overrides → Update Active → Notify Components
```

## Validation Rules

### Model Configuration
- `selected` must match a model in the provider's model list
- `maxOutputTokens` must not exceed `contextWindow`
- `temperature` must be between 0 and 2
- `provider` must exist in providers map

### Provider Configuration
- `id` must be unique across providers
- `apiKey` required for external providers
- `apiBase` must be valid URL if provided
- `models` array cannot be empty

### Security Configuration
- `approvalPolicy` must be valid enum value
- `sandboxPolicy` must be valid enum value
- `trustedProjects` paths must be absolute

### Profile Configuration
- `name` must be unique across profiles
- Referenced `model` must exist
- Referenced `provider` must exist

## Storage Schema

### Chrome Storage Structure
```json
{
  "agentConfig": {
    "version": "1.0.0",
    "model": { ... },
    "providers": { ... },
    "profiles": { ... },
    "activeProfile": "default",
    "tools": { ... },
    "security": { ... },
    "ui": { ... },
    "system": { ... }
  }
}
```

## Migration Strategy

### Version Migration
- Check stored version against current
- Apply migration transforms if needed
- Update version after successful migration
- Backup previous config before migration

### Default Merging
- Load stored configuration
- Deep merge with defaults
- Preserve user customizations
- Add new fields from defaults

## Cross-Context Synchronization

### Message Protocol
```typescript
{
  type: 'CONFIG_UPDATE' | 'CONFIG_REQUEST' | 'CONFIG_RESPONSE'
  payload: {
    config?: IChromeConfig
    section?: string
    changes?: Partial<IChromeConfig>
  }
  source: 'background' | 'content' | 'sidepanel'
  timestamp: number
}
```

### Sync Flow
1. Background holds master config instance
2. Other contexts request config on startup
3. Updates flow through background
4. Background broadcasts changes to all contexts
5. Contexts update local cache

## Component Integration Points

### CodexAgent
- Constructor: `new CodexAgent(config: AgentConfig)`
- Uses: model, security.approvalPolicy, security.sandboxPolicy
- Subscribes to: model changes, security changes

### ModelClientFactory
- Method: `initialize(config: AgentConfig)`
- Uses: providers, model.selected, model.provider
- Subscribes to: provider updates, model selection

### Session
- Constructor: `new Session(config: AgentConfig)`
- Uses: model.contextWindow, system.userInstructions
- May clone config for per-turn modifications

### TaskRunner
- Constructor: `new TaskRunner(config: AgentConfig)`
- Uses: tools.*, security.sandboxPolicy
- Reads fresh config per task

### ToolRegistry
- Constructor: `new ToolRegistry(config: AgentConfig)`
- Uses: tools.* flags
- Rebuilds on tool config changes

### ApprovalManager
- Constructor: `new ApprovalManager(config: AgentConfig)`
- Uses: security.approvalPolicy, security.trustedProjects
- Updates behavior on policy changes