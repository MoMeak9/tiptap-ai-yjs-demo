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

// ============================================
// Volcengine Jimeng (即梦AI) Text-to-Image API
// ============================================

/**
 * Jimeng text-to-image request payload (from frontend)
 */
export interface JimengTextToImageRequest {
  /** The text to generate image from (will be used as context for prompt optimization) */
  selectedText: string;
  /** Context before selected text (for better prompt generation) */
  contextBefore?: string;
  /** Context after selected text (for better prompt generation) */
  contextAfter?: string;
  /** Image size */
  size?: {
    width: number;
    height: number;
  };
  /** Model version key */
  reqKey?:
    | 'high_aes_general_v21_L'
    | 'high_aes_general_v20'
    | 'high_aes_general_v14'
    | 'general_v2.0_L'
    | 'high_aes'
    | 'jimeng_high_aes_general_v21'
    | string;
  /** Whether to skip prompt optimization */
  skipPromptOptimization?: boolean;
}

/**
 * Jimeng text-to-image response
 */
export interface JimengTextToImageResponse {
  success: boolean;
  data?: {
    /** Generated image URL or base64 data */
    imageUrl?: string;
    imageBase64?: string;
    /** The optimized prompt used for generation */
    optimizedPrompt?: string;
  };
  meta?: {
    model: string;
    duration: number;
    promptOptimizationDuration?: number;
  };
  error?: string;
  /** Error code for content safety filtering */
  errorCode?: string;
}

/**
 * Volcengine CVProcess request body for Jimeng
 */
export interface VolcengineCVProcessRequest {
  req_key: string;
  prompt: string;
  model_version?: string;
  seed?: number;
  scale?: number;
  ddim_steps?: number;
  width?: number;
  height?: number;
  use_sr?: boolean;
  return_url?: boolean;
  logo_info?: {
    add_logo: boolean;
    position?: number;
    language?: number;
    opacity?: number;
  };
}

/**
 * Volcengine CVProcess response
 */
export interface VolcengineCVProcessResponse {
  code: number;
  message: string;
  request_id: string;
  time_elapsed: string;
  data?: {
    /** Base64 encoded image data */
    binary_data_base64?: string[];
    /** Image URLs (if return_url is true) */
    image_urls?: string[];
    /** Algorithm base response */
    algorithm_base_resp?: {
      status_code: number;
      status_message: string;
    };
  };
}

// ============================================
// Mermaid AI Generation API
// ============================================

/**
 * Mermaid generation request payload (from frontend)
 */
export interface MermaidGenerateRequest {
  /** The selected text to generate diagram from */
  selectedText: string;
  /** Context before selected text (surrounding paragraphs) */
  contextBefore?: string;
  /** Context after selected text (surrounding paragraphs) */
  contextAfter?: string;
  /** Document outline/headings for structural context */
  documentOutline?: string[];
  /** Optional user instruction to guide diagram generation */
  userInstruction?: string;
}

/**
 * Mermaid generation response
 */
export interface MermaidGenerateResponse {
  success: boolean;
  data?: {
    /** Generated Mermaid code */
    mermaidCode: string;
    /** Detected diagram type */
    diagramType: string;
    /** Generated title for the diagram */
    title: string;
    /** AI analysis of the content */
    analysis: string;
    /** Whether the code was repaired */
    wasRepaired: boolean;
    /** Number of repair attempts */
    repairAttempts: number;
  };
  meta?: {
    model: string;
    duration: number;
  };
  error?: string;
}
