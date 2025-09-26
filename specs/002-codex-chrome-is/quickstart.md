# Quickstart Guide: AgentConfig Integration

## Overview
This guide demonstrates how to use the integrated AgentConfig system in the Codex Chrome Extension.

## Quick Test Scenarios

### 1. Basic Configuration Access
```typescript
// Get the singleton config instance
const config = AgentConfig.getInstance();

// Initialize the config
await config.initialize();

// Get current configuration
const currentConfig = await config.getConfig();
console.log('Current model:', currentConfig.model.selected);
console.log('Active provider:', currentConfig.model.provider);
```

### 2. Update Model Selection
```typescript
// Change the selected model
const updatedModel = await config.updateModelConfig({
  selected: 'gpt-4',
  provider: 'openai'
});

// Verify the change
console.log('New model:', updatedModel.selected);
```

### 3. Component with Config Injection
```typescript
// Initialize a component with config
const agentConfig = AgentConfig.getInstance();
const agent = new CodexAgent(agentConfig);

// Component uses injected config
await agent.initialize();
// Agent now uses config for model selection, security policies, etc.
```

### 4. Subscribe to Configuration Changes
```typescript
// Subscribe to config changes
config.on('config-changed', (event) => {
  console.log('Config section changed:', event.section);
  console.log('Old value:', event.oldValue);
  console.log('New value:', event.newValue);
});

// Make a change
await config.updateModelConfig({ temperature: 0.8 });
// Event fires with section: 'model'
```

### 5. Profile Management
```typescript
// Create a new profile
await config.createProfile({
  name: 'coding',
  displayName: 'Coding Profile',
  model: 'claude-3-opus',
  provider: 'anthropic',
  modelSettings: {
    temperature: 0.2,
    maxOutputTokens: 4000
  }
});

// Activate the profile
await config.activateProfile('coding');
// Model config now uses profile settings

// Get active profile config
const modelConfig = await config.getModelConfig();
console.log('Active model from profile:', modelConfig.selected);
```

### 6. Cross-Context Communication (Chrome Extension)
```typescript
// In background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CONFIG_REQUEST') {
    config.getConfig().then(sendResponse);
    return true; // Keep channel open for async response
  }
});

// In content script or side panel
chrome.runtime.sendMessage(
  { action: 'CONFIG_REQUEST' },
  (response) => {
    console.log('Config received:', response);
  }
);
```

### 7. Tool Configuration
```typescript
// Enable/disable tools
await config.updateConfig({
  tools: {
    includePlanTool: true,
    includeApplyPatchTool: false,
    includeViewImageTool: true,
    includeWebSearch: true
  }
});

// ToolRegistry automatically updates available tools
const toolRegistry = new ToolRegistry(config);
await toolRegistry.initialize();
// Only enabled tools are now available
```

### 8. Security Policy Configuration
```typescript
// Update security policies
await config.updateConfig({
  security: {
    approvalPolicy: 'unlessTrusted',
    sandboxPolicy: 'workspaceWrite',
    trustedProjects: ['/home/user/safe-project']
  }
});

// ApprovalManager uses updated policies
const approvalManager = new ApprovalManager(config);
const needsApproval = await approvalManager.checkApproval('/some/path');
```

## Integration Test Script

```typescript
// test-config-integration.ts
import { AgentConfig } from '../src/config/AgentConfig';
import { CodexAgent } from '../src/core/CodexAgent';
import { ModelClientFactory } from '../src/models/ModelClientFactory';
import { ToolRegistry } from '../src/tools/ToolRegistry';

async function testConfigIntegration() {
  console.log('Starting AgentConfig integration test...');

  // 1. Initialize singleton config
  const config = AgentConfig.getInstance();
  await config.initialize();
  console.log('✓ Config initialized');

  // 2. Test default configuration
  const defaultConfig = await config.getConfig();
  console.assert(defaultConfig.version, 'Version should exist');
  console.assert(defaultConfig.model, 'Model config should exist');
  console.log('✓ Default config loaded');

  // 3. Test config injection in components
  const agent = new CodexAgent(config);
  await agent.initialize();
  console.log('✓ CodexAgent initialized with config');

  const modelFactory = ModelClientFactory.getInstance();
  await modelFactory.initialize(config);
  console.log('✓ ModelClientFactory initialized with config');

  const toolRegistry = new ToolRegistry(config);
  await toolRegistry.initialize();
  console.log('✓ ToolRegistry initialized with config');

  // 4. Test config updates
  const originalModel = defaultConfig.model.selected;
  await config.updateModelConfig({
    selected: 'test-model',
    temperature: 0.5
  });

  const updatedConfig = await config.getConfig();
  console.assert(
    updatedConfig.model.selected === 'test-model',
    'Model should be updated'
  );
  console.log('✓ Config updates work');

  // 5. Test event subscription
  let eventFired = false;
  config.on('config-changed', (event) => {
    eventFired = true;
    console.assert(event.section === 'model', 'Section should be model');
  });

  await config.updateModelConfig({ temperature: 0.7 });
  console.assert(eventFired, 'Event should have fired');
  console.log('✓ Event subscription works');

  // 6. Test profile management
  await config.createProfile({
    name: 'test-profile',
    displayName: 'Test Profile',
    model: originalModel,
    provider: 'test-provider'
  });

  await config.activateProfile('test-profile');
  const profileConfig = await config.getModelConfig();
  console.assert(
    profileConfig.selected === originalModel,
    'Profile should override model'
  );
  console.log('✓ Profile management works');

  // 7. Test persistence
  await config.resetConfig(true); // Preserve API keys
  await config.initialize(); // Reload from storage
  const reloadedConfig = await config.getConfig();
  console.assert(reloadedConfig.version, 'Config should persist');
  console.log('✓ Config persistence works');

  console.log('\n✅ All integration tests passed!');
}

// Run the test
testConfigIntegration().catch(console.error);
```

## Verification Checklist

- [ ] AgentConfig singleton initializes correctly
- [ ] Default configuration loads with all required fields
- [ ] Components accept config in constructor/initialization
- [ ] Config updates trigger validation
- [ ] Invalid configs are rejected with clear errors
- [ ] Event subscriptions fire on config changes
- [ ] Profiles can be created and activated
- [ ] Profile settings override base configuration
- [ ] Config persists across extension restarts
- [ ] Cross-context messaging delivers config
- [ ] Tool availability responds to config changes
- [ ] Security policies are enforced based on config
- [ ] Model selection uses configured provider
- [ ] Per-turn config modifications work

## Common Issues & Solutions

### Issue: Config not persisting
**Solution**: Ensure ConfigStorage has proper permissions in manifest.json:
```json
{
  "permissions": ["storage"]
}
```

### Issue: Components not receiving config updates
**Solution**: Verify components subscribe to config-changed events:
```typescript
constructor(private config: AgentConfig) {
  this.config.on('config-changed', this.handleConfigChange.bind(this));
}
```

### Issue: Cross-context config out of sync
**Solution**: Implement message handlers in background:
```typescript
// Background broadcasts changes to all contexts
config.on('config-changed', (event) => {
  chrome.runtime.sendMessage({
    action: 'CONFIG_CHANGE',
    data: event
  });
});
```

### Issue: Profile not applying
**Solution**: Check profile exists and model config reads from active profile:
```typescript
const profile = await config.getProfile('profile-name');
if (profile) {
  await config.activateProfile('profile-name');
}
```

## Next Steps

1. Run the integration test script
2. Verify all components receive configuration
3. Test config persistence across browser restart
4. Validate cross-context synchronization
5. Confirm UI reflects config changes
6. Test with different provider configurations
7. Verify security policies are enforced