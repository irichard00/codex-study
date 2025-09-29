# Quickstart: AgentConfig Integration Fix

## Overview
This guide walks through verifying that the AgentConfig integration fix is working correctly in the codex-chrome extension.

## Prerequisites
- Node.js 22+ and pnpm installed
- Repository cloned and dependencies installed
- Chrome browser for extension testing

## Quick Verification Steps

### 1. Build the Extension
```bash
cd codex-chrome
pnpm build
```

### 2. Run Unit Tests
```bash
# Run tests to verify config integration
pnpm test

# Specific test files to check
pnpm test src/core/Session.test.ts
pnpm test src/core/ApprovalManager.test.ts
pnpm test src/tools/ToolRegistry.test.ts
pnpm test src/models/ModelClientFactory.test.ts
```

### 3. Verify Constructor Changes

Check that components accept config parameter:

```typescript
// Should work without errors
import { AgentConfig } from './src/config/AgentConfig';
import { Session } from './src/core/Session';
import { ToolRegistry } from './src/tools/ToolRegistry';
import { ApprovalManager } from './src/core/ApprovalManager';

const config = AgentConfig.getInstance();

// These should all work after the fix
const session = new Session(config);
const toolRegistry = new ToolRegistry(config);
const approvalManager = new ApprovalManager(config);
```

### 4. Verify Initialize Methods

Check that initialize methods exist and work:

```typescript
import { ModelClientFactory } from './src/models/ModelClientFactory';
import { ToolRegistry } from './src/tools/ToolRegistry';

const config = await AgentConfig.getInstance().initialize();

// These should work after the fix
const factory = ModelClientFactory.getInstance();
await factory.initialize(config);

const registry = new ToolRegistry(config);
await registry.initialize(config);
```

### 5. Test Config Propagation

Create a test scenario to verify config flows through components:

```typescript
// test-config-flow.ts
import { CodexAgent } from './src/core/CodexAgent';
import { AgentConfig } from './src/config/AgentConfig';

async function testConfigFlow() {
  // Create agent with config
  const config = AgentConfig.getInstance();
  await config.initialize();

  const agent = new CodexAgent(config);
  await agent.initialize();

  // Verify components received config
  const session = agent.getSession();
  const toolRegistry = agent.getToolRegistry();
  const approvalManager = agent.getApprovalManager();

  console.log('✅ Session has config:', session.config !== undefined);
  console.log('✅ ToolRegistry has config:', toolRegistry.config !== undefined);
  console.log('✅ ApprovalManager has config:', approvalManager.config !== undefined);
}

testConfigFlow().catch(console.error);
```

### 6. Test Backward Compatibility

Verify components still work without config:

```typescript
// test-backward-compat.ts
import { Session } from './src/core/Session';
import { ToolRegistry } from './src/tools/ToolRegistry';
import { ApprovalManager } from './src/core/ApprovalManager';

// These should still work (backward compatibility)
const session = new Session();  // or new Session(undefined, true)
const toolRegistry = new ToolRegistry();
const approvalManager = new ApprovalManager();

console.log('✅ Backward compatibility maintained');
```

## Expected Results

After implementing the fix, you should see:

1. ✅ No TypeScript compilation errors
2. ✅ All existing tests pass
3. ✅ New config parameters are accepted
4. ✅ Initialize methods are callable
5. ✅ Config values influence component behavior
6. ✅ Backward compatibility is maintained

## Troubleshooting

### Issue: "Property 'config' does not exist"
**Solution**: Ensure the component class has been updated to include the config property

### Issue: "Property 'initialize' does not exist"
**Solution**: Add the initialize method to ModelClientFactory and ToolRegistry

### Issue: Tests fail after changes
**Solution**: Update test files to match new constructor signatures (config param is optional)

## Manual Testing in Browser

1. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `codex-chrome/dist` directory

2. Open the extension popup and verify:
   - Configuration settings are applied
   - Components initialize without errors
   - Config changes are reflected in behavior

## Success Criteria Checklist

- [ ] CodexAgent initializes without errors
- [ ] Session accepts and uses AgentConfig
- [ ] ToolRegistry accepts and uses AgentConfig
- [ ] ApprovalManager accepts and uses AgentConfig
- [ ] ModelClientFactory.initialize(config) works
- [ ] ToolRegistry.initialize(config) works
- [ ] Config changes propagate to components
- [ ] Existing tests continue to pass
- [ ] Backward compatibility is maintained

## Next Steps

Once all checks pass:
1. Run the full test suite: `pnpm test`
2. Build the production bundle: `pnpm build`
3. Test the extension in Chrome
4. Document any additional configuration options needed