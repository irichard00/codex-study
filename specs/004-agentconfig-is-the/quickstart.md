# Quickstart: Simplified Environment Configuration

**Feature**: Environment-Based AgentConfig (No Migration)
**Time**: 5 minutes

## Prerequisites

- Node.js 20+ installed
- codex-chrome repository cloned
- Basic familiarity with .env files

## Quick Setup

### 1. Install Dependencies (30 seconds)
```bash
cd codex-chrome
npm install
```

### 2. Create Your .env File (1 minute)
```bash
# Copy the example
cp .env.example .env

# Edit with your API key
echo "CODEX_PROVIDER_OPENAI_API_KEY=sk-proj-your-key-here" >> .env
echo "CODEX_MODEL_SELECTED=gpt-4" >> .env
echo "CODEX_MODEL_PROVIDER=openai" >> .env
```

### 3. Validate Configuration (30 seconds)
```bash
npm run validate:env
```

Expected output:
```
✅ Environment validation passed
✅ At least one provider has API key
✅ Model configuration is valid
```

### 4. Build Extension (2 minutes)
```bash
npm run build
```

The build process will:
- Load your .env configuration
- Validate all settings
- Generate build-config.ts
- Bundle the extension with embedded config

## Verification Tests

### Test 1: Configuration Loaded at Build Time
```bash
# Check that build-config.ts was generated
ls -la src/config/build-config.ts

# Verify content (API keys should be placeholders)
grep "RUNTIME_REPLACE" src/config/build-config.ts
```

### Test 2: Environment-Specific Loading
```bash
# Create development config
echo "CODEX_MODEL_SELECTED=gpt-3.5-turbo" > .env.development

# Build with development environment
NODE_ENV=development npm run build

# Check the build output uses development settings
grep "gpt-3.5-turbo" dist/background.js
```

### Test 3: Validation Catches Errors
```bash
# Create invalid config
echo "CODEX_MODEL_MAX_OUTPUT_TOKENS=200000" > .env.test
echo "CODEX_MODEL_CONTEXT_WINDOW=100000" >> .env.test

# Try to build (should fail)
NODE_ENV=test npm run build

# Expected error:
# ❌ maxOutputTokens (200000) cannot exceed contextWindow (100000)
```

### Test 4: No Migration Code Present
```bash
# Verify migration script removed
ls scripts/migrate-config.js 2>/dev/null || echo "✅ Migration script removed"

# Check package.json doesn't have migrate command
grep -v "migrate:config" package.json && echo "✅ No migration command"
```

## Common Scenarios

### Scenario 1: Multiple Providers
```bash
# .env
CODEX_PROVIDER_OPENAI_API_KEY=sk-...
CODEX_PROVIDER_ANTHROPIC_API_KEY=sk-ant-...
CODEX_MODEL_PROVIDER=openai  # Active provider
```

### Scenario 2: Custom Base URL (Local LLM)
```bash
# .env
CODEX_PROVIDER_CUSTOM_API_KEY=local-key
CODEX_PROVIDER_CUSTOM_BASE_URL=http://localhost:11434/v1
CODEX_MODEL_PROVIDER=custom
```

### Scenario 3: Development vs Production
```bash
# .env.development
CODEX_PREFERENCES_TELEMETRY_ENABLED=true
CODEX_CACHE_ENABLED=false

# .env.production
CODEX_PREFERENCES_TELEMETRY_ENABLED=false
CODEX_CACHE_ENABLED=true
```

## Troubleshooting

### Problem: "No API keys configured"
**Solution**: Ensure at least one `CODEX_PROVIDER_*_API_KEY` is set in .env

### Problem: Build fails with validation error
**Solution**: Run `npm run validate:env` to see specific issues

### Problem: Configuration not updating
**Solution**:
1. Make sure you're editing the correct .env file
2. Rebuild the extension after changes
3. Reload the extension in Chrome

## What Was Removed

Per the simplification requirements, the following features were removed:
- ❌ Config migration tool (`scripts/migrate-config.js`)
- ❌ Migration tests
- ❌ Import/export functionality
- ❌ Profile management
- ❌ Complex Zod schemas

## What Remains

The core functionality is preserved:
- ✅ .env file configuration
- ✅ Build-time injection
- ✅ Environment-specific configs
- ✅ Type safety
- ✅ Validation
- ✅ API key protection

## Next Steps

1. **Customize Settings**: Edit .env.example to see all available options
2. **Add More Providers**: Configure multiple AI providers
3. **Set Preferences**: Adjust cache, theme, and extension settings
4. **Environment Configs**: Create .env.development for local testing

## Success Criteria Met

- [x] `.env` file successfully configures AgentConfig at build time
- [x] Invalid configuration fails build with clear error messages
- [x] Sensitive data never exposed in logs or build output
- [x] All verification tests pass
- [x] No migration code present (simplified as requested)

## Support

If you encounter issues:
1. Check the validation output: `npm run validate:env`
2. Review .env.example for correct syntax
3. Ensure Node.js 20+ is installed
4. Clear dist/ and rebuild