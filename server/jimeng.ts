import crypto from "crypto";
import type {
  JimengTextToImageResponse,
  VolcengineCVProcessRequest,
  VolcengineCVProcessResponse,
} from "./types";

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
  private readonly service = "cv";
  private readonly host = "visual.volcengineapi.com";
  private readonly action = "CVProcess";
  private readonly version = "2022-08-31";

  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    region = "cn-north-1"
  ) {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "Volcengine Access Key ID and Secret Access Key are required"
      );
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
      const reqKey = options.reqKey || "jimeng_high_aes_general_v21_L";

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
        if (response.code === 50400 || response.message?.includes("安全")) {
          return {
            success: false,
            error: "内容安全审核未通过，请修改描述后重试",
            errorCode: "CONTENT_SAFETY",
          };
        }
        throw new Error(
          `Jimeng API error: ${response.code} - ${response.message}`
        );
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
        throw new Error("No image data in response");
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
      console.error("[JimengClient] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Call Volcengine CVProcess API with proper signature
   */
  private async callCVProcess(
    body: VolcengineCVProcessRequest
  ): Promise<VolcengineCVProcessResponse> {
    const method = "POST";
    const uri = "/";
    const queryString = `Action=${this.action}&Version=${this.version}`;
    const bodyString = JSON.stringify(body);

    // Generate timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    // Calculate content hash
    const contentHash = this.sha256(bodyString);

    // Create canonical headers
    const headers: Record<string, string> = {
      host: this.host,
      "content-type": "application/json",
      "x-date": amzDate,
      "x-content-sha256": contentHash,
    };

    // Create signed headers string
    const signedHeaders = Object.keys(headers).sort().join(";");

    // Create canonical headers string
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key}:${headers[key]}\n`)
      .join("");

    // Create canonical request
    const canonicalRequest = [
      method,
      uri,
      queryString,
      canonicalHeaders,
      signedHeaders,
      contentHash,
    ].join("\n");

    // Create string to sign
    const algorithm = "HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/${this.service}/request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join("\n");

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
    const kSigning = this.hmacSha256("request", kService);
    return this.hmacSha256Hex(stringToSign, kSigning);
  }

  /**
   * HMAC-SHA256 helper (returns buffer)
   */
  private hmacSha256(data: string, key: string | Buffer): Buffer {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
  }

  /**
   * HMAC-SHA256 helper (returns hex string)
   */
  private hmacSha256Hex(data: string, key: Buffer): string {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
  }

  /**
   * SHA256 hash helper
   */
  private sha256(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
  }

  /**
   * Health check - verifies API credentials
   */
  async health(): Promise<boolean> {
    try {
      // Send a minimal request to check auth
      // We expect this to fail with invalid prompt, but auth should work
      const testBody: VolcengineCVProcessRequest = {
        req_key: "high_aes",
        prompt: "",
        width: 512,
        height: 512,
      };

      const response = await this.callCVProcess(testBody);
      // If we get any response (even error), auth is working
      return response.code !== undefined;
    } catch (error) {
      // Check if it's an auth error or just invalid request
      const message = error instanceof Error ? error.message : "";
      // Auth errors typically return 401/403
      if (
        message.includes("401") ||
        message.includes("403") ||
        message.includes("Signature")
      ) {
        return false;
      }
      // Other errors might mean auth is OK but request is invalid
      return true;
    }
  }
}

/**
 * System prompt for DeepSeek to optimize prompts for Jimeng AI
 *
 * 设计原则：
 * - 自动识别文本类型，采用差异化策略
 * - 智能利用上下文，根据相关性决定融合程度
 * - 风格智能匹配，根据内容选择最合适的艺术风格
 * - 高忠实度：严格按文本描述生成，不随意添加额外元素
 * - 特殊文本处理：短文本补足、长文本提炼、技术文本概念化
 */
export const JIMENG_PROMPT_SYSTEM = `你是一位专业的AI绘画提示词工程师，专门为即梦AI (Jimeng) 优化文本到图像的提示词。

## 核心任务
分析用户选中的文本及其上下文，生成一个精准、高质量的绘画提示词，使生成的图像能够**忠实反映原文的核心含义**。特别注意优化**中文字符的绘画表现**，确保当画面中需要出现文字时，文字清晰、准确且具有艺术感。

## 第一步：文本类型识别
首先判断选中文本属于以下哪种类型，并采用对应策略：

| 类型 | 特征 | 策略 |
|------|------|------|
| 🎬 场景描述 | 描述具体场景、地点、环境 | 扩展空间细节、光影氛围，保持场景主体 |
| 👤 人物描写 | 描述人物外貌、动作、状态 | 强调人物特征、姿态、表情，补充合理背景 |
| 💭 抽象概念 | 情感、哲理、抽象名词 | 转化为视觉隐喻，用具象场景传达抽象含义 |
| 📊 技术/流程 | 代码、流程、商业术语 | 转为概念图/信息图风格，简洁清晰的视觉化表达 |
| 📝 叙事文本 | 故事片段、事件描述 | 提取关键画面瞬间，定格最具表现力的时刻 |
| 🏷️ 简短词汇 | 单词或极短短语 | 智能扩展，补充合理的场景、光影、氛围 |
| 🔤 文字展示 | 包含标语、招牌、书法等 | 强调文字内容的准确性和清晰度，指定字体风格 |

## 第二步：上下文分析
根据前文和后文判断：
- **高相关性**：上下文提供了重要的角色、场景或情感信息 → 融入画面
- **中等相关性**：上下文提供背景但非核心 → 作为氛围参考
- **低相关性**：上下文与选中内容关联不大 → 专注选中文本本身

## 第三步：风格智能匹配
根据文本内容自动选择最合适的艺术风格：

| 内容特征 | 推荐风格 | 英文标签 |
|---------|---------|---------|
| 现代都市、真实人物、新闻事件 | 写实摄影 | photorealistic, photography, realistic |
| 奇幻、魔法、神话、超现实 | 概念艺术 | concept art, fantasy art, digital painting |
| 可爱、轻松、日常生活 | 插画风格 | illustration, anime style, soft colors |
| 历史、古典、文学作品 | 油画/古典 | oil painting, classical art, Renaissance |
| 科技、未来、赛博朋克 | 科幻风格 | sci-fi, cyberpunk, futuristic, neon |
| 自然、风景、宁静 | 风景画 | landscape, nature photography, serene |
| 商业、流程、技术概念 | 信息图 | infographic style, clean design, minimalist |
| 书法、招牌、文字设计 | 文字艺术 | typography, calligraphy, text design, poster design |

## 第四步：构建提示词
按以下结构组织，确保画面完整且忠实于原文：

\`\`\`
[核心主体：忠实于原文的主要描述对象]，
[文字内容：如有特定文字，明确指定内容(如"写着'文字'")和字体风格]，
[场景环境：合理的背景和空间设定]，
[光影氛围：符合内容情感的光线和色调]，
[风格标签：英文艺术风格词]，
[质量标签：masterpiece, best quality, highly detailed, 8k, clear text]
\`\`\`

## 输出规则
1. **仅输出最终提示词**，不要包含任何解释、分析过程或前缀
2. **使用中英文混合**：描述用中文，风格/质量词用英文
3. **忠实原文**：不要添加原文中没有暗示的元素
4. **文字优化**：如果内容包含具体汉字，请加入 "清晰的文字", "准确的汉字", "Chinese calligraphy" 等描述
5. **长度适中**：50-150字，避免过于冗长
6. **特殊处理**：
   - 文本过短（<5字）→ 基于上下文智能补充场景和细节
   - 文本过长（>200字）→ 提炼核心视觉元素，聚焦最重要的画面
   - 纯技术内容 → 转为简洁的概念图/流程图风格

## 示例

**输入**: "夕阳下，老人独自坐在长椅上"
**输出**: 一位白发老人独自坐在公园长椅上，夕阳的金色余晖洒在身上，远处是模糊的城市轮廓，温暖而略带忧伤的氛围，落叶飘散，cinematic lighting, golden hour, photorealistic, emotional, masterpiece, best quality, highly detailed

**输入**: "时间的流逝"
**输出**: 一个古老的沙漏悬浮在虚空中，金色沙粒缓缓流下，周围漂浮着褪色的照片和枯萎的花瓣，柔和的侧光，时间静止的瞬间，concept art, surrealism, symbolic, ethereal atmosphere, masterpiece, best quality, 8k

**输入**: "写着'福'字的红灯笼"
**输出**: 一个悬挂的传统红灯笼，灯笼面上写着清晰的金色汉字"福"，书法字体，节日气氛浓厚，夜晚街道背景，柔和的红光，clear text, Chinese calligraphy, festive atmosphere, photorealistic, masterpiece, best quality, 8k

**输入**: "用户登录流程"
**输出**: 简洁的用户登录流程概念图，扁平化设计风格，用户图标、输入框、验证步骤以流程线连接，蓝白配色，干净的背景，infographic style, flat design, clean layout, minimalist, professional, UI concept, high quality`;
