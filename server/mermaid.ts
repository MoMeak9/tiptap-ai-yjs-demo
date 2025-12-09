/**
 * Mermaid AI Generator - Server-side Mermaid code generation using LLM
 *
 * Features:
 * - Context-aware diagram generation
 * - Automatic diagram type detection
 * - Syntax validation and auto-repair
 * - Chain-of-Thought prompting for accurate results
 */

import type {
  MermaidGenerateRequest,
  MermaidGenerateResponse,
  DeepSeekResponse,
} from './types';

// System prompt with Chain-of-Thought strategy
const MERMAID_SYSTEM_PROMPT = `You are a Senior System Architect and Mermaid.js Expert.

## Objective
Translate the provided technical text into a valid Mermaid.js diagram.

## Process (Must Follow)
1. **Analysis Phase**: Identify all Entities (Actors, Systems, Classes, States, Steps) and Relationships (Data flows, Dependencies, Transitions) in the text. Explicitly list them.
2. **Logic Mapping**: Determine the most appropriate diagram type. Choose from:
   - flowchart: For processes, workflows, decision trees
   - sequence: For interactions between systems/actors over time
   - classDiagram: For object structures and relationships
   - stateDiagram-v2: For state machines and transitions
   - erDiagram: For database entity relationships
   - gantt: For project timelines and schedules
   - pie: For proportional data
   - mindmap: For hierarchical concepts
3. **Code Generation**: Output the Mermaid code.

## Syntax Constraints (CRITICAL)
- Node IDs must contain ONLY alphanumeric characters and underscores (e.g., \`Node_A\`, not \`Node A\`)
- Use labels for display text: \`Node_A["Node A with spaces"]\`
- Always specify diagram direction for flowcharts: \`graph TD\` (top-down) or \`graph LR\` (left-right)
- Escape special characters in labels with quotes
- For Chinese text, always wrap in quotes: \`A["中文标签"]\`
- Use proper arrow syntax:
  - flowchart: \`-->\`, \`---\`, \`-.->)\`, \`==>\`
  - sequence: \`->>\`, \`-->>\`, \`-x\`, \`--x\`
- Avoid reserved keywords as node IDs: end, graph, subgraph, etc.

## Output Format (JSON)
{
  "analysis": "Brief analysis of entities and relationships found",
  "diagram_type": "flowchart|sequence|classDiagram|stateDiagram-v2|erDiagram|gantt|pie|mindmap",
  "mermaid_code": "The pure Mermaid.js code without markdown backticks",
  "title": "A concise title for the diagram"
}

## Examples

### Example 1: Process Flow
Input: "用户登录流程：用户输入账号密码，系统验证，成功则跳转首页，失败则提示错误"
Output:
{
  "analysis": "Entities: 用户, 系统, 首页. Relationships: 输入->验证->成功/失败分支",
  "diagram_type": "flowchart",
  "mermaid_code": "graph TD\\n    A[\\"用户输入账号密码\\"] --> B{\\"系统验证\\"}\\n    B -->|成功| C[\\"跳转首页\\"]\\n    B -->|失败| D[\\"提示错误\\"]",
  "title": "用户登录流程"
}

### Example 2: Sequence Diagram
Input: "客户端发送请求到服务器，服务器查询数据库，返回结果给客户端"
Output:
{
  "analysis": "Actors: 客户端, 服务器, 数据库. Interactions: 请求->查询->返回",
  "diagram_type": "sequence",
  "mermaid_code": "sequenceDiagram\\n    participant C as 客户端\\n    participant S as 服务器\\n    participant D as 数据库\\n    C->>S: 发送请求\\n    S->>D: 查询数据\\n    D-->>S: 返回数据\\n    S-->>C: 返回结果",
  "title": "客户端-服务器交互流程"
}

## Rules
- Do NOT invent steps not present in the text
- You MAY infer logical connections implied by context
- Return ONLY valid JSON, no markdown code blocks
- All text labels should preserve the original language (Chinese/English)`;

// Repair prompt for fixing syntax errors
const MERMAID_REPAIR_PROMPT = `You are a Mermaid.js syntax expert. The following Mermaid code failed to render.

## Your Task
1. Analyze the error message
2. Fix the syntax issues
3. Return corrected code

## Common Fixes
- Wrap labels with spaces/special chars in quotes: \`A["Label with space"]\`
- Replace reserved words as IDs (end, graph, etc.)
- Fix arrow syntax based on diagram type
- Ensure proper escaping of special characters
- For Chinese text, always use quoted labels

## Output Format (JSON)
{
  "fixed_code": "The corrected Mermaid.js code",
  "fixes_applied": ["List of fixes made"]
}

Return ONLY valid JSON.`;

export class MermaidGenerator {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('DeepSeek API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Generate Mermaid diagram from context
   */
  async generate(request: MermaidGenerateRequest): Promise<MermaidGenerateResponse> {
    const startTime = Date.now();

    try {
      // Build the user prompt with context
      const userPrompt = this.buildPrompt(request);

      // Call DeepSeek API
      const response = await this.callDeepSeek(MERMAID_SYSTEM_PROMPT, userPrompt);

      // Parse the response
      const parsed = this.parseResponse(response);

      // Validate and potentially repair the code
      const validated = await this.validateAndRepair(parsed.mermaid_code);

      return {
        success: true,
        data: {
          mermaidCode: validated.code,
          diagramType: parsed.diagram_type,
          title: parsed.title,
          analysis: parsed.analysis,
          wasRepaired: validated.wasRepaired,
          repairAttempts: validated.attempts,
        },
        meta: {
          model: 'deepseek-chat',
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error('[MermaidGenerator] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          model: 'deepseek-chat',
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Build user prompt with context information
   */
  private buildPrompt(request: MermaidGenerateRequest): string {
    const parts: string[] = [];

    // Document structure context
    if (request.documentOutline && request.documentOutline.length > 0) {
      parts.push(`## Document Structure\n${request.documentOutline.join('\n')}`);
    }

    // Surrounding context
    if (request.contextBefore) {
      parts.push(`## Context Before\n${request.contextBefore}`);
    }

    // Main selected text (most important)
    parts.push(`## Selected Text (Generate diagram for this)\n${request.selectedText}`);

    // Context after
    if (request.contextAfter) {
      parts.push(`## Context After\n${request.contextAfter}`);
    }

    // User instruction if provided
    if (request.userInstruction) {
      parts.push(`## Additional Instruction\n${request.userInstruction}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Call DeepSeek API
   */
  private async callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data: DeepSeekResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from DeepSeek');
    }

    return content;
  }

  /**
   * Parse the JSON response from DeepSeek
   */
  private parseResponse(content: string): {
    analysis: string;
    diagram_type: string;
    mermaid_code: string;
    title: string;
  } {
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;

      const parsed = JSON.parse(jsonStr.trim());

      if (!parsed.mermaid_code) {
        throw new Error('Missing mermaid_code in response');
      }

      return {
        analysis: parsed.analysis || '',
        diagram_type: parsed.diagram_type || 'flowchart',
        mermaid_code: parsed.mermaid_code,
        title: parsed.title || 'Diagram',
      };
    } catch (e) {
      console.error('[MermaidGenerator] Parse error:', e);
      console.error('[MermaidGenerator] Raw content:', content);
      throw new Error(`Failed to parse AI response: ${e}`);
    }
  }

  /**
   * Validate Mermaid code and repair if needed
   * Uses mermaid.parse() logic simulation + retry mechanism
   */
  private async validateAndRepair(
    code: string,
    maxAttempts = 2
  ): Promise<{ code: string; wasRepaired: boolean; attempts: number }> {
    let currentCode = code;
    let attempts = 0;

    // Basic syntax validation patterns
    const validationErrors = this.basicValidation(currentCode);

    if (validationErrors.length === 0) {
      return { code: currentCode, wasRepaired: false, attempts: 0 };
    }

    // Try to repair
    while (attempts < maxAttempts && validationErrors.length > 0) {
      attempts++;
      console.log(`[MermaidGenerator] Repair attempt ${attempts}/${maxAttempts}`);

      try {
        const repairPrompt = `## Original Code\n\`\`\`\n${currentCode}\n\`\`\`\n\n## Errors Found\n${validationErrors.join('\n')}\n\nPlease fix the code.`;

        const repairResponse = await this.callDeepSeek(MERMAID_REPAIR_PROMPT, repairPrompt);
        const repairParsed = JSON.parse(
          repairResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] || repairResponse
        );

        if (repairParsed.fixed_code) {
          currentCode = repairParsed.fixed_code;
          console.log(`[MermaidGenerator] Fixes applied:`, repairParsed.fixes_applied);

          // Re-validate
          const newErrors = this.basicValidation(currentCode);
          if (newErrors.length === 0) {
            return { code: currentCode, wasRepaired: true, attempts };
          }
          validationErrors.length = 0;
          validationErrors.push(...newErrors);
        }
      } catch (repairError) {
        console.warn('[MermaidGenerator] Repair failed:', repairError);
      }
    }

    // Return best effort code
    return { code: currentCode, wasRepaired: attempts > 0, attempts };
  }

  /**
   * Basic validation to catch common Mermaid syntax errors
   */
  private basicValidation(code: string): string[] {
    const errors: string[] = [];

    // Check for unquoted labels with spaces (common error)
    const unquotedLabelPattern = /\[([^\]"]+\s+[^\]"]+)\]/g;
    let match;
    while ((match = unquotedLabelPattern.exec(code)) !== null) {
      // Skip if it's actually quoted
      if (!match[0].includes('"')) {
        errors.push(`Unquoted label with spaces: ${match[1]}`);
      }
    }

    // Check for reserved words as IDs
    const reservedWords = ['end', 'graph', 'subgraph', 'direction', 'click', 'style', 'classDef'];
    const lines = code.split('\n');
    for (const line of lines) {
      for (const word of reservedWords) {
        // Check if reserved word is used as a node ID (not as keyword)
        const pattern = new RegExp(`^\\s*${word}\\s*[\\[\\(\\{]|-->\\s*${word}\\s*[\\[\\(\\{]`, 'i');
        if (pattern.test(line)) {
          errors.push(`Reserved word '${word}' used as node ID in: ${line.trim()}`);
        }
      }
    }

    // Check for missing diagram type declaration
    const firstLine = code.trim().split('\n')[0].toLowerCase();
    const validStarts = [
      'graph',
      'flowchart',
      'sequencediagram',
      'classdiagram',
      'statediagram',
      'erdiagram',
      'gantt',
      'pie',
      'mindmap',
    ];
    if (!validStarts.some((start) => firstLine.startsWith(start))) {
      errors.push('Missing or invalid diagram type declaration');
    }

    return errors;
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
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

export default MermaidGenerator;
