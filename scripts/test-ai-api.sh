#!/bin/bash

# Test AI API Integration Script
# Usage: ./scripts/test-ai-api.sh

set -e

echo "🧪 Testing AI API Integration..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Server health check
echo "1️⃣  Testing server health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health)

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not responding${NC}"
    echo "   Run: pnpm run server"
    exit 1
fi

echo ""

# Test 2: AI health check
echo "2️⃣  Testing AI API connection..."
AI_HEALTH=$(curl -s http://localhost:3001/api/ai/health)

if echo "$AI_HEALTH" | grep -q '"healthy":true'; then
    echo -e "${GREEN}✅ DeepSeek API is configured and healthy${NC}"
elif echo "$AI_HEALTH" | grep -q 'API key not configured'; then
    echo -e "${RED}❌ DEEPSEEK_API_KEY not configured${NC}"
    echo "   Add your API key to .env file"
    exit 1
else
    echo -e "${YELLOW}⚠️  DeepSeek API health check failed${NC}"
    echo "   Response: $AI_HEALTH"
fi

echo ""

# Test 3: AI rewrite functionality
echo "3️⃣  Testing AI rewrite endpoint..."
REWRITE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/ai/rewrite \
  -H 'Content-Type: application/json' \
  -d '{"content":"This is a test.","instruction":"Improve this text professionally","format":"json"}')

if echo "$REWRITE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ AI rewrite successful${NC}"

    # Extract meta information
    DURATION=$(echo "$REWRITE_RESPONSE" | grep -o '"duration":[0-9]*' | cut -d':' -f2)
    TOKEN_COUNT=$(echo "$REWRITE_RESPONSE" | grep -o '"tokenCount":[0-9]*' | cut -d':' -f2)

    echo "   Duration: ${DURATION}ms"
    echo "   Tokens: ${TOKEN_COUNT}"

    # Show first few tokens
    echo "   Preview: $(echo "$REWRITE_RESPONSE" | head -c 200)..."
else
    echo -e "${RED}❌ AI rewrite failed${NC}"
    echo "   Response: $REWRITE_RESPONSE"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: pnpm run dev"
echo "  2. Open: http://localhost:3000"
echo "  3. Select text and click '🤖 AI' button"
