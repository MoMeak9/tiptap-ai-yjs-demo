import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AIRewriteRequest, AIRewriteResponse, YjsOperation } from '../../server/types';

/**
 * Phase 1 PoC Test Suite
 *
 * Purpose: Validate DeepSeek's ability to generate Yjs operations directly
 *
 * Success Criteria:
 * - Text Accuracy: >95%
 * - Format Preservation: >90%
 * - Consistency: >90%
 * - Response Time: <3s per operation
 */

interface TestCase {
  id: string;
  name: string;
  input: {
    original: any;
    instruction: string;
    outputFormat: 'yjs' | 'json' | 'html';
  };
  expected: {
    operations: YjsOperation[];
  };
  validation: {
    textAccuracy: number;
    formatPreservation: number;
    consistency: number;
  };
}

// Load test cases from fixtures
const testCases: TestCase[] = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/poc-test-cases.json'), 'utf-8')
).testCases;

// Server configuration
const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const TIMEOUT_MS = 5000; // 5s timeout for requests

/**
 * Helper: Call AI rewrite endpoint
 */
async function callAIRewrite(request: AIRewriteRequest): Promise<AIRewriteResponse> {
  const response = await fetch(`${SERVER_URL}/api/ai/rewrite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

/**
 * Helper: Calculate text accuracy between expected and actual operations
 */
function calculateTextAccuracy(expected: YjsOperation[], actual: YjsOperation[]): number {
  if (expected.length === 0 && actual.length === 0) return 1.0;
  if (expected.length === 0 || actual.length === 0) return 0.0;

  let matches = 0;
  let total = expected.length;

  for (const exp of expected) {
    const match = actual.find(act => {
      if (exp.type !== act.type) return false;
      if (exp.type === 'insert') return exp.content === act.content;
      if (exp.type === 'delete') return exp.length === act.length;
      if (exp.type === 'formatChange') {
        return (
          exp.removeMark?.type === act.removeMark?.type &&
          exp.addMark?.type === act.addMark?.type
        );
      }
      if (exp.type === 'setBlockType') return exp.blockType === act.blockType;
      return false;
    });

    if (match) matches++;
  }

  return matches / total;
}

/**
 * Helper: Calculate format preservation accuracy
 */
function calculateFormatPreservation(expected: YjsOperation[], actual: YjsOperation[]): number {
  const formatOps = expected.filter(
    op => op.type === 'formatChange' || op.marks || op.blockType
  );

  if (formatOps.length === 0) return 1.0;

  let matches = 0;
  for (const exp of formatOps) {
    const match = actual.find(act => {
      if (exp.type !== act.type) return false;

      // Check marks preservation
      if (exp.marks && act.marks) {
        const expMarks = exp.marks.map(m => m.type).sort().join(',');
        const actMarks = act.marks.map(m => m.type).sort().join(',');
        if (expMarks !== actMarks) return false;
      }

      // Check formatChange marks
      if (exp.type === 'formatChange') {
        return (
          exp.removeMark?.type === act.removeMark?.type &&
          exp.addMark?.type === act.addMark?.type
        );
      }

      // Check blockType
      if (exp.blockType && exp.blockType !== act.blockType) return false;

      return true;
    });

    if (match) matches++;
  }

  return matches / formatOps.length;
}

/**
 * Helper: Calculate position consistency
 */
function calculateConsistency(operations: YjsOperation[]): number {
  let consistent = true;

  for (let i = 0; i < operations.length - 1; i++) {
    const current = operations[i];
    const next = operations[i + 1];

    // Check position ordering
    if (current.position !== undefined && next.position !== undefined) {
      if (current.position > next.position) {
        consistent = false;
        break;
      }
    }

    // Check range validity
    if (current.from !== undefined && current.to !== undefined) {
      if (current.from > current.to) {
        consistent = false;
        break;
      }
    }
  }

  return consistent ? 1.0 : 0.0;
}

describe('Phase 1 PoC: DeepSeek Yjs Operations Generation', () => {
  beforeAll(async () => {
    // Check server health
    try {
      const response = await fetch(`${SERVER_URL}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) {
        throw new Error('Server health check failed');
      }
      const data = await response.json();
      console.log('✓ Server healthy:', data);
    } catch (error) {
      console.error('✗ Server health check failed:', error);
      throw new Error(
        `Server not available at ${SERVER_URL}. Please start the server first: pnpm run server`
      );
    }
  });

  describe('Test Cases', () => {
    for (const testCase of testCases) {
      test(
        `${testCase.id}: ${testCase.name}`,
        async () => {
          const startTime = Date.now();

          // Execute AI rewrite
          const response = await callAIRewrite({
            content: testCase.input.original,
            instruction: testCase.input.instruction,
            format: testCase.input.outputFormat,
          });

          const duration = Date.now() - startTime;

          // Assertions
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();
          expect(response.data.operations).toBeInstanceOf(Array);
          expect(response.data.operations.length).toBeGreaterThan(0);

          // Response time check
          expect(duration).toBeLessThan(3000); // <3s requirement

          console.log(`\n[${testCase.id}] Results:`);
          console.log(`  Response Time: ${duration}ms`);
          console.log(`  Operations Generated: ${response.data.operations.length}`);

          // Calculate metrics
          const textAccuracy = calculateTextAccuracy(
            testCase.expected.operations,
            response.data.operations
          );
          const formatPreservation = calculateFormatPreservation(
            testCase.expected.operations,
            response.data.operations
          );
          const consistency = calculateConsistency(response.data.operations);

          console.log(`  Text Accuracy: ${(textAccuracy * 100).toFixed(1)}%`);
          console.log(`  Format Preservation: ${(formatPreservation * 100).toFixed(1)}%`);
          console.log(`  Consistency: ${(consistency * 100).toFixed(1)}%`);

          // Validate against success criteria
          expect(textAccuracy).toBeGreaterThanOrEqual(testCase.validation.textAccuracy);
          expect(formatPreservation).toBeGreaterThanOrEqual(
            testCase.validation.formatPreservation
          );
          expect(consistency).toBeGreaterThanOrEqual(testCase.validation.consistency);

          // Log operations for manual inspection
          console.log('\n  Expected Operations:');
          testCase.expected.operations.forEach((op, idx) => {
            console.log(`    ${idx + 1}. ${op.type}:`, op.description || JSON.stringify(op));
          });

          console.log('\n  Actual Operations:');
          response.data.operations.forEach((op: YjsOperation, idx: number) => {
            console.log(`    ${idx + 1}. ${op.type}:`, op.description || JSON.stringify(op));
          });
        },
        { timeout: 10000 }
      );
    }
  });

  describe('Performance Metrics', () => {
    test('Average response time across all test cases', async () => {
      const times: number[] = [];

      for (const testCase of testCases) {
        const startTime = Date.now();

        await callAIRewrite({
          content: testCase.input.original,
          instruction: testCase.input.instruction,
          format: testCase.input.outputFormat,
        });

        times.push(Date.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log('\n📊 Performance Summary:');
      console.log(`  Average: ${avgTime.toFixed(0)}ms`);
      console.log(`  Min: ${minTime}ms`);
      console.log(`  Max: ${maxTime}ms`);

      expect(avgTime).toBeLessThan(3000); // Average should be <3s
    });
  });

  describe('Overall PoC Assessment', () => {
    test('Generate PoC summary report', async () => {
      const results: Array<{
        testCase: string;
        textAccuracy: number;
        formatPreservation: number;
        consistency: number;
        responseTime: number;
      }> = [];

      for (const testCase of testCases) {
        const startTime = Date.now();

        const response = await callAIRewrite({
          content: testCase.input.original,
          instruction: testCase.input.instruction,
          format: testCase.input.outputFormat,
        });

        const duration = Date.now() - startTime;

        results.push({
          testCase: testCase.name,
          textAccuracy: calculateTextAccuracy(
            testCase.expected.operations,
            response.data.operations
          ),
          formatPreservation: calculateFormatPreservation(
            testCase.expected.operations,
            response.data.operations
          ),
          consistency: calculateConsistency(response.data.operations),
          responseTime: duration,
        });
      }

      // Calculate overall metrics
      const avgTextAccuracy =
        results.reduce((sum, r) => sum + r.textAccuracy, 0) / results.length;
      const avgFormatPreservation =
        results.reduce((sum, r) => sum + r.formatPreservation, 0) / results.length;
      const avgConsistency =
        results.reduce((sum, r) => sum + r.consistency, 0) / results.length;
      const avgResponseTime =
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

      console.log('\n' + '='.repeat(60));
      console.log('📋 PHASE 1 PoC FINAL ASSESSMENT');
      console.log('='.repeat(60));
      console.log('\n📊 Overall Metrics:');
      console.log(`  Text Accuracy:       ${(avgTextAccuracy * 100).toFixed(1)}% (target: >95%)`);
      console.log(
        `  Format Preservation: ${(avgFormatPreservation * 100).toFixed(1)}% (target: >90%)`
      );
      console.log(`  Consistency:         ${(avgConsistency * 100).toFixed(1)}% (target: >90%)`);
      console.log(`  Response Time:       ${avgResponseTime.toFixed(0)}ms (target: <3000ms)`);

      // Determine PoC outcome
      const pocPassed =
        avgTextAccuracy >= 0.95 &&
        avgFormatPreservation >= 0.9 &&
        avgConsistency >= 0.9 &&
        avgResponseTime < 3000;

      console.log('\n🎯 PoC Decision:');
      if (pocPassed) {
        console.log('  ✅ PASS - Proceed with Yjs Operations Approach (方案 A)');
        console.log('  ➡️  Next: Phase 2 - TokenCodec Implementation');
      } else {
        console.log('  ❌ FAIL - Switch to Fallback Strategy (方案 C)');
        console.log('  ➡️  Next: AI returns HTML/JSON, frontend performs Token Diff');
        console.log('\n  Reasons:');
        if (avgTextAccuracy < 0.95)
          console.log(`    - Text accuracy ${(avgTextAccuracy * 100).toFixed(1)}% < 95%`);
        if (avgFormatPreservation < 0.9)
          console.log(
            `    - Format preservation ${(avgFormatPreservation * 100).toFixed(1)}% < 90%`
          );
        if (avgConsistency < 0.9)
          console.log(`    - Consistency ${(avgConsistency * 100).toFixed(1)}% < 90%`);
        if (avgResponseTime >= 3000)
          console.log(`    - Response time ${avgResponseTime.toFixed(0)}ms >= 3000ms`);
      }

      console.log('\n' + '='.repeat(60) + '\n');

      // Assert overall success
      expect(pocPassed).toBe(true);
    });
  });
});
