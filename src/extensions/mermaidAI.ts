/**
 * Mermaid AI Service - Frontend integration for AI-powered diagram generation
 *
 * Features:
 * - Context extraction from editor
 * - API communication with backend
 * - Client-side validation with Mermaid parser
 * - Error handling and user feedback
 */

import type { Editor } from '@tiptap/core';
import mermaid from 'mermaid';
import { extractContext, type ExtractedContext } from './contextExtractor';

export interface MermaidAIResult {
  success: boolean;
  mermaidCode?: string;
  diagramType?: string;
  title?: string;
  analysis?: string;
  wasRepaired?: boolean;
  error?: string;
}

export interface MermaidAIOptions {
  /** API base URL */
  apiUrl?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to validate code client-side before returning */
  validateClientSide?: boolean;
}

const DEFAULT_OPTIONS: Required<MermaidAIOptions> = {
  apiUrl: import.meta.env.VITE_AI_API_URL || 'http://localhost:3001',
  timeout: 60000, // 60 seconds
  validateClientSide: true,
};

/**
 * Generate Mermaid diagram from editor selection using AI
 */
export class MermaidAIService {
  private options: Required<MermaidAIOptions>;

  constructor(options: MermaidAIOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate Mermaid diagram from current editor selection
   */
  async generateFromSelection(editor: Editor): Promise<MermaidAIResult> {
    // Extract context from editor
    const context = extractContext(editor, {
      paragraphRadius: 2,
      maxContextLength: 2000,
      expandToSentence: true,
    });

    if (!context) {
      return {
        success: false,
        error: '请先选中要生成图表的文本内容',
      };
    }

    if (!context.selectedText.trim()) {
      return {
        success: false,
        error: '选中的文本内容为空',
      };
    }

    return this.generate(context);
  }

  /**
   * Generate Mermaid diagram from extracted context
   */
  async generate(context: ExtractedContext): Promise<MermaidAIResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(`${this.options.apiUrl}/api/ai/mermaid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText: context.selectedText,
          contextBefore: context.contextBefore,
          contextAfter: context.contextAfter,
          documentOutline: context.documentOutline,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'AI generation failed');
      }

      const { mermaidCode, diagramType, title, analysis, wasRepaired } = result.data;

      // Validate client-side if enabled
      if (this.options.validateClientSide) {
        const validationResult = await this.validateMermaidCode(mermaidCode);
        if (!validationResult.valid) {
          console.warn('[MermaidAI] Client-side validation failed:', validationResult.error);
          // Still return the code, but note the validation failure
          return {
            success: true,
            mermaidCode,
            diagramType,
            title,
            analysis,
            wasRepaired,
            error: `警告: 代码可能有语法问题 - ${validationResult.error}`,
          };
        }
      }

      return {
        success: true,
        mermaidCode,
        diagramType,
        title,
        analysis,
        wasRepaired,
      };
    } catch (error) {
      console.error('[MermaidAI] Generation error:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'AI 生成超时，请重试',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: '未知错误',
      };
    }
  }

  /**
   * Validate Mermaid code using the mermaid parser
   */
  async validateMermaidCode(code: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Use mermaid.parse for validation
      await mermaid.parse(code);
      return { valid: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { valid: false, error };
    }
  }

  /**
   * Health check for the API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.options.apiUrl}/api/ai/mermaid/health`);
      const data = await response.json();
      return data.healthy === true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let serviceInstance: MermaidAIService | null = null;

/**
 * Get or create the MermaidAI service singleton
 */
export function getMermaidAIService(options?: MermaidAIOptions): MermaidAIService {
  if (!serviceInstance) {
    serviceInstance = new MermaidAIService(options);
  }
  return serviceInstance;
}

/**
 * Convenience function to generate Mermaid from selection
 */
export async function generateMermaidFromSelection(editor: Editor): Promise<MermaidAIResult> {
  const service = getMermaidAIService();
  return service.generateFromSelection(editor);
}

export default MermaidAIService;
