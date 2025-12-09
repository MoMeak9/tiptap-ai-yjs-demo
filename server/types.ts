/**
 * Server-side type definitions for AI proxy
 */

/**
 * Yjs Operation types
 */
export interface YjsOperation {
  type: 'insert' | 'delete' | 'formatChange' | 'setBlockType';

  // For insert operations
  position?: number;
  content?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;

  // For delete operations
  length?: number;

  // For formatChange operations
  from?: number;
  to?: number;
  removeMark?: { type: string; attrs?: Record<string, any> };
  addMark?: { type: string; attrs?: Record<string, any> };

  // For setBlockType operations
  blockType?: string;
  attrs?: Record<string, any>;

  // Optional description
  description?: string;
}

/**
 * AI rewrite request payload
 */
export interface AIRewriteRequest {
  content: any;
  instruction: string;
  format: 'yjs' | 'json' | 'html';
}

/**
 * AI rewrite response
 */
export interface AIRewriteResponse {
  success: boolean;
  data?: {
    operations?: YjsOperation[];
    html?: string;
    tokens?: any[];
  };
  meta?: {
    model: string;
    duration: number;
    tokenCount: number;
  };
  error?: string;
}

/**
 * DeepSeek API chat message
 */
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * DeepSeek API request
 */
export interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * DeepSeek API response
 */
export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// Alibaba Bailian (DashScope) Text-to-Image API
// ============================================

/**
 * Text-to-image request payload
 */
export interface TextToImageRequest {
  prompt: string;
  negativePrompt?: string;
  size?: '1024*1024' | '720*1280' | '1280*720';
  n?: number;
  model?: 'wanx2.1-t2i-turbo' | 'wanx2.1-t2i-plus' | 'wanx2.0-t2i-turbo';
}

/**
 * Text-to-image response
 */
export interface TextToImageResponse {
  success: boolean;
  data?: {
    taskId: string;
    images: Array<{
      url: string;
    }>;
  };
  meta?: {
    model: string;
    duration: number;
    imageCount: number;
  };
  error?: string;
}

/**
 * DashScope task creation response
 */
export interface DashScopeTaskResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    results?: Array<{
      url: string;
    }>;
    task_metrics?: {
      TOTAL: number;
      SUCCEEDED: number;
      FAILED: number;
    };
    message?: string;
    code?: string;
  };
  usage?: {
    image_count: number;
  };
}

/**
 * DashScope text-to-image request body
 */
export interface DashScopeTextToImageRequest {
  model: string;
  input: {
    prompt: string;
    negative_prompt?: string;
  };
  parameters?: {
    size?: string;
    n?: number;
    seed?: number;
  };
}
