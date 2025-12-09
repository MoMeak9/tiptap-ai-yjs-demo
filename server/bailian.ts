import type {
  TextToImageResponse,
  DashScopeTaskResponse,
  DashScopeTextToImageRequest,
} from './types';

/**
 * Alibaba Bailian (DashScope) API Client for text-to-image generation
 *
 * Uses the Tongyi Wanxiang (通义万相) model via DashScope API
 * API Documentation: https://help.aliyun.com/zh/model-studio/text-to-image-v2-api-reference
 */
export class BailianClient {
  private apiKey: string;
  private baseUrl = 'https://dashscope.aliyuncs.com/api/v1';

  // Polling configuration
  private readonly pollInterval = 3000; // 3 seconds
  private readonly maxPollAttempts = 60; // Max 3 minutes wait

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('DashScope API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Generate image from text prompt
   */
  async textToImage(
    prompt: string,
    options: {
      negativePrompt?: string;
      size?: '1024*1024' | '720*1280' | '1280*720';
      n?: number;
      model?: 'wanx2.1-t2i-turbo' | 'wanx2.1-t2i-plus' | 'wanx2.0-t2i-turbo';
    } = {}
  ): Promise<TextToImageResponse> {
    const startTime = Date.now();

    try {
      const model = options.model || 'wanx2.1-t2i-turbo';

      // Step 1: Create the task
      const taskResponse = await this.createTask(prompt, {
        ...options,
        model,
      });

      if (!taskResponse.output?.task_id) {
        throw new Error('Failed to create image generation task');
      }

      const taskId = taskResponse.output.task_id;
      console.log(`[BailianClient] Task created: ${taskId}`);

      // Step 2: Poll for completion
      const result = await this.pollTaskResult(taskId);

      if (result.output.task_status === 'FAILED') {
        throw new Error(
          result.output.message || 'Image generation failed'
        );
      }

      const images = result.output.results || [];

      return {
        success: true,
        data: {
          taskId,
          images: images.map((img) => ({ url: img.url })),
        },
        meta: {
          model,
          duration: Date.now() - startTime,
          imageCount: result.usage?.image_count || images.length,
        },
      };
    } catch (error) {
      console.error('[BailianClient] Text-to-image error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create an async text-to-image task
   */
  private async createTask(
    prompt: string,
    options: {
      negativePrompt?: string;
      size?: string;
      n?: number;
      model: string;
    }
  ): Promise<DashScopeTaskResponse> {
    const requestBody: DashScopeTextToImageRequest = {
      model: options.model,
      input: {
        prompt,
        ...(options.negativePrompt && {
          negative_prompt: options.negativePrompt,
        }),
      },
      parameters: {
        size: options.size || '1024*1024',
        n: options.n || 1,
      },
    };

    const response = await fetch(
      `${this.baseUrl}/services/aigc/text2image/image-synthesis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DashScope API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Poll for task completion
   */
  private async pollTaskResult(
    taskId: string
  ): Promise<DashScopeTaskResponse> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const result = await this.getTaskStatus(taskId);

      console.log(
        `[BailianClient] Task ${taskId} status: ${result.output.task_status} (attempt ${attempt + 1})`
      );

      if (
        result.output.task_status === 'SUCCEEDED' ||
        result.output.task_status === 'FAILED'
      ) {
        return result;
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }

    throw new Error('Task polling timeout - image generation took too long');
  }

  /**
   * Get task status
   */
  private async getTaskStatus(taskId: string): Promise<DashScopeTaskResponse> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DashScope task query error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      // Simple test by checking if we can create a minimal request
      // We don't actually create a task, just verify connectivity
      const response = await fetch(
        `${this.baseUrl}/services/aigc/text2image/image-synthesis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: 'wanx2.1-t2i-turbo',
            input: { prompt: '' }, // Empty prompt will fail but validates auth
            parameters: { size: '1024*1024', n: 1 },
          }),
        }
      );

      // 400 means API is reachable but request is invalid (expected)
      // 401 means auth failed
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
