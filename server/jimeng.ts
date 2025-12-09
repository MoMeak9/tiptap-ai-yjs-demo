import crypto from 'crypto';
import type {
  JimengTextToImageResponse,
  VolcengineCVProcessRequest,
  VolcengineCVProcessResponse,
} from './types';

/**
 * Volcengine Jimeng (即梦AI) Client for text-to-image generation
 *
 * Uses Volcengine's CVProcess API with Signature V4 authentication
 * API Documentation: https://www.volcengine.com/docs/85621
 */
export class JimengClient {
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;

  // API configuration
  private readonly service = 'cv';
  private readonly host = 'visual.volcengineapi.com';
  private readonly action = 'CVProcess';
  private readonly version = '2022-08-31';

  constructor(accessKeyId: string, secretAccessKey: string, region = 'cn-north-1') {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Volcengine Access Key ID and Secret Access Key are required');
    }
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
  }

  /**
   * Generate image from optimized prompt using Jimeng AI
   */
  async generateImage(
    prompt: string,
    options: {
      reqKey?: string;
      width?: number;
      height?: number;
      seed?: number;
      scale?: number;
      ddimSteps?: number;
      returnUrl?: boolean;
    } = {}
  ): Promise<JimengTextToImageResponse> {
    const startTime = Date.now();

    try {
      // 注意: req_key 需要 "jimeng_" 前缀
      // 可选值: jimeng_high_aes_general_v21_L, jimeng_high_aes_general_v20, high_aes 等
      const reqKey = options.reqKey || 'jimeng_high_aes_general_v21_L';

      const requestBody: VolcengineCVProcessRequest = {
        req_key: reqKey,
        prompt,
        seed: options.seed ?? -1,
        scale: options.scale ?? 3.5,
        ddim_steps: options.ddimSteps ?? 25,
        width: options.width ?? 1024,
        height: options.height ?? 1024,
        use_sr: true,
        return_url: options.returnUrl ?? true,
        logo_info: {
          add_logo: false,
        },
      };

      console.log(`[JimengClient] Generating image with req_key: ${reqKey}`);

      const response = await this.callCVProcess(requestBody);

      if (response.code !== 10000) {
        // Check for content safety error
        if (response.code === 50400 || response.message?.includes('安全')) {
          return {
            success: false,
            error: '内容安全审核未通过，请修改描述后重试',
            errorCode: 'CONTENT_SAFETY',
          };
        }
        throw new Error(`Jimeng API error: ${response.code} - ${response.message}`);
      }

      // Extract image data
      let imageUrl: string | undefined;
      let imageBase64: string | undefined;

      if (response.data?.image_urls && response.data.image_urls.length > 0) {
        imageUrl = response.data.image_urls[0];
      } else if (
        response.data?.binary_data_base64 &&
        response.data.binary_data_base64.length > 0
      ) {
        imageBase64 = response.data.binary_data_base64[0];
      }

      if (!imageUrl && !imageBase64) {
        throw new Error('No image data in response');
      }

      return {
        success: true,
        data: {
          imageUrl,
          imageBase64,
          optimizedPrompt: prompt,
        },
        meta: {
          model: reqKey,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error('[JimengClient] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Call Volcengine CVProcess API with proper signature
   */
  private async callCVProcess(
    body: VolcengineCVProcessRequest
  ): Promise<VolcengineCVProcessResponse> {
    const method = 'POST';
    const uri = '/';
    const queryString = `Action=${this.action}&Version=${this.version}`;
    const bodyString = JSON.stringify(body);

    // Generate timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // Calculate content hash
    const contentHash = this.sha256(bodyString);

    // Create canonical headers
    const headers: Record<string, string> = {
      host: this.host,
      'content-type': 'application/json',
      'x-date': amzDate,
      'x-content-sha256': contentHash,
    };

    // Create signed headers string
    const signedHeaders = Object.keys(headers).sort().join(';');

    // Create canonical headers string
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key}:${headers[key]}\n`)
      .join('');

    // Create canonical request
    const canonicalRequest = [
      method,
      uri,
      queryString,
      canonicalHeaders,
      signedHeaders,
      contentHash,
    ].join('\n');

    // Create string to sign
    const algorithm = 'HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/${this.service}/request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    // Calculate signature
    const signature = this.calculateSignature(
      dateStamp,
      this.region,
      this.service,
      stringToSign
    );

    // Create authorization header
    const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Make the request
    const url = `https://${this.host}?${queryString}`;

    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        Authorization: authorization,
      },
      body: bodyString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Volcengine API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Calculate HMAC-SHA256 signature
   */
  private calculateSignature(
    dateStamp: string,
    region: string,
    service: string,
    stringToSign: string
  ): string {
    const kDate = this.hmacSha256(dateStamp, this.secretAccessKey);
    const kRegion = this.hmacSha256(region, kDate);
    const kService = this.hmacSha256(service, kRegion);
    const kSigning = this.hmacSha256('request', kService);
    return this.hmacSha256Hex(stringToSign, kSigning);
  }

  /**
   * HMAC-SHA256 helper (returns buffer)
   */
  private hmacSha256(data: string, key: string | Buffer): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }

  /**
   * HMAC-SHA256 helper (returns hex string)
   */
  private hmacSha256Hex(data: string, key: Buffer): string {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
  }

  /**
   * SHA256 hash helper
   */
  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Health check - verifies API credentials
   */
  async health(): Promise<boolean> {
    try {
      // Send a minimal request to check auth
      // We expect this to fail with invalid prompt, but auth should work
      const testBody: VolcengineCVProcessRequest = {
        req_key: 'high_aes',
        prompt: '',
        width: 512,
        height: 512,
      };

      const response = await this.callCVProcess(testBody);
      // If we get any response (even error), auth is working
      return response.code !== undefined;
    } catch (error) {
      // Check if it's an auth error or just invalid request
      const message = error instanceof Error ? error.message : '';
      // Auth errors typically return 401/403
      if (message.includes('401') || message.includes('403') || message.includes('Signature')) {
        return false;
      }
      // Other errors might mean auth is OK but request is invalid
      return true;
    }
  }
}

/**
 * System prompt for DeepSeek to optimize prompts for Jimeng AI
 */
export const JIMENG_PROMPT_SYSTEM = `你是一个即梦AI (Jimeng) 的绘画提示词专家。
请根据上下文，将用户选中的文字转化为即梦AI专用的绘画提示词。

【要求】
1. **语言**：输出为中文描述 + 英文风格词 (Tag) 的混合模式。
2. **结构**：[主体描述], [环境/光影], [风格修饰词], [画质词]。
3. **示例**：一只赛博朋克的猫，霓虹灯光，雨夜，高细节，8k分辨率，masterpiece, cyberpunk, neon lights.
4. **输出**：仅返回最终提示词字符串，不要包含任何解释或前缀。
5. **风格**：根据文本内容智能选择合适的艺术风格（写实、插画、油画、水彩等）。
6. **质量词**：始终包含高质量相关的修饰词如：高清、精细、专业、masterpiece、best quality、highly detailed。`;
