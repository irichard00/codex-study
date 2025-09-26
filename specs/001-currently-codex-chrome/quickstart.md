# Quickstart: Chrome Extension Config Refactoring

## Overview
This guide demonstrates how to use the new Chrome extension configuration system after refactoring from the terminal-based codex-rs config.

## Prerequisites
- Chrome browser v100+
- Node.js 18+ and npm
- Chrome extension loaded in developer mode
- At least one API key (OpenAI or Anthropic)

## Installation & Setup

### 1. Install Dependencies
```bash
cd codex-chrome
npm install
npm run build
```

### 2. Load Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `codex-chrome/dist` directory

### 3. Initial Configuration
The extension will automatically migrate existing settings on first run.

## Quick Test Scenarios

### Scenario 1: First-Time Setup
**Goal**: Verify clean installation and initial config

```typescript
// Test: Check default config is created
const config = await chromeConfig.getConfig();
console.assert(config.version === '1.0.0', 'Default version should be 1.0.0');
console.assert(config.providers !== null, 'Providers should be initialized');
console.assert(config.extension.enabled === true, 'Extension should be enabled by default');

// Test: Add first API key
await chromeConfig.updateProvider('openai', {
  apiKey: 'sk-test...',
  name: 'OpenAI',
  timeout: 30000
});

// Verify: Provider was added
const provider = await chromeConfig.getProvider('openai');
console.assert(provider.apiKey === 'sk-test...', 'API key should be saved');
```

### Scenario 2: Migration from Old System
**Goal**: Verify migration from ModelClientFactory storage

```typescript
// Setup: Simulate old storage format
chrome.storage.sync.set({
  'openai_api_key': 'sk-old...',
  'anthropic_api_key': 'claude-old...',
  'default_provider': 'openai'
});

// Test: Run migration
const result = await chromeConfig.migrateFromLegacy();
console.assert(result.success === true, 'Migration should succeed');
console.assert(result.itemsMigrated === 3, 'Should migrate 3 items');

// Verify: Old keys are migrated
const config = await chromeConfig.getConfig();
console.assert(config.providers.openai.apiKey === 'sk-old...', 'OpenAI key migrated');
console.assert(config.providers.anthropic.apiKey === 'claude-old...', 'Anthropic key migrated');
console.assert(config.model.provider === 'openai', 'Default provider migrated');

// Verify: Old keys are cleaned up
const oldKeys = await chrome.storage.sync.get(['openai_api_key', 'anthropic_api_key']);
console.assert(Object.keys(oldKeys).length === 0, 'Old keys should be removed');
```

### Scenario 3: Profile Management
**Goal**: Test profile creation and switching

```typescript
// Test: Create development profile
const devProfile = await chromeConfig.createProfile({
  name: 'development',
  description: 'Fast iterations with GPT-3.5',
  model: 'gpt-3.5-turbo',
  provider: 'openai',
  modelSettings: {
    maxOutputTokens: 2000,
    verbosity: 'high'
  },
  created: Date.now()
});

// Test: Create production profile
const prodProfile = await chromeConfig.createProfile({
  name: 'production',
  description: 'Quality output with GPT-4',
  model: 'gpt-4',
  provider: 'openai',
  modelSettings: {
    maxOutputTokens: 4000,
    verbosity: 'low',
    reasoningEffort: 'high'
  },
  created: Date.now()
});

// Test: Switch profiles
await chromeConfig.activateProfile('development');
let active = await chromeConfig.getConfig();
console.assert(active.activeProfile === 'development', 'Dev profile should be active');
console.assert(active.model.selected === 'gpt-3.5-turbo', 'Should use GPT-3.5');

await chromeConfig.activateProfile('production');
active = await chromeConfig.getConfig();
console.assert(active.activeProfile === 'production', 'Prod profile should be active');
console.assert(active.model.selected === 'gpt-4', 'Should use GPT-4');
```

### Scenario 4: Storage Limits & Sync
**Goal**: Test Chrome storage constraints

```typescript
// Test: Check storage usage
const info = await chromeConfig.getStorageInfo();
console.assert(info.used < 100000, 'Should be under 100KB sync limit');
console.assert(info.percentUsed < 0.8, 'Should trigger warning at 80%');

// Test: Large config splitting
const largeProfile = {
  name: 'large',
  model: 'gpt-4',
  provider: 'openai',
  modelSettings: {
    // Add large amount of data
    customPrompts: Array(100).fill('x'.repeat(100))
  },
  created: Date.now()
};

await chromeConfig.createProfile(largeProfile);
// Should automatically split into multiple storage keys if > 8KB

// Test: Sync across devices (simulated)
await chromeConfig.updatePreferences({ autoSync: true });
// Changes should propagate via chrome.storage.sync
```

### Scenario 5: API Provider Configuration
**Goal**: Test multiple provider setup

```typescript
// Test: Configure OpenAI
await chromeConfig.addProvider({
  id: 'openai',
  name: 'OpenAI',
  apiKey: 'sk-test...',
  baseUrl: 'https://api.openai.com/v1',
  organization: 'org-123',
  timeout: 30000,
  retryConfig: {
    maxRetries: 3,
    initialDelay: 1000
  }
});

// Test: Configure Anthropic
await chromeConfig.addProvider({
  id: 'anthropic',
  name: 'Anthropic',
  apiKey: 'claude-test...',
  baseUrl: 'https://api.anthropic.com',
  version: '2024-01-01',
  timeout: 45000,
  retryConfig: {
    maxRetries: 5,
    initialDelay: 2000
  }
});

// Test: Switch between providers
await chromeConfig.updateModelConfig({
  provider: 'anthropic',
  selected: 'claude-3-opus-20240229'
});

const model = await chromeConfig.getModelConfig();
console.assert(model.provider === 'anthropic', 'Should switch to Anthropic');
console.assert(model.selected.includes('claude'), 'Should select Claude model');
```

### Scenario 6: Import/Export Configuration
**Goal**: Test config backup and restore

```typescript
// Test: Export configuration
const exportData = await chromeConfig.exportConfig(false); // without API keys
console.assert(exportData.version === '1.0.0', 'Export version should match');
console.assert(exportData.config.providers.openai.apiKey === '[REDACTED]', 'API keys should be redacted');

// Test: Export with API keys
const fullExport = await chromeConfig.exportConfig(true);
console.assert(fullExport.config.providers.openai.apiKey !== '[REDACTED]', 'API keys should be included');

// Test: Reset and import
await chromeConfig.resetConfig(false);
let config = await chromeConfig.getConfig();
console.assert(Object.keys(config.profiles || {}).length === 0, 'Profiles should be cleared');

await chromeConfig.importConfig(fullExport);
config = await chromeConfig.getConfig();
console.assert(config.providers.openai.apiKey === 'sk-test...', 'Config should be restored');
```

## Validation Checklist

### ✅ Core Functionality
- [ ] Config loads without errors
- [ ] Default values are applied correctly
- [ ] Storage operations complete within 200ms
- [ ] No console errors during normal operation

### ✅ Migration
- [ ] Legacy keys are detected
- [ ] Migration completes successfully
- [ ] Old keys are cleaned up
- [ ] No data loss during migration

### ✅ Storage Constraints
- [ ] Config stays under 100KB sync limit
- [ ] Large items split correctly (> 8KB)
- [ ] Storage quota warnings appear at 80%
- [ ] Local storage fallback works

### ✅ Chrome Integration
- [ ] Extension settings page loads
- [ ] Config changes reflect immediately
- [ ] Sync works across devices
- [ ] Permissions are requested appropriately

### ✅ Error Handling
- [ ] Invalid configs are rejected
- [ ] Storage errors show user-friendly messages
- [ ] API key validation provides feedback
- [ ] Migration failures are recoverable

## Performance Benchmarks

### Expected Performance
- Config load: < 50ms
- Config save: < 100ms
- Profile switch: < 150ms
- Migration: < 500ms
- Full export: < 200ms
- Full import: < 300ms

### Test Script
```bash
npm run test:config         # Unit tests
npm run test:integration    # Integration tests
npm run test:performance    # Performance benchmarks
npm run test:migration      # Migration scenarios
```

## Troubleshooting

### Issue: Migration doesn't run
- Check Chrome DevTools > Application > Storage
- Look for old keys: `openai_api_key`, `anthropic_api_key`
- Manually trigger: `await chromeConfig.migrateFromLegacy()`

### Issue: Storage quota exceeded
- Check usage: `await chromeConfig.getStorageInfo()`
- Clear unused profiles
- Disable cache persistence
- Use storage.local for large data

### Issue: Sync not working
- Verify Chrome is signed in
- Check sync settings in Chrome
- Ensure `autoSync` preference is true
- Check network connectivity

### Issue: Config validation fails
- Check console for specific field errors
- Verify schema version matches
- Use `chromeConfig.validateConfig()` for details
- Reset to defaults if corrupted

## Next Steps
After validation:
1. Run comprehensive test suite
2. Test with real API calls
3. Verify UI integration
4. Test across different Chrome versions
5. Performance profiling with Chrome DevTools