import type {
  AIRewriteResponse,
  DeepSeekRequest,
  DeepSeekResponse,
  YjsOperation,
} from "./types";

/**
 * DeepSeek API Client for AI-powered text rewriting
 */
export class DeepSeekClient {
  private apiKey: string;
  private baseUrl = "https://api.deepseek.com/v1";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("DeepSeek API key is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Rewrite content using DeepSeek AI
   */
  async rewrite(
    content: any,
    instruction: string,
    format: "yjs" | "json" | "html" = "json"
  ): Promise<AIRewriteResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(content, instruction, format);
      const systemPrompt = this.getSystemPrompt(format);

      const requestBody: DeepSeekRequest = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3, // Lower for more deterministic outputs
        max_tokens: 2000,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data: DeepSeekResponse = await response.json();
      const parsedData = this.parseResponse(data, format);

      return {
        success: true,
        data: parsedData,
        meta: {
          model: data.model,
          duration: Date.now() - startTime,
          tokenCount: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      console.error("[DeepSeekClient] Rewrite error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get system prompt based on output format
   */
  private getSystemPrompt(format: string): string {
    if (format === "yjs") {
      return `You are a ProseMirror/Yjs text editor operation generator.

Your task: Analyze the original document and the user's instruction, then generate precise Yjs operations.

## Output Format (JSON):
{
  "operations": [
    {
      "type": "insert" | "delete" | "formatChange" | "setBlockType",

      // For insert:
      "position": number,
      "content": string,
      "marks"?: [{ "type": string }],

      // For delete:
      "position": number,
      "length": number,

      // For formatChange:
      "from": number,
      "to": number,
      "removeMark"?: { "type": string },
      "addMark"?: { "type": string },

      // For setBlockType:
      "from": number,
      "to": number,
      "blockType": string,
      "attrs"?: object,

      "description": string
    }
  ]
}

## Rules:
1. Position starts at 0 (zero-indexed)
2. Preserve ALL formatting information (bold, italic, underline, etc.)
3. Use minimal operations (prefer formatChange over delete+insert for format-only changes)
4. Include clear description for each operation
5. Ensure operations are in correct order
6. Calculate positions accurately (character-level precision)

## Examples:

Input: "Hello World" → "Hello Universe"
Output:
{
  "operations": [
    {"type": "delete", "position": 6, "length": 5, "description": "Delete 'World'"},
    {"type": "insert", "position": 6, "content": "Universe", "description": "Insert 'Universe'"}
  ]
}

Input: Change "World" from bold to italic
Output:
{
  "operations": [
    {
      "type": "formatChange",
      "from": 6,
      "to": 11,
      "removeMark": {"type": "bold"},
      "addMark": {"type": "italic"},
      "description": "Change World from bold to italic"
    }
  ]
}

IMPORTANT: Return ONLY valid JSON, Text Must use Chinese. No explanations or markdown code blocks.`;
    } else if (format === "json") {
      return `You are a writing assistant. Return improved text as Token array in JSON format.

## Output Format:
[
  {
    "text": "word or character",
    "marks": ["bold", "italic"],
    "markAttrs": {
      "link": { "href": "url" }
    }
  }
]

## Rules:
1. Preserve ALL formatting
2. Split by words and spaces
3. Keep marks array sorted
4. Return ONLY valid JSON`;
    }

    // HTML format
    return `You are a writing assistant. Improve the given text and return HTML.

Preserve all formatting (bold, italic, links, etc.) in HTML format.

Example:
Input: "Hello <b>World</b>"
Output: "<p>Hello <i>Universe</i></p>"

Return ONLY HTML, no explanations.`;
  }

  /**
   * Build prompt from content and instruction
   */
  private buildPrompt(
    content: any,
    instruction: string,
    format: string
  ): string {
    const contentStr =
      typeof content === "string" ? content : JSON.stringify(content, null, 2);

    return `Original content:
${contentStr}

Instruction: ${instruction}

Output format: ${format}

Please provide the result in the specified format.`;
  }

  /**
   * Parse DeepSeek response based on format
   */
  private parseResponse(data: DeepSeekResponse, format: string): any {
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from DeepSeek");
    }

    // For JSON formats (yjs, json), parse the response
    if (format === "yjs" || format === "json") {
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;

        const parsed = JSON.parse(jsonStr.trim());

        // Validate yjs format
        if (format === "yjs") {
          if (!parsed.operations || !Array.isArray(parsed.operations)) {
            throw new Error("Invalid yjs format: missing operations array");
          }
          return parsed;
        }

        return parsed;
      } catch (e) {
        console.error("[DeepSeekClient] Parse error:", e);
        console.error("[DeepSeekClient] Raw content:", content);
        throw new Error(`Failed to parse ${format} response: ${e}`);
      }
    }

    // For HTML format, return as-is
    return content;
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      // Simple model list check
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
