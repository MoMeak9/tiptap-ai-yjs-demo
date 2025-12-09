/**
 * Context Extractor - Extract surrounding context from Tiptap editor
 *
 * Based on the document's architecture, implements:
 * - ResolvedPos-based hierarchy traversal
 * - Sentence boundary detection via Intl.Segmenter
 * - Sibling paragraph aggregation
 * - Document outline extraction
 */

import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Type for Intl.Segmenter (not yet fully supported in TS lib)
interface SegmenterSegment {
  segment: string;
  index: number;
  input: string;
}

declare namespace Intl {
  class Segmenter {
    constructor(locale?: string, options?: { granularity?: 'grapheme' | 'word' | 'sentence' });
    segment(input: string): Iterable<SegmenterSegment>;
  }
}

export interface ExtractedContext {
  /** The selected text (core focus) */
  selectedText: string;
  /** Text content before selection (surrounding paragraphs) */
  contextBefore: string;
  /** Text content after selection (surrounding paragraphs) */
  contextAfter: string;
  /** Document outline/headings for structural context */
  documentOutline: string[];
  /** Selection positions */
  selection: {
    from: number;
    to: number;
  };
}

export interface ContextExtractorOptions {
  /** Number of paragraphs to include before/after selection */
  paragraphRadius?: number;
  /** Maximum characters for context (to avoid exceeding LLM context window) */
  maxContextLength?: number;
  /** Whether to expand selection to sentence boundaries */
  expandToSentence?: boolean;
  /** Locale for sentence segmentation */
  locale?: string;
}

const DEFAULT_OPTIONS: Required<ContextExtractorOptions> = {
  paragraphRadius: 2,
  maxContextLength: 2000,
  expandToSentence: true,
  locale: 'zh-CN',
};

/**
 * Extract context from Tiptap editor around the current selection
 */
export class ContextExtractor {
  private editor: Editor;
  private options: Required<ContextExtractorOptions>;

  constructor(editor: Editor, options: ContextExtractorOptions = {}) {
    this.editor = editor;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract context around current selection
   */
  extract(): ExtractedContext | null {
    const { state } = this.editor;
    const { selection, doc } = state;
    const { from, to } = selection;

    // Check if there's a selection
    if (from === to) {
      return null;
    }

    // Get selected text
    let selectedText = doc.textBetween(from, to, '\n');

    // Optionally expand to sentence boundaries
    if (this.options.expandToSentence) {
      const expanded = this.expandToSentenceBoundary(doc, from, to);
      if (expanded) {
        selectedText = expanded.text;
      }
    }

    // Get surrounding paragraphs
    const { before, after } = this.getSurroundingParagraphs(doc, from, to);

    // Get document outline
    const documentOutline = this.extractDocumentOutline(doc);

    return {
      selectedText,
      contextBefore: this.truncateText(before, this.options.maxContextLength / 2),
      contextAfter: this.truncateText(after, this.options.maxContextLength / 2),
      documentOutline,
      selection: { from, to },
    };
  }

  /**
   * Expand selection to sentence boundaries using Intl.Segmenter
   */
  private expandToSentenceBoundary(
    doc: ProseMirrorNode,
    from: number,
    to: number
  ): { text: string; from: number; to: number } | null {
    // Check if Intl.Segmenter is available
    if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) {
      console.warn('[ContextExtractor] Intl.Segmenter not available');
      return null;
    }

    try {
      // Get the paragraph containing the selection
      const $from = doc.resolve(from);

      // Get the parent paragraph node
      const parentNode = $from.parent;
      if (!parentNode.isTextblock) {
        return null;
      }

      // Get full paragraph text and selection offset within it
      const paragraphStart = $from.start();
      const paragraphText = parentNode.textContent;
      const selectionStartInParagraph = from - paragraphStart;
      const selectionEndInParagraph = to - paragraphStart;

      // Create sentence segmenter
      const segmenter = new Intl.Segmenter(this.options.locale, {
        granularity: 'sentence',
      });

      // Find sentence boundaries
      const segments = Array.from(segmenter.segment(paragraphText));

      let sentenceStart = 0;
      let sentenceEnd = paragraphText.length;

      for (const segment of segments) {
        const segStart = segment.index;
        const segEnd = segStart + segment.segment.length;

        // Find the sentence containing selection start
        if (segStart <= selectionStartInParagraph && selectionStartInParagraph < segEnd) {
          sentenceStart = segStart;
        }

        // Find the sentence containing selection end
        if (segStart <= selectionEndInParagraph && selectionEndInParagraph <= segEnd) {
          sentenceEnd = segEnd;
          break;
        }
      }

      const expandedText = paragraphText.slice(sentenceStart, sentenceEnd).trim();

      return {
        text: expandedText,
        from: paragraphStart + sentenceStart,
        to: paragraphStart + sentenceEnd,
      };
    } catch (e) {
      console.warn('[ContextExtractor] Sentence expansion failed:', e);
      return null;
    }
  }

  /**
   * Get surrounding paragraphs based on configured radius
   */
  private getSurroundingParagraphs(
    doc: ProseMirrorNode,
    from: number,
    _to: number
  ): { before: string; after: string } {
    const $from = doc.resolve(from);

    const beforeParagraphs: string[] = [];
    const afterParagraphs: string[] = [];

    // Get the depth of the paragraph/block level
    const depth = $from.depth;

    // Find the parent that contains block-level children
    let blockParent = $from.node(Math.max(0, depth - 1));

    // If we're at the top level, use the doc
    if (depth === 0) {
      blockParent = doc;
    }

    // Get current block index
    const currentBlockIndex = $from.index(Math.max(0, depth - 1));

    // Collect paragraphs before
    for (
      let i = Math.max(0, currentBlockIndex - this.options.paragraphRadius);
      i < currentBlockIndex;
      i++
    ) {
      const node = blockParent.child(i);
      if (node.isTextblock || node.type.name === 'paragraph') {
        const text = this.getNodeText(node);
        if (text.trim()) {
          beforeParagraphs.push(text);
        }
      }
    }

    // Collect paragraphs after
    const childCount = blockParent.childCount;
    for (
      let i = currentBlockIndex + 1;
      i <= Math.min(childCount - 1, currentBlockIndex + this.options.paragraphRadius);
      i++
    ) {
      const node = blockParent.child(i);
      if (node.isTextblock || node.type.name === 'paragraph') {
        const text = this.getNodeText(node);
        if (text.trim()) {
          afterParagraphs.push(text);
        }
      }
    }

    return {
      before: beforeParagraphs.join('\n\n'),
      after: afterParagraphs.join('\n\n'),
    };
  }

  /**
   * Extract document outline (headings)
   */
  private extractDocumentOutline(doc: ProseMirrorNode): string[] {
    const outline: string[] = [];

    doc.descendants((node) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level as number;
        const text = node.textContent;
        if (text.trim()) {
          outline.push(`${'#'.repeat(level)} ${text}`);
        }
      }
      return true; // Continue traversing
    });

    return outline;
  }

  /**
   * Get text content from a node
   */
  private getNodeText(node: ProseMirrorNode): string {
    return node.textContent;
  }

  /**
   * Truncate text to max length, preferring to cut at sentence boundaries
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to cut at a sentence boundary
    const truncated = text.slice(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('？'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('\n')
    );

    if (lastSentenceEnd > maxLength * 0.5) {
      return truncated.slice(0, lastSentenceEnd + 1);
    }

    return truncated + '...';
  }
}

/**
 * Convenience function to extract context from editor
 */
export function extractContext(
  editor: Editor,
  options?: ContextExtractorOptions
): ExtractedContext | null {
  const extractor = new ContextExtractor(editor, options);
  return extractor.extract();
}

export default ContextExtractor;
