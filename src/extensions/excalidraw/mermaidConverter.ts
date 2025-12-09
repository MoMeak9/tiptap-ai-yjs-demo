/**
 * Mermaid to Excalidraw Converter
 *
 * Converts Mermaid diagram code to Excalidraw elements.
 * Supports: Flowchart, Sequence, and Class diagrams.
 */
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElement, BinaryFiles } from './types';

export type DiagramType = 'flowchart' | 'sequence' | 'class' | 'unsupported';

export interface MermaidConversionResult {
  success: boolean;
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  diagramType: DiagramType;
  error?: string;
}

/**
 * Detect the type of Mermaid diagram from the code
 */
export function detectDiagramType(mermaidCode: string): DiagramType {
  const trimmed = mermaidCode.trim().toLowerCase();
  const firstLine = trimmed.split('\n')[0].trim();

  // Flowchart detection
  if (
    firstLine.startsWith('graph') ||
    firstLine.startsWith('flowchart') ||
    firstLine.startsWith('subgraph')
  ) {
    return 'flowchart';
  }

  // Sequence diagram detection
  if (firstLine.startsWith('sequencediagram')) {
    return 'sequence';
  }

  // Class diagram detection
  if (firstLine.startsWith('classdiagram')) {
    return 'class';
  }

  // Check for common patterns in case of missing declaration
  if (trimmed.includes('-->') || trimmed.includes('---') || trimmed.includes('==>')) {
    return 'flowchart';
  }

  if (trimmed.includes('->>') || trimmed.includes('-->>') || trimmed.includes('participant')) {
    return 'sequence';
  }

  if (trimmed.includes('class ') || trimmed.includes('<|--') || trimmed.includes('*--')) {
    return 'class';
  }

  return 'unsupported';
}

/**
 * Convert Mermaid code to Excalidraw elements
 */
export async function convertMermaidToExcalidraw(
  mermaidCode: string
): Promise<MermaidConversionResult> {
  // Detect diagram type
  const diagramType = detectDiagramType(mermaidCode);

  if (diagramType === 'unsupported') {
    return {
      success: false,
      elements: [],
      files: {},
      diagramType,
      error: 'Unsupported diagram type. Only Flowchart, Sequence, and Class diagrams are supported.',
    };
  }

  try {
    // Parse mermaid to excalidraw skeleton
    const { elements: skeletonElements, files } = await parseMermaidToExcalidraw(mermaidCode);

    // Convert skeleton to full Excalidraw elements
    const elements = convertToExcalidrawElements(skeletonElements);

    // Validate we got some elements
    if (!elements || elements.length === 0) {
      return {
        success: false,
        elements: [],
        files: files || {},
        diagramType,
        error: 'Conversion produced no elements. The diagram may be empty or invalid.',
      };
    }

    return {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elements: elements as any as ExcalidrawElement[],
      files: files || {},
      diagramType,
    };
  } catch (error) {
    console.error('[MermaidConverter] Conversion failed:', error);

    return {
      success: false,
      elements: [],
      files: {},
      diagramType,
      error: error instanceof Error ? error.message : 'Unknown conversion error',
    };
  }
}

/**
 * Check if mermaid code is valid and can be converted
 */
export async function validateMermaidCode(mermaidCode: string): Promise<{
  valid: boolean;
  diagramType: DiagramType;
  error?: string;
}> {
  const diagramType = detectDiagramType(mermaidCode);

  if (diagramType === 'unsupported') {
    return {
      valid: false,
      diagramType,
      error: 'Unsupported diagram type',
    };
  }

  try {
    // Try to parse without converting to check validity
    await parseMermaidToExcalidraw(mermaidCode);
    return {
      valid: true,
      diagramType,
    };
  } catch (error) {
    return {
      valid: false,
      diagramType,
      error: error instanceof Error ? error.message : 'Invalid mermaid syntax',
    };
  }
}

/**
 * Get friendly name for diagram type
 */
export function getDiagramTypeName(type: DiagramType): string {
  switch (type) {
    case 'flowchart':
      return 'Flowchart';
    case 'sequence':
      return 'Sequence Diagram';
    case 'class':
      return 'Class Diagram';
    default:
      return 'Unknown';
  }
}
