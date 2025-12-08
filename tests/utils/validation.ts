import type { YjsOperation } from '../../server/types';

/**
 * Validation utilities for PoC testing
 */

/**
 * Validate Yjs operation structure
 */
export function validateYjsOperation(op: YjsOperation): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Type validation
  const validTypes = ['insert', 'delete', 'formatChange', 'setBlockType'];
  if (!validTypes.includes(op.type)) {
    errors.push(`Invalid operation type: ${op.type}`);
  }

  // Type-specific validation
  switch (op.type) {
    case 'insert':
      if (op.position === undefined) errors.push('insert requires position');
      if (!op.content) errors.push('insert requires content');
      break;

    case 'delete':
      if (op.position === undefined) errors.push('delete requires position');
      if (!op.length) errors.push('delete requires length');
      break;

    case 'formatChange':
      if (op.from === undefined) errors.push('formatChange requires from');
      if (op.to === undefined) errors.push('formatChange requires to');
      if (!op.removeMark && !op.addMark) {
        errors.push('formatChange requires removeMark or addMark');
      }
      break;

    case 'setBlockType':
      if (op.from === undefined) errors.push('setBlockType requires from');
      if (op.to === undefined) errors.push('setBlockType requires to');
      if (!op.blockType) errors.push('setBlockType requires blockType');
      break;
  }

  // Range validation
  if (op.from !== undefined && op.to !== undefined) {
    if (op.from > op.to) {
      errors.push(`Invalid range: from (${op.from}) > to (${op.to})`);
    }
  }

  // Position validation
  if (op.position !== undefined && op.position < 0) {
    errors.push(`Invalid position: ${op.position} < 0`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate operations sequence (no overlaps, correct ordering)
 */
export function validateOperationsSequence(operations: YjsOperation[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < operations.length - 1; i++) {
    const current = operations[i];
    const next = operations[i + 1];

    // Validate each operation
    const currentValidation = validateYjsOperation(current);
    if (!currentValidation.valid) {
      errors.push(`Operation ${i}: ${currentValidation.errors.join(', ')}`);
    }

    // Check position ordering for insert/delete
    if (
      current.type === 'insert' &&
      next.type === 'insert' &&
      current.position !== undefined &&
      next.position !== undefined
    ) {
      if (current.position > next.position) {
        errors.push(
          `Operations ${i} and ${i + 1}: positions not in ascending order (${current.position} > ${next.position})`
        );
      }
    }

    // Check for overlapping ranges
    if (
      current.from !== undefined &&
      current.to !== undefined &&
      next.from !== undefined &&
      next.to !== undefined
    ) {
      if (current.to > next.from) {
        errors.push(
          `Operations ${i} and ${i + 1}: overlapping ranges [${current.from}-${current.to}] and [${next.from}-${next.to}]`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Compare two operation sequences for similarity
 */
export function compareOperations(
  expected: YjsOperation[],
  actual: YjsOperation[]
): {
  similarity: number;
  differences: string[];
} {
  const differences: string[] = [];

  if (expected.length !== actual.length) {
    differences.push(
      `Different operation count: expected ${expected.length}, got ${actual.length}`
    );
  }

  let matches = 0;
  const minLength = Math.min(expected.length, actual.length);

  for (let i = 0; i < minLength; i++) {
    const exp = expected[i];
    const act = actual[i];

    if (exp.type !== act.type) {
      differences.push(`Operation ${i}: type mismatch (${exp.type} vs ${act.type})`);
      continue;
    }

    let operationMatches = true;

    switch (exp.type) {
      case 'insert':
        if (exp.content !== act.content) {
          differences.push(
            `Operation ${i}: content mismatch ("${exp.content}" vs "${act.content}")`
          );
          operationMatches = false;
        }
        if (exp.position !== act.position) {
          differences.push(
            `Operation ${i}: position mismatch (${exp.position} vs ${act.position})`
          );
          operationMatches = false;
        }
        break;

      case 'delete':
        if (exp.length !== act.length) {
          differences.push(`Operation ${i}: length mismatch (${exp.length} vs ${act.length})`);
          operationMatches = false;
        }
        if (exp.position !== act.position) {
          differences.push(
            `Operation ${i}: position mismatch (${exp.position} vs ${act.position})`
          );
          operationMatches = false;
        }
        break;

      case 'formatChange':
        if (exp.removeMark?.type !== act.removeMark?.type) {
          differences.push(
            `Operation ${i}: removeMark mismatch (${exp.removeMark?.type} vs ${act.removeMark?.type})`
          );
          operationMatches = false;
        }
        if (exp.addMark?.type !== act.addMark?.type) {
          differences.push(
            `Operation ${i}: addMark mismatch (${exp.addMark?.type} vs ${act.addMark?.type})`
          );
          operationMatches = false;
        }
        break;

      case 'setBlockType':
        if (exp.blockType !== act.blockType) {
          differences.push(
            `Operation ${i}: blockType mismatch (${exp.blockType} vs ${act.blockType})`
          );
          operationMatches = false;
        }
        break;
    }

    if (operationMatches) matches++;
  }

  return {
    similarity: expected.length > 0 ? matches / expected.length : 0,
    differences,
  };
}

/**
 * Format operation for display
 */
export function formatOperation(op: YjsOperation): string {
  switch (op.type) {
    case 'insert':
      return `INSERT "${op.content}" at ${op.position}${op.marks ? ` with marks: ${op.marks.map(m => m.type).join(', ')}` : ''}`;

    case 'delete':
      return `DELETE ${op.length} chars at ${op.position}`;

    case 'formatChange':
      return `FORMAT [${op.from}-${op.to}]: ${op.removeMark ? `remove ${op.removeMark.type}` : ''}${op.removeMark && op.addMark ? ', ' : ''}${op.addMark ? `add ${op.addMark.type}` : ''}`;

    case 'setBlockType':
      return `BLOCK [${op.from}-${op.to}]: set to ${op.blockType}${op.attrs ? ` (${JSON.stringify(op.attrs)})` : ''}`;

    default:
      return JSON.stringify(op);
  }
}
