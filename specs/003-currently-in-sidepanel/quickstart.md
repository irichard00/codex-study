# Quickstart: Sidepanel Settings with OpenAI API Key Management

**Feature**: 003-currently-in-sidepanel
**Prerequisites**: Chrome browser with extension loaded

## Setup (5 minutes)

### 1. Load Extension
```bash
# Install dependencies
npm install

# Build extension
npm run build

# Load in Chrome
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project directory
```

### 2. Open Sidepanel
1. Click extension icon in toolbar
2. Select "Open sidepanel"
3. Sidepanel appears on the right

## User Journey Tests

### Test 1: First-Time Setup (No API Key)
**Goal**: Add an API key for the first time

1. **Open Settings**
   - Look at bottom of sidepanel
   - ✓ Gear icon visible
   - Hover over gear icon
   - ✓ Tooltip shows "setting"
   - Click gear icon
   - ✓ Settings modal opens

2. **View Empty State**
   - ✓ No API key displayed
   - ✓ "Add API Key" button visible
   - ✓ No masked key shown

3. **Add API Key**
   - Click "Add API Key" button
   - ✓ Input field appears
   - Enter invalid key: "test123"
   - ✓ Error: "API key must start with 'sk-' and be at least 43 characters"
   - Enter valid key: "sk-1234567890abcdefghijklmnopqrstuvwxyz123"
   - Click "Save"
   - ✓ Success message: "API key saved successfully"
   - ✓ Masked key shows: "sk-123***"

### Test 2: Existing API Key Management
**Goal**: View and update existing API key

1. **Open Settings with Existing Key**
   - Click gear icon
   - ✓ Settings modal opens
   - ✓ Masked key displayed: "sk-123***"
   - ✓ "Update" and "Clear API Key" buttons visible

2. **Update API Key**
   - Click "Update" button
   - ✓ Input field appears (empty)
   - Enter new key: "sk-newkey7890abcdefghijklmnopqrstuvwxyz456"
   - Click "Save"
   - ✓ Success message appears
   - ✓ New masked key: "sk-new***"

3. **Close and Reopen**
   - Click outside modal or X button
   - ✓ Modal closes
   - Click gear icon again
   - ✓ Updated key still displayed

### Test 3: Delete API Key
**Goal**: Remove stored API key

1. **Delete Key**
   - Open settings (gear icon)
   - Click "Clear API Key"
   - ✓ Confirmation dialog appears
   - Click "Cancel"
   - ✓ Key remains unchanged
   - Click "Clear API Key" again
   - Click "Confirm"
   - ✓ Success: "API key deleted successfully"
   - ✓ Returns to "Add API Key" state

### Test 4: Storage Persistence
**Goal**: Verify data persists across sessions

1. **Add Key and Reload**
   - Add an API key
   - Close sidepanel
   - Reload extension (chrome://extensions → Reload)
   - Open sidepanel again
   - Open settings
   - ✓ API key still present (masked)

### Test 5: Error Handling
**Goal**: Test error scenarios

1. **Storage Quota** (Simulated)
   - Fill storage to near-quota
   - Try to save API key
   - ✓ Error: "Storage limit reached"
   - ✓ Suggestion to clear data

2. **Invalid Formats**
   - Try: "not-an-api-key"
   - ✓ Error shows immediately
   - Try: "sk-" (too short)
   - ✓ Error about minimum length
   - Try: Very long string (300+ chars)
   - ✓ Error about maximum length

## Validation Checklist

### UI Elements
- [ ] Gear icon at bottom of sidepanel
- [ ] Tooltip shows "setting" on hover
- [ ] Modal opens/closes smoothly
- [ ] All buttons are clickable
- [ ] Input field accepts text
- [ ] Error messages display in red
- [ ] Success messages display in green

### Functionality
- [ ] API key saves to storage
- [ ] API key persists after reload
- [ ] Masking shows only first 6 characters
- [ ] Update replaces existing key
- [ ] Delete removes key completely
- [ ] Validation prevents invalid keys

### Accessibility
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Screen reader announces changes
- [ ] Focus management in modal
- [ ] High contrast mode readable

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Gear icon not visible | Check sidepanel HTML structure |
| Settings won't open | Check event listeners attached |
| Key not saving | Check Chrome storage permissions |
| Modal won't close | Verify click-outside handler |
| Validation not working | Check regex pattern matching |

## Success Criteria

✅ All 5 test scenarios pass
✅ No console errors during operation
✅ Settings accessible within 2 clicks
✅ API key persists across sessions
✅ Clear error messages for invalid input
✅ Responsive UI under 100ms

## Next Steps

After validation:
1. Run automated tests: `npm test`
2. Check accessibility: Chrome DevTools Lighthouse
3. Test in different Chrome versions
4. Document any edge cases found