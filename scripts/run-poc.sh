#!/bin/bash
# Phase 1 PoC Execution Script
# Purpose: Automated DeepSeek Yjs Operations PoC testing

set -e  # Exit on error

echo "=================================================="
echo "🧪 Phase 1 PoC: DeepSeek Yjs Operations Testing"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Environment validation
echo -e "${BLUE}[Step 1/5]${NC} Validating environment..."

if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  .env file not found${NC}"
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo ""
  echo -e "${RED}❌ DEEPSEEK_API_KEY not configured${NC}"
  echo "Please edit .env and add your DeepSeek API key:"
  echo "  DEEPSEEK_API_KEY=your_actual_api_key_here"
  echo ""
  exit 1
fi

# Check if DEEPSEEK_API_KEY is set
source .env
if [ -z "$DEEPSEEK_API_KEY" ] || [ "$DEEPSEEK_API_KEY" = "your_deepseek_api_key_here" ]; then
  echo -e "${RED}❌ DEEPSEEK_API_KEY not configured${NC}"
  echo "Please edit .env and add your DeepSeek API key"
  exit 1
fi

echo -e "${GREEN}✓${NC} Environment configured"
echo ""

# Step 2: Start server
echo -e "${BLUE}[Step 2/5]${NC} Starting AI proxy server..."

# Check if port 3001 is already in use
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo -e "${YELLOW}⚠️  Port 3001 already in use${NC}"
  echo "Attempting to kill existing process..."
  lsof -ti:3001 | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# Start server in background
echo "Starting server on http://localhost:3001..."
pnpm run server > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server started (PID: $SERVER_PID)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Server failed to start within 30 seconds${NC}"
    echo "Check server.log for details"
    cat server.log
    exit 1
  fi
  sleep 1
done
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo -e "${BLUE}[Cleanup]${NC} Stopping server (PID: $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  echo -e "${GREEN}✓${NC} Server stopped"
}

trap cleanup EXIT

# Step 3: Check AI health
echo -e "${BLUE}[Step 3/5]${NC} Checking DeepSeek API health..."

HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/ai/health)
HEALTHY=$(echo $HEALTH_RESPONSE | grep -o '"healthy":[^,}]*' | cut -d':' -f2)

if [ "$HEALTHY" = "true" ]; then
  echo -e "${GREEN}✓${NC} DeepSeek API is healthy"
else
  echo -e "${RED}❌ DeepSeek API health check failed${NC}"
  echo "Response: $HEALTH_RESPONSE"
  exit 1
fi
echo ""

# Step 4: Run PoC tests
echo -e "${BLUE}[Step 4/5]${NC} Running PoC test suite..."
echo ""

# Run vitest with output
if pnpm vitest run tests/integration/poc.test.ts --reporter=verbose; then
  TEST_RESULT=0
else
  TEST_RESULT=1
fi

echo ""

# Step 5: Generate report
echo -e "${BLUE}[Step 5/5]${NC} Generating PoC report..."

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="docs/poc-report-${TIMESTAMP}.md"

cat > "$REPORT_FILE" << EOF
# Phase 1 PoC Test Report

**Date**: $(date +"%Y-%m-%d %H:%M:%S")
**Test Suite**: DeepSeek Yjs Operations Generation
**Test Cases**: 5 (TC1-TC5)

## Test Execution

\`\`\`
Test Environment:
- Server: http://localhost:3001
- Model: deepseek-chat
- Temperature: 0.3
- Max Tokens: 2000
\`\`\`

## Results

EOF

if [ $TEST_RESULT -eq 0 ]; then
  cat >> "$REPORT_FILE" << EOF
**Status**: ✅ PASSED

The PoC successfully validated that DeepSeek can generate Yjs operations directly with:
- Text accuracy >95%
- Format preservation >90%
- Operation consistency >90%
- Response time <3s

### Recommendation

✅ **Proceed with Yjs Operations Approach (方案 A)**

Continue to Phase 2: TokenCodec implementation with confidence that the AI model can generate structured Yjs operations.

### Next Steps

1. Implement TokenCodec (src/core/tokenCodec.ts)
2. Implement StructuredDiff engine
3. Integrate with suggestion extension
4. Add conflict detection/resolution
5. Implement fine-grained undo system

EOF
else
  cat >> "$REPORT_FILE" << EOF
**Status**: ❌ FAILED

The PoC did not meet the success criteria. One or more metrics failed:
- Text accuracy <95%
- Format preservation <90%
- Operation consistency <90%
- Response time >3s

### Recommendation

❌ **Switch to Fallback Strategy (方案 C)**

Use hybrid approach:
1. AI returns HTML or Token JSON format
2. Frontend performs Token Diff
3. Generate Yjs operations from diff results

This approach provides fallback reliability while maintaining format preservation.

### Next Steps

1. Modify DeepSeek system prompt for JSON/HTML output
2. Implement Token Diff on frontend
3. Convert diff results to Yjs operations
4. Test end-to-end workflow

EOF
fi

cat >> "$REPORT_FILE" << EOF
## Detailed Logs

See \`server.log\` for detailed server logs.

## Test Artifacts

- Test suite: \`tests/integration/poc.test.ts\`
- Test cases: \`tests/fixtures/poc-test-cases.json\`
- Validation utils: \`tests/utils/validation.ts\`

---

*Generated by automated PoC execution script*
EOF

echo -e "${GREEN}✓${NC} Report saved to: $REPORT_FILE"
echo ""

# Display summary
echo "=================================================="
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}🎉 PoC PASSED - Proceed with Yjs Approach${NC}"
else
  echo -e "${RED}❌ PoC FAILED - Switch to Fallback Strategy${NC}"
fi
echo "=================================================="
echo ""
echo "📄 Full report: $REPORT_FILE"
echo "📋 Server logs: server.log"
echo ""

exit $TEST_RESULT
