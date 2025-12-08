# Phase 1 PoC: DeepSeek Yjs Operations Testing

## Overview

This PoC validates whether DeepSeek can generate Yjs operations directly for the Token-based AI Suggestion system.

**Success Criteria:**
- ✅ Text Accuracy: >95%
- ✅ Format Preservation: >90%
- ✅ Operation Consistency: >90%
- ✅ Response Time: <3s per operation

## Quick Start

### Prerequisites

1. **DeepSeek API Key**: Get your API key from [DeepSeek Platform](https://platform.deepseek.com/)
2. **Node.js**: v18+ recommended
3. **pnpm**: `npm install -g pnpm`

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure API key
cp .env.example .env
# Edit .env and add your DeepSeek API key:
# DEEPSEEK_API_KEY=your_actual_api_key_here

# 3. Run PoC (automated)
pnpm run poc
```

The automated script will:
1. ✓ Validate environment configuration
2. ✓ Start the AI proxy server on port 3001
3. ✓ Check DeepSeek API health
4. ✓ Run 5 test cases (TC1-TC5)
5. ✓ Generate comprehensive report
6. ✓ Clean up and stop server

## Test Cases

### TC1: Simple Text Modification
**Input**: "Hello World" → "Hello Universe"
**Operations**: delete, insert
**Focus**: Basic text changes

### TC2: Inline Format Change
**Input**: "World" (bold) → "World" (italic)
**Operations**: formatChange (removeMark, addMark)
**Focus**: Format preservation without text change

### TC3: Block Type Change
**Input**: paragraph → heading
**Operations**: setBlockType
**Focus**: Block-level structural changes

### TC4: Compound Operation
**Input**: Text + format changes
**Operations**: Multiple operations (delete, insert, formatChange)
**Focus**: Complex combined edits

### TC5: Multi-Paragraph Operation
**Input**: Multiple paragraphs with various formats
**Operations**: Cross-paragraph changes
**Focus**: Large-scale edits

## Manual Testing

If you want to run tests manually:

```bash
# Start server (Terminal 1)
pnpm run server

# Run tests (Terminal 2)
pnpm run test:poc

# Or run specific test
pnpm vitest run tests/integration/poc.test.ts -t "TC1"
```

## API Testing

You can test the API directly using curl:

```bash
# Health check
curl http://localhost:3001/api/health

# DeepSeek health
curl http://localhost:3001/api/ai/health

# Rewrite request
curl -X POST http://localhost:3001/api/ai/rewrite \
  -H "Content-Type: application/json" \
  -d '{
    "content": {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello World"}]}]},
    "instruction": "Change World to Universe",
    "format": "yjs"
  }'
```

## Expected Output

### ✅ Success Case

```
==================================================
🧪 Phase 1 PoC: DeepSeek Yjs Operations Testing
==================================================

[Step 1/5] Validating environment...
✓ Environment configured

[Step 2/5] Starting AI proxy server...
✓ Server started (PID: 12345)

[Step 3/5] Checking DeepSeek API health...
✓ DeepSeek API is healthy

[Step 4/5] Running PoC test suite...

✓ TC1: Simple Text Modification (1245ms)
  Response Time: 1245ms
  Operations Generated: 2
  Text Accuracy: 100.0%
  Format Preservation: 100.0%
  Consistency: 100.0%

✓ TC2: Inline Format Change (982ms)
  ...

📊 Performance Summary:
  Average: 1123ms
  Min: 875ms
  Max: 1456ms

============================================================
📋 PHASE 1 PoC FINAL ASSESSMENT
============================================================

📊 Overall Metrics:
  Text Accuracy:       97.5% (target: >95%)
  Format Preservation: 94.2% (target: >90%)
  Consistency:         100.0% (target: >90%)
  Response Time:       1123ms (target: <3000ms)

🎯 PoC Decision:
  ✅ PASS - Proceed with Yjs Operations Approach (方案 A)
  ➡️  Next: Phase 2 - TokenCodec Implementation

============================================================

✓ Report saved to: docs/poc-report-20250108_143022.md

==================================================
🎉 PoC PASSED - Proceed with Yjs Approach
==================================================
```

### ❌ Failure Case

If the PoC fails to meet success criteria:

```
============================================================
📋 PHASE 1 PoC FINAL ASSESSMENT
============================================================

📊 Overall Metrics:
  Text Accuracy:       92.3% (target: >95%)
  Format Preservation: 85.1% (target: >90%)
  Consistency:         95.0% (target: >90%)
  Response Time:       1456ms (target: <3000ms)

🎯 PoC Decision:
  ❌ FAIL - Switch to Fallback Strategy (方案 C)
  ➡️  Next: AI returns HTML/JSON, frontend performs Token Diff

  Reasons:
    - Text accuracy 92.3% < 95%
    - Format preservation 85.1% < 90%

============================================================
```

## File Structure

```
tiptap-ai-yjs-demo/
├── server/
│   ├── index.ts           # Express server with /api/ai/rewrite endpoint
│   ├── deepseek.ts        # DeepSeek API client
│   └── types.ts           # TypeScript interfaces (YjsOperation, etc.)
├── tests/
│   ├── integration/
│   │   └── poc.test.ts    # Main PoC test suite
│   ├── fixtures/
│   │   └── poc-test-cases.json  # 5 test cases with expected outputs
│   └── utils/
│       └── validation.ts  # Operation validation utilities
├── scripts/
│   └── run-poc.sh         # Automated PoC execution script
├── docs/
│   ├── EXPERT_AI_DESIGN.md    # Complete technical specification
│   ├── POC_PLAN.md            # 3-day PoC plan
│   ├── POC_README.md          # This file
│   └── poc-report-*.md        # Generated test reports
└── .env                   # Environment configuration (create from .env.example)
```

## Troubleshooting

### Issue: Server won't start

```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill existing process
lsof -ti:3001 | xargs kill -9
```

### Issue: API key not working

```bash
# Verify .env file
cat .env | grep DEEPSEEK_API_KEY

# Test API key directly
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Issue: Tests failing

```bash
# Run with verbose output
pnpm vitest run tests/integration/poc.test.ts --reporter=verbose

# Check server logs
tail -f server.log

# Test individual case
pnpm vitest run tests/integration/poc.test.ts -t "TC1"
```

### Issue: Network timeout

Edit `.env`:
```bash
# Increase timeout (default: 5000ms)
TEST_TIMEOUT=10000
```

## Interpreting Results

### Metrics Explained

**Text Accuracy** (target: >95%)
- Measures correctness of text insertions and deletions
- Calculation: matching operations / total expected operations
- High accuracy = AI understands text changes correctly

**Format Preservation** (target: >90%)
- Measures correct handling of inline styles (bold, italic, etc.) and block types
- Calculation: matching format operations / total format operations
- High preservation = AI maintains formatting during edits

**Consistency** (target: >90%)
- Measures logical correctness of operation sequences
- Checks: position ordering, range validity, no overlaps
- High consistency = operations can be applied sequentially without errors

**Response Time** (target: <3s)
- Measures API latency from request to response
- Important for user experience in real-time editing
- <3s ensures responsive UI interaction

### Decision Points

**If ALL metrics pass (方案 A)**:
- ✅ Proceed with Yjs Operations approach
- ✅ AI generates operations directly
- ✅ Phase 2: Implement TokenCodec
- ✅ Best performance and accuracy

**If ANY metric fails (方案 C)**:
- ❌ Switch to Fallback strategy
- ❌ AI returns HTML/JSON tokens
- ❌ Frontend performs Token Diff
- ❌ More complex but more reliable

## Next Steps After PoC

### If PoC Passes (方案 A)

**Phase 2: TokenCodec Implementation** (3-4 days)
- Implement `src/core/tokenCodec.ts`
- Word-level tokenization with format preservation
- Unicode encoding for diff-match-patch compatibility

**Phase 3: StructuredDiff Engine** (4-5 days)
- Implement `src/core/structuredDiff.ts`
- Token-level diff algorithm
- Yjs operation generation from diff

**Phase 4: Server Integration** (2-3 days)
- Enhance DeepSeek prompt engineering
- Add retry logic and error handling
- Performance optimization

**Phase 5: Fine-grained Undo** (3-4 days)
- Implement conflict detection
- Add timestamp-based resolution
- Fine-grained undo system

### If PoC Fails (方案 C)

**Alternative Approach: Hybrid Token System**
1. Modify DeepSeek to return Token JSON or HTML
2. Implement frontend Token Diff
3. Generate Yjs operations from diff results
4. Test end-to-end workflow

## Support

For issues or questions:
1. Check `server.log` for server-side errors
2. Check vitest output for test details
3. Review generated PoC report in `docs/poc-report-*.md`
4. Consult `docs/EXPERT_AI_DESIGN.md` for technical details

---

**Last Updated**: 2025-01-08
**Version**: Phase 1 PoC
**Status**: Ready for execution
