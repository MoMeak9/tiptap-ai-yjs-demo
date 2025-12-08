# AI API Integration Guide

## Overview

The AI suggestion feature now uses the **real DeepSeek API** for text improvement instead of simulated transformations.

## Architecture

```
User selects text → clicks "🤖 AI" button
    ↓
fetchAIRewrite(text)
    ↓
POST http://localhost:3001/api/ai/rewrite
    ↓
DeepSeek API (deepseek-chat model)
    ↓
Token array response [{text, marks, markAttrs}]
    ↓
Convert to plain text → applyAISuggestion()
    ↓
Show diff with accept/reject UI
```

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Frontend (Vite)
VITE_AI_API_URL=http://localhost:3001

# Backend/Server
DEEPSEEK_API_KEY=your_actual_api_key_here
PORT=3001
```

### 2. Start Servers

```bash
# Terminal 1: Start AI proxy server
pnpm run server

# Terminal 2: Start frontend dev server
pnpm run dev
```

### 3. Test the Feature

1. Open http://localhost:3000
2. Select any text in the editor
3. Click the "🤖 AI" button in toolbar
4. Button shows "⏳ AI Processing..." while waiting
5. After ~3-10 seconds, diff UI appears
6. Accept/reject suggestions individually or all at once

## API Details

### Request Format

```typescript
POST /api/ai/rewrite
Content-Type: application/json

{
  "content": "Text to improve",
  "instruction": "Improve and refine this text professionally...",
  "format": "json"  // or "html" or "yjs"
}
```

### Response Format (format='json')

```json
{
  "success": true,
  "data": [
    {
      "text": "This",
      "marks": [],
      "markAttrs": {}
    },
    {
      "text": " ",
      "marks": [],
      "markAttrs": {}
    },
    {
      "text": "is",
      "marks": [],
      "markAttrs": {}
    }
  ],
  "meta": {
    "model": "deepseek-chat",
    "duration": 9815,
    "tokenCount": 362
  }
}
```

### Response Format (format='html')

```json
{
  "success": true,
  "data": "<p>Improved text with <strong>formatting</strong></p>",
  "meta": {
    "model": "deepseek-chat",
    "duration": 8234,
    "tokenCount": 412
  }
}
```

## Error Handling

### Common Errors

1. **Server not running**
   ```
   Error: Failed to fetch
   Solution: Run `pnpm run server` first
   ```

2. **API key not configured**
   ```
   Error: DEEPSEEK_API_KEY not configured
   Solution: Add valid API key to .env file
   ```

3. **Network timeout**
   ```
   Error: AI returned empty or unchanged text
   Solution: Check internet connection, try again
   ```

### User-Facing Error Messages

All errors show a friendly alert with:
- Clear error description
- Setup checklist (server running, API key configured)
- Actionable next steps

## Code Reference

### Main Integration Points

- [src/main.ts:237](../src/main.ts#L237) - `fetchAIRewrite()` function
- [src/main.ts:189](../src/main.ts#L189) - `applyAISuggestionDemo()` async handler
- [server/index.ts:40](../server/index.ts#L40) - `/api/ai/rewrite` endpoint
- [server/deepseek.ts:25](../server/deepseek.ts#L25) - DeepSeek API client

### Environment Variable Types

- [src/vite-env.d.ts](../src/vite-env.d.ts) - TypeScript declarations for `import.meta.env.VITE_AI_API_URL`

## API Costs

DeepSeek pricing (as of 2024):
- ~$0.001 per 1K tokens
- Average suggestion: 300-500 tokens (~$0.0005 per request)
- Very cost-effective compared to other AI providers

## Performance

- **Average response time**: 3-10 seconds
- **Token count**: 300-500 tokens per request
- **Rate limits**: Check DeepSeek documentation
- **Timeout**: 30 seconds (configurable)

## Development vs Production

### Development Mode
- Uses `http://localhost:3001` by default
- API key from local `.env` file
- Full error messages displayed

### Production Mode
1. Set `VITE_AI_API_URL` to production API URL
2. Configure production `DEEPSEEK_API_KEY`
3. Consider adding:
   - Rate limiting (per user/IP)
   - Request queuing for heavy load
   - Caching for repeated requests
   - Usage analytics and monitoring

## Testing

### Manual Testing

```bash
# Test server health
curl http://localhost:3001/api/health

# Test AI rewrite endpoint
curl -X POST http://localhost:3001/api/ai/rewrite \
  -H 'Content-Type: application/json' \
  -d '{"content":"test text","instruction":"improve","format":"json"}'
```

### Expected Behavior

1. ✅ Button disables during API call
2. ✅ Loading indicator shows "⏳ AI Processing..."
3. ✅ Success: Diff UI appears with suggestions
4. ✅ Error: Alert shows with helpful message
5. ✅ Button re-enables after completion/error

## Troubleshooting

### Issue: Button does nothing

**Check:**
- Browser console for errors
- Network tab for failed requests
- Server logs: `pnpm run server` output

### Issue: "AI returned empty text"

**Possible causes:**
- AI response identical to input (no changes needed)
- API timeout (response too slow)
- Parsing error in token array

**Debug:**
```javascript
// Check browser console for:
console.log("Original:", originalText);
console.log("AI Suggestion:", aiText);
```

### Issue: High latency

**Optimization ideas:**
- Add loading progress indicator
- Implement request debouncing
- Cache common transformations
- Use streaming API (future enhancement)

## Future Enhancements

Potential improvements:
1. **Custom instructions UI** - Let users specify how to improve text
2. **Instruction presets** - Quick buttons like "Make formal", "Simplify", "Expand"
3. **Streaming responses** - Show AI output as it generates
4. **Retry mechanism** - Auto-retry failed requests
5. **Usage analytics** - Track token usage and costs
6. **Offline fallback** - Use local transformations when API unavailable
7. **Yjs format support** - Direct Yjs operations for more efficient updates

## Related Documentation

- [AI_SUGGESTION_TESTING_GUIDE.md](./AI_SUGGESTION_TESTING_GUIDE.md) - Original testing guide
- [EXPERT_AI_DESIGN.md](./EXPERT_AI_DESIGN.md) - AI feature architecture
- [server/README.md](../server/README.md) - Server setup and API docs
