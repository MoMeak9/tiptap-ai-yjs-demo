/**
 * Jimeng AI Service - Frontend integration for AI-powered image generation
 *
 * Features:
 * - Context extraction from editor
 * - Two-step workflow: prompt optimization → image generation
 * - API communication with backend
 * - Error handling and user feedback
 */

import type { Editor } from '@tiptap/core';
import { extractContext } from './contextExtractor';
import type { JimengAIOptions, JimengAIResult, JimengPromptResult } from '../types';

const DEFAULT_OPTIONS: Required<JimengAIOptions> = {
  apiUrl: import.meta.env.VITE_AI_API_URL || 'http://localhost:3001',
  timeout: 120000, // 120 seconds (image generation can be slow)
};

/**
 * Jimeng AI Service for text-to-image generation
 */
export class JimengAIService {
  private options: Required<JimengAIOptions>;

  constructor(options: JimengAIOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Step 1: Optimize the selected text into an image generation prompt
   * This calls the API with skipPromptOptimization=false to get the optimized prompt
   */
  async optimizePrompt(
    selectedText: string,
    contextBefore?: string,
    contextAfter?: string
  ): Promise<JimengPromptResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      // Call API to get optimized prompt only (we'll handle generation separately)
      const response = await fetch(`${this.options.apiUrl}/api/ai/jimeng`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText,
          contextBefore,
          contextAfter,
          // Use small size for prompt optimization (won't actually generate image)
          size: { width: 512, height: 512 },
          skipPromptOptimization: false,
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
        return {
          success: false,
          error: result.error || 'Prompt optimization failed',
        };
      }

      return {
        success: true,
        prompt: result.data?.optimizedPrompt || selectedText,
      };
    } catch (error) {
      console.error('[JimengAI] Prompt optimization error:', error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: '提示词优化超时，请重试',
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
   * Step 2: Generate image using the (possibly edited) prompt
   * Uses 16:9 aspect ratio (1280x720)
   */
  async generateImage(
    prompt: string,
    options: { width?: number; height?: number; reqKey?: string } = {}
  ): Promise<JimengAIResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(`${this.options.apiUrl}/api/ai/jimeng`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText: prompt, // Use the prompt directly as selectedText
          size: {
            width: options.width || 1280,  // 16:9 aspect ratio
            height: options.height || 720,
          },
          reqKey: options.reqKey || 'jimeng_high_aes_general_v21_L',
          skipPromptOptimization: true, // Skip optimization since we already have the final prompt
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
        return {
          success: false,
          error: result.error || 'Image generation failed',
          errorCode: result.errorCode,
        };
      }

      return {
        success: true,
        imageUrl: result.data?.imageUrl,
        imageBase64: result.data?.imageBase64,
        optimizedPrompt: result.data?.optimizedPrompt,
        meta: result.meta,
      };
    } catch (error) {
      console.error('[JimengAI] Image generation error:', error);

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
   * One-step generation (for scenarios that don't need prompt editing)
   */
  async generateFromText(
    selectedText: string,
    contextBefore?: string,
    contextAfter?: string
  ): Promise<JimengAIResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(`${this.options.apiUrl}/api/ai/jimeng`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText,
          contextBefore,
          contextAfter,
          size: { width: 1280, height: 720 }, // 16:9
          skipPromptOptimization: false,
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
        return {
          success: false,
          error: result.error || 'Image generation failed',
          errorCode: result.errorCode,
        };
      }

      return {
        success: true,
        imageUrl: result.data?.imageUrl,
        imageBase64: result.data?.imageBase64,
        optimizedPrompt: result.data?.optimizedPrompt,
        meta: result.meta,
      };
    } catch (error) {
      console.error('[JimengAI] Generation error:', error);

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
   * Health check for the API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.options.apiUrl}/api/ai/jimeng/health`);
      const data = await response.json();
      return data.healthy === true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let serviceInstance: JimengAIService | null = null;

/**
 * Get or create the JimengAI service singleton
 */
export function getJimengAIService(options?: JimengAIOptions): JimengAIService {
  if (!serviceInstance) {
    serviceInstance = new JimengAIService(options);
  }
  return serviceInstance;
}

/**
 * Convenience function to extract context and optimize prompt from editor selection
 */
export async function optimizePromptFromSelection(
  editor: Editor
): Promise<JimengPromptResult & { context?: ReturnType<typeof extractContext> }> {
  const context = extractContext(editor, {
    paragraphRadius: 2,
    maxContextLength: 2000,
    expandToSentence: true,
  });

  if (!context) {
    return {
      success: false,
      error: '请先选中要生成图片的文本内容',
    };
  }

  if (!context.selectedText.trim()) {
    return {
      success: false,
      error: '选中的文本内容为空',
    };
  }

  const service = getJimengAIService();
  const result = await service.optimizePrompt(
    context.selectedText,
    context.contextBefore,
    context.contextAfter
  );

  return {
    ...result,
    context,
  };
}

export default JimengAIService;
