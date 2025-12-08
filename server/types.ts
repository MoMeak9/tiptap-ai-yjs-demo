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
