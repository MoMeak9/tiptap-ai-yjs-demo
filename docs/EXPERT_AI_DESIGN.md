# 专家级 AI Suggestion 系统 - 技术设计文档

**版本**: 1.0
**日期**: 2025-12-08
**作者**: SuperClaude Framework
**状态**: 设计阶段

---

## 📋 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [核心组件设计](#核心组件设计)
4. [数据结构](#数据结构)
5. [API 设计](#api-设计)
6. [Phase 1 PoC 计划](#phase-1-poc-计划)
7. [实施路线图](#实施路线图)
8. [性能优化](#性能优化)
9. [风险评估](#风险评估)

---

## 项目概述

### 背景

当前实现 ([src/extensions/suggestion.ts](../src/extensions/suggestion.ts)) 使用**字符串级别的 Diff**：

```typescript
const originalText = editor.state.doc.textBetween(from, to);
const diffs = dmp.diff_main(originalText, aiText);
```

**核心问题**: 丢失格式信息
- ❌ "Hello **World**" → "Hello Universe" 会丢失 `bold` 标记
- ❌ 无法检测格式变更（如 `bold` → `italic`）
- ❌ 块级结构（heading, list）无法正确 diff

### 目标

构建**专家级 Token-based Diff 系统**，实现：

- ✅ **格式感知**: 保留所有内联样式和块级结构
- ✅ **精细粒度**: 词级 Token 化，平衡精度和性能
- ✅ **生产级质量**: 类似 Google Docs/Word 的体验
- ✅ **精细撤销**: 每个 Accept/Reject 操作可独立撤销
- ✅ **冲突处理**: 智能合并多用户编辑冲突

### 核心价值

| 维度 | 当前实现 | 专家方案 |
|------|----------|----------|
| **Diff 层级** | 字符串 | Token (带格式) |
| **格式保留** | ❌ 丢失 | ✅ 完整保留 |
| **块级支持** | ❌ 无 | ✅ heading/list/quote |
| **撤销粒度** | 组级 | 操作级 |
| **冲突处理** | 简单失效 | 智能合并 |

---

## 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Tiptap Editor                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Suggestion Extension (升级版)                        │  │
│  │  - applyAISuggestionStructured()                      │  │
│  │  - acceptSuggestion() [精细撤销]                      │  │
│  │  - rejectSuggestion()                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓ ↑                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SuggestionManager (升级版)                           │  │
│  │  - 冲突检测和解决                                      │  │
│  │  - 精细撤销历史                                        │  │
│  │  - 位置优先排序                                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    AI Integration Layer                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TokenCodec                                            │  │
│  │  - nodeToTokens(): ProseMirror → Token[]             │  │
│  │  - encode(): Token[] → Unicode String                 │  │
│  │  - decode(): Unicode String → Token[]                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  StructuredDiff                                        │  │
│  │  - computeStructuredDiff(): Token Diff               │  │
│  │  - buildDiffResult(): DiffOperation[]                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  AIClient (Frontend)                                   │  │
│  │  - rewrite(content, instruction)                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑ HTTP
┌─────────────────────────────────────────────────────────────┐
│                   Express.js Server                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  POST /api/ai/rewrite                                  │  │
│  │  - 接收: { content, instruction, format }             │  │
│  │  - 返回: { success, data, meta }                      │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  DeepSeekClient                                        │  │
│  │  - 调用 DeepSeek API                                   │  │
│  │  - 解析响应                                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    DeepSeek API                             │
│            https://api.deepseek.com/v1                      │
└─────────────────────────────────────────────────────────────┘
```

### 数据流程

```
用户选中文本 "Hello <b>World</b>"
      ↓
1. Token 化
   → [
       { text: "Hello", marks: [] },
       { text: " ", marks: [] },
       { text: "World", marks: ["bold"] }
     ]
      ↓
2. 编码 (用于 Diff)
   → "Hello" → U+E000
   → " " → U+E001
   → "World"(bold) → U+E002
   → 编码结果: "\uE000\uE001\uE002"
      ↓
3. 调用 AI
   → POST /api/ai/rewrite
   → DeepSeek 返回改写后的内容
      ↓
4. AI 响应 Token 化
   → [
       { text: "Hello", marks: [] },
       { text: " ", marks: [] },
       { text: "Universe", marks: ["italic"] }
     ]
      ↓
5. Token 级 Diff
   → EQUAL: "Hello" + " "
   → DELETE: "World"(bold)
   → INSERT: "Universe"(italic)
      ↓
6. 应用 Suggestion Mark
   → "Hello " (保持)
   → "<span class='suggestion-delete'>World</span>"
   → "<span class='suggestion-add'>Universe</span>"
      ↓
7. 用户审阅
   → Accept/Reject 每个 Suggestion
      ↓
8. 精细撤销记录
   → 每个操作都加入历史栈
   → Ctrl+Z 可撤销到任意步骤
```

---

## 核心组件设计

### 1. TokenCodec (Token 编解码器)

**文件**: `src/ai/tokenCodec.ts`

#### 职责

- ProseMirror Node → Token 数组
- Token 数组 → Unicode 编码字符串（用于 diff-match-patch）
- Unicode 字符串 → Token 数组

#### 核心接口

```typescript
class TokenCodec {
  /**
   * 编码 Token 数组为字符串
   * 将每个唯一的 Token 映射为私有区 Unicode 字符 (U+E000 - U+F8FF)
   */
  encode(tokens: DocToken[]): string;

  /**
   * 解码字符串为 Token 数组
   */
  decode(encoded: string): DocToken[];

  /**
   * 获取 Token 的唯一字符
   * 使用内部映射表维护 Token ↔ Char 关系
   */
  private getCharForToken(token: DocToken): string;

  /**
   * 序列化 Token 为唯一键
   * 用于映射表的键
   */
  private serializeToken(token: DocToken): string;
}
```

#### 实现细节

**Token 化规则**:

```typescript
function nodeToTokens(node: ProseMirrorNode, from: number = 0): DocToken[] {
  const tokens: DocToken[] = [];
  let currentPos = from;

  // 1. 块级节点边界标记
  if (node.isBlock) {
    tokens.push({
      text: '\u200B', // 零宽空格
      marks: [],
      nodeType: node.type.name,
      nodeAttrs: node.attrs,
      from: currentPos,
      to: currentPos
    });
  }

  // 2. 遍历子节点
  node.content.forEach((child) => {
    if (child.isText) {
      // 词级分词
      const words = tokenizeText(child.text!);
      const marks = child.marks.map(m => m.type.name).sort();
      const markAttrs = extractMarkAttrs(child.marks);

      words.forEach(word => {
        tokens.push({
          text: word,
          marks,
          markAttrs,
          from: currentPos,
          to: currentPos + word.length
        });
        currentPos += word.length;
      });
    } else {
      // 递归处理
      const childTokens = nodeToTokens(child, currentPos);
      tokens.push(...childTokens);
      currentPos += child.nodeSize;
    }
  });

  return tokens;
}

/**
 * 词级分词
 * 匹配: 单词 | 空格 | 标点
 */
function tokenizeText(text: string): string[] {
  return text.match(/\w+|[\s\p{P}]/gu) || [];
}
```

**编码策略**:

```typescript
class TokenCodec {
  private tokenToChar = new Map<string, string>();
  private charToToken = new Map<string, DocToken>();
  private nextCharCode = 0xE000; // 私有区起始

  encode(tokens: DocToken[]): string {
    return tokens.map(token => this.getCharForToken(token)).join('');
  }

  private getCharForToken(token: DocToken): string {
    const key = this.serializeToken(token);

    if (!this.tokenToChar.has(key)) {
      const char = String.fromCharCode(this.nextCharCode++);
      this.tokenToChar.set(key, char);
      this.charToToken.set(char, token);
    }

    return this.tokenToChar.get(key)!;
  }

  private serializeToken(token: DocToken): string {
    // 生成唯一键: JSON 序列化 + marks 排序
    return JSON.stringify({
      text: token.text,
      marks: token.marks.sort(),
      markAttrs: token.markAttrs,
      nodeType: token.nodeType
    });
  }

  decode(encoded: string): DocToken[] {
    return Array.from(encoded).map(char => {
      return this.charToToken.get(char)!;
    });
  }
}
```

**关键设计点**:
- ✅ Unicode 私有区可容纳 6400+ 种不同 Token
- ✅ marks 数组排序确保一致性
- ✅ 零宽空格标记块边界

---

### 2. StructuredDiff (结构化 Diff 引擎)

**文件**: `src/ai/structuredDiff.ts`

#### 职责

- 计算 Token 级别的 Diff
- 生成 DiffOperation 数组
- 支持增量 Diff（仅选区范围）

#### 核心接口

```typescript
class StructuredDiff {
  private codec: TokenCodec;

  constructor(codec: TokenCodec) {
    this.codec = codec;
  }

  /**
   * 计算结构化 Diff
   * @param originalNode - 原始 ProseMirror 节点
   * @param aiNode - AI 生成的节点
   * @param from - 起始位置
   * @param to - 结束位置
   * @returns DiffResult
   */
  computeStructuredDiff(
    originalNode: ProseMirrorNode,
    aiNode: ProseMirrorNode,
    from: number,
    to: number
  ): DiffResult;

  /**
   * 从 Diff 结果构建操作数组
   */
  private buildDiffResult(diffs: Diff[], basePos: number): DiffResult;
}
```

#### 实现流程

```typescript
computeStructuredDiff(
  originalNode: ProseMirrorNode,
  aiNode: ProseMirrorNode,
  from: number,
  to: number
): DiffResult {
  // 1. Token 化
  const tokensA = nodeToTokens(originalNode);
  const tokensB = nodeToTokens(aiNode);

  // 2. 编码
  const encodedA = this.codec.encode(tokensA);
  const encodedB = this.codec.encode(tokensB);

  // 3. 运行 diff-match-patch
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(encodedA, encodedB);
  dmp.diff_cleanupSemantic(diffs);

  // 4. 解码 + 重建
  return this.buildDiffResult(diffs, from);
}

private buildDiffResult(diffs: Diff[], basePos: number): DiffResult {
  const operations: DiffOperation[] = [];
  let currentPos = basePos;

  diffs.forEach(([type, encoded]) => {
    const tokens = this.codec.decode(encoded);

    if (type === 0) {
      // EQUAL - 保持不变
      currentPos += tokens.reduce((sum, t) => sum + t.text.length, 0);
    } else if (type === 1) {
      // INSERT - AI 添加的内容
      operations.push({
        type: 'insert',
        tokens,
        position: currentPos
      });
    } else if (type === -1) {
      // DELETE - AI 删除的内容
      const length = tokens.reduce((sum, t) => sum + t.text.length, 0);
      operations.push({
        type: 'delete',
        tokens,
        from: currentPos,
        to: currentPos + length
      });
      currentPos += length;
    }
  });

  return {
    operations,
    stats: this._calculateStats(operations)
  };
}
```

**格式变更处理** (简化策略):

```
"Hello"(bold) → "Hello"(italic)

Diff 结果:
[
  { type: 'delete', tokens: [{ text: 'Hello', marks: ['bold'] }] },
  { type: 'insert', tokens: [{ text: 'Hello', marks: ['italic'] }] }
]

渲染:
<span class="suggestion-delete">Hello</span>
<span class="suggestion-add">Hello</span>
```

---

### 3. AIClient (前端客户端)

**文件**: `src/ai/aiClient.ts`

#### 职责

- 调用后端 AI API
- 处理请求/响应
- 健康检查

#### 实现

```typescript
export class AIClient {
  private baseUrl = 'http://localhost:3001/api';

  /**
   * 调用 AI 改写接口
   */
  async rewrite(
    content: any,
    instruction: string = 'Improve this text',
    format: 'yjs' | 'json' | 'html' = 'json'
  ): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/ai/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        instruction,
        format
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * 健康检查
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }
}
```

---

### 4. Express Server (后端代理)

**文件**: `server/index.ts`, `server/deepseek.ts`

#### Express 服务器

```typescript
import express from 'express';
import cors from 'cors';
import { DeepSeekClient } from './deepseek';

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// AI 改写接口
app.post('/api/ai/rewrite', async (req, res) => {
  try {
    const { content, instruction, format } = req.body;

    // 验证
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // 调用 DeepSeek
    const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY!);
    const result = await client.rewrite(content, instruction, format);

    res.json({
      success: true,
      data: result.data,
      meta: result.meta
    });
  } catch (error) {
    console.error('AI rewrite error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 AI proxy server running on http://localhost:${PORT}`);
});
```

#### DeepSeek 客户端

```typescript
export class DeepSeekClient {
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async rewrite(
    content: any,
    instruction: string,
    format: 'yjs' | 'json' | 'html'
  ): Promise<{ data: any; meta: any }> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(content, instruction, format);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: this.getSystemPrompt(format) },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    const parsedData = this.parseResponse(data, format);

    return {
      data: parsedData,
      meta: {
        model: data.model,
        duration: Date.now() - startTime,
        tokenCount: data.usage?.total_tokens || 0
      }
    };
  }

  private getSystemPrompt(format: string): string {
    if (format === 'yjs') {
      return `You are a text editor assistant. Return Yjs operations in JSON format.
Operations: {type: 'insert'|'delete'|'formatChange', position, content, ...}`;
    } else if (format === 'json') {
      return `You are a writing assistant. Return improved text as Token array in JSON.
Format: [{text: "word", marks: ["bold"], ...}, ...]`;
    }
    return `You are a writing assistant. Improve the given text.`;
  }

  private buildPrompt(content: any, instruction: string, format: string): string {
    return `Original content:
${JSON.stringify(content, null, 2)}

Instruction: ${instruction}

Output format: ${format}`;
  }

  private parseResponse(data: any, format: string): any {
    const content = data.choices[0].message.content;

    if (format === 'yjs' || format === 'json') {
      try {
        return JSON.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse ${format} response: ${e}`);
      }
    }

    return content;
  }
}
```

---

### 5. 升级 Suggestion Extension

**文件**: `src/extensions/suggestion.ts`

#### 新增命令

```typescript
addCommands() {
  return {
    /**
     * 结构化 AI 建议（升级版）
     */
    applyAISuggestionStructured: (
      from: number,
      to: number,
      instruction?: string
    ) => async ({ state, dispatch, editor }) => {
      if (!dispatch) return true;

      // 1. 提取选区内容
      const slice = state.doc.slice(from, to);
      const originalNode = slice.content;

      // 2. Token 化
      const codec = new TokenCodec();
      const diffEngine = new StructuredDiff(codec);
      const originalTokens = nodeToTokens(originalNode);

      // 3. 调用 AI
      const aiClient = new AIClient();
      const aiResponse = await aiClient.rewrite(
        originalTokens,
        instruction || 'Improve this text',
        'json'
      );

      // 4. 重建 Node
      const aiNode = reconstructNodeFromTokens(aiResponse.data);

      // 5. 计算 Diff
      const diffResult = diffEngine.computeStructuredDiff(
        originalNode,
        aiNode,
        from,
        to
      );

      // 6. 应用
      const groupId = generateGroupId();
      applyStructuredDiff(editor, diffResult, from, to, groupId);

      return true;
    },

    // ... 其他命令保持不变
  };
}
```

#### applyStructuredDiff 实现

```typescript
function applyStructuredDiff(
  editor: Editor,
  diffResult: DiffResult,
  from: number,
  to: number,
  groupId: string
): void {
  const { state } = editor;
  const tr = state.tr;

  // 构建带 Suggestion Mark 的节点
  const fragments: ProseMirrorNode[] = [];

  diffResult.operations.forEach(op => {
    if (op.type === 'delete') {
      // 删除：保留文本，添加 suggestion mark
      op.tokens.forEach(token => {
        const baseMarks = token.marks.map(name =>
          state.schema.marks[name].create(token.markAttrs?.[name])
        );
        const suggestionMark = state.schema.marks.suggestion.create({
          type: 'delete',
          diffId: generateId(),
          groupId
        });

        fragments.push(
          state.schema.text(token.text, [...baseMarks, suggestionMark])
        );
      });
    } else {
      // 插入：添加文本和 suggestion mark
      op.tokens.forEach(token => {
        const baseMarks = token.marks.map(name =>
          state.schema.marks[name].create(token.markAttrs?.[name])
        );
        const suggestionMark = state.schema.marks.suggestion.create({
          type: 'add',
          diffId: generateId(),
          groupId
        });

        fragments.push(
          state.schema.text(token.text, [...baseMarks, suggestionMark])
        );
      });
    }
  });

  // 一次性替换
  tr.replaceWith(from, to, Fragment.from(fragments));
  tr.setMeta('suggestion', true);
  tr.setMeta('addToHistory', false); // 应用 Suggestion 不加历史

  editor.view.dispatch(tr);
}
```

---

### 6. 升级 SuggestionManager (精细撤销 + 冲突处理)

**文件**: `src/extensions/suggestionManager.ts`

#### 精细撤销实现

```typescript
export class SuggestionManager implements ISuggestionManager {
  // ... 现有字段
  private undoStack: UndoStackItem[] = [];
  private conflictDetector: ConflictDetector;
  private conflictResolver: ConflictResolver;

  constructor(editor: Editor) {
    this.editor = editor;
    this.groups = new Map();
    this.currentGroupId = null;
    this.currentIndex = 0;
    this.onChangeCallback = null;

    // 初始化冲突处理
    this.conflictDetector = new ConflictDetector();
    this.conflictResolver = new ConflictResolver();

    this._attachEditorListeners();
    this._attachUndoListener();
  }

  /**
   * 监听撤销/重做事件
   */
  private _attachUndoListener(): void {
    this.editor.on('transaction', ({ transaction }) => {
      const meta = transaction.getMeta('suggestionOperation');

      if (meta && transaction.docChanged) {
        this._trackUndoRedo(meta, transaction);
      }
    });
  }

  /**
   * 跟踪撤销/重做
   */
  private _trackUndoRedo(meta: any, transaction: Transaction): void {
    // 记录到撤销栈
    this.undoStack.push({
      transaction,
      meta: {
        type: 'suggestion',
        operation: meta.operation,
        diffId: meta.diffId,
        groupId: meta.groupId
      }
    });

    // 限制栈大小
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
  }

  /**
   * 接受当前建议（精细撤销版）
   */
  acceptCurrent(): boolean {
    const current = this.getCurrentSuggestion();
    if (!current) return false;

    // 创建可撤销的事务
    const tr = this.editor.state.tr;

    // 应用接受逻辑
    this._applySuggestionAcceptance(tr, current);

    // 关键: 添加到历史记录
    tr.setMeta('addToHistory', true);
    tr.setMeta('suggestionOperation', {
      operation: 'accept',
      diffId: current.diffId,
      groupId: current.groupId
    });

    this.editor.view.dispatch(tr);

    current.status = 'accepted';
    this._moveToNextPending();
    this._notifyChange();

    return true;
  }

  /**
   * 应用接受逻辑（提取为独立方法）
   */
  private _applySuggestionAcceptance(tr: Transaction, suggestion: SuggestionItem): void {
    const { state } = this.editor;
    const nodesToRemove: { from: number; to: number }[] = [];
    const marksToRemove: { from: number; to: number; mark: PMMark }[] = [];

    state.doc.descendants((node, pos) => {
      const suggestionMark = node.marks.find(
        (mark) =>
          mark.type.name === 'suggestion' &&
          (mark.attrs as SuggestionAttributes).diffId === suggestion.diffId
      );

      if (suggestionMark) {
        const attrs = suggestionMark.attrs as SuggestionAttributes;
        const from = pos;
        const to = pos + node.nodeSize;

        if (attrs.type === 'delete') {
          nodesToRemove.push({ from, to });
        } else {
          marksToRemove.push({ from, to, mark: suggestionMark });
        }
      }
      return true;
    });

    // 应用删除和标记移除
    nodesToRemove
      .sort((a, b) => b.from - a.from)
      .forEach(({ from, to }) => {
        tr.delete(from, to);
      });

    marksToRemove.forEach(({ from, to, mark }) => {
      const mappedFrom = tr.mapping.map(from);
      const mappedTo = tr.mapping.map(to);
      tr.removeMark(mappedFrom, mappedTo, mark);
    });
  }

  /**
   * 注册新组（带冲突检测）
   */
  registerGroup(groupId: string): void {
    this.currentGroupId = groupId;
    this.currentIndex = 0;
    this._syncFromDocument();

    // 冲突检测
    const newSuggestions = this.getCurrentGroupSuggestions();
    const existingSuggestions = this.getAllSuggestions().filter(
      s => s.groupId !== groupId
    );

    if (existingSuggestions.length > 0) {
      const conflicts = this.conflictDetector.detectConflicts(
        existingSuggestions,
        newSuggestions[0] // 使用第一个作为代表
      );

      if (conflicts.length > 0) {
        const resolution = this.conflictResolver.resolve(conflicts);
        this._handleConflictResolution(resolution);
      }
    }
  }

  /**
   * 处理冲突解决结果
   */
  private _handleConflictResolution(resolution: Resolution): void {
    // 失效旧的建议
    resolution.invalidated.forEach(suggestion => {
      suggestion.status = 'rejected';
      this.editor.commands.rejectSuggestion(suggestion.diffId);
    });

    // 通知用户
    if (resolution.invalidated.length > 0) {
      console.warn(
        `${resolution.invalidated.length} suggestions invalidated due to conflicts`
      );
    }
  }
}
```

---

### 7. 冲突检测和解决

**文件**: `src/ai/conflictDetector.ts`, `src/ai/conflictResolver.ts`

#### ConflictDetector

```typescript
export class ConflictDetector {
  /**
   * 检测位置重叠冲突
   */
  detectConflicts(
    existingSuggestions: SuggestionItem[],
    newSuggestion: SuggestionItem
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    existingSuggestions.forEach(existing => {
      const isOverlap = this._checkOverlap(
        existing.from, existing.to,
        newSuggestion.from, newSuggestion.to
      );

      if (isOverlap) {
        conflicts.push({
          type: 'position_overlap',
          suggestion1: existing,
          suggestion2: newSuggestion,
          overlapRange: this._calculateOverlap(existing, newSuggestion)
        });
      }
    });

    return conflicts;
  }

  private _checkOverlap(
    from1: number, to1: number,
    from2: number, to2: number
  ): boolean {
    return !(to1 <= from2 || to2 <= from1);
  }

  private _calculateOverlap(
    s1: SuggestionItem,
    s2: SuggestionItem
  ): [number, number] {
    return [
      Math.max(s1.from, s2.from),
      Math.min(s1.to, s2.to)
    ];
  }
}
```

#### ConflictResolver

```typescript
export class ConflictResolver {
  /**
   * 解决冲突：时间戳优先 + 位置排序
   */
  resolve(conflicts: Conflict[]): Resolution {
    // 按时间戳排序（最新的优先）
    const sorted = conflicts.sort((a, b) => {
      const timeA = this._getTimestamp(a.suggestion2);
      const timeB = this._getTimestamp(b.suggestion2);
      return timeB - timeA;
    });

    const validSuggestions: SuggestionItem[] = [];
    const invalidated: SuggestionItem[] = [];

    sorted.forEach(conflict => {
      // 最新的保留，旧的失效
      invalidated.push(conflict.suggestion1);
      validSuggestions.push(conflict.suggestion2);
    });

    return { validSuggestions, invalidated };
  }

  private _getTimestamp(suggestion: SuggestionItem): number {
    // 从 groupId 提取时间戳: "g1638345600000_abc123"
    const match = suggestion.groupId.match(/g(\d+)_/);
    return match ? parseInt(match[1]) : 0;
  }
}
```

---

## 数据结构

### DocToken

```typescript
/**
 * Token 表示带格式的文本片段
 */
export interface DocToken {
  /** 文本内容 */
  text: string;

  /** 样式标记（排序后的 mark name 数组） */
  marks: string[];

  /** Mark 属性（用于复杂 mark，如 link 的 href） */
  markAttrs?: Record<string, Record<string, any>>;

  /** 块级节点类型（如果是块边界） */
  nodeType?: string;

  /** 块级节点属性 */
  nodeAttrs?: Record<string, any>;

  /** 起始位置 */
  from?: number;

  /** 结束位置 */
  to?: number;
}
```

### DiffOperation

```typescript
export interface DiffOperation {
  /** 操作类型 */
  type: 'insert' | 'delete';

  /** 涉及的 Token */
  tokens: DocToken[];

  /** 插入位置（insert 类型） */
  position?: number;

  /** 删除范围（delete 类型） */
  from?: number;
  to?: number;
}
```

### DiffResult

```typescript
export interface DiffResult {
  /** 操作数组 */
  operations: DiffOperation[];

  /** 统计信息 */
  stats?: {
    totalTokens: number;
    insertions: number;
    deletions: number;
    unchanged: number;
  };
}
```

### 升级后的 SuggestionItem

```typescript
export interface SuggestionItem {
  diffId: string;
  groupId: string;
  type: SuggestionType;
  text: string;
  from: number;
  to: number;
  status: SuggestionStatus;

  /** 新增: 原始 Token 信息 */
  tokens?: DocToken[];

  /** 新增: 格式变更详情 */
  formatChanges?: {
    oldMarks: string[];
    newMarks: string[];
  };

  /** 新增: 创建时间戳（用于冲突排序） */
  timestamp?: number;

  /** 新增: 是否可撤销 */
  undoable?: boolean;
}
```

### AIResponse

```typescript
export interface AIResponse {
  success: boolean;

  data: {
    tokens?: DocToken[];
    html?: string;
    yjsOps?: YjsOperation[];
  };

  meta?: {
    model: string;
    duration: number;
    tokenCount: number;
  };
}
```

---

## API 设计

### 前端 API

#### AIClient

```typescript
class AIClient {
  /**
   * 调用 AI 改写
   * @param content - 原始内容（Token 数组或文本）
   * @param instruction - 改写指令
   * @param format - 响应格式
   */
  async rewrite(
    content: any,
    instruction?: string,
    format?: 'yjs' | 'json' | 'html'
  ): Promise<AIResponse>;

  /**
   * 健康检查
   */
  async health(): Promise<boolean>;
}
```

#### Suggestion Extension Commands

```typescript
editor.commands.applyAISuggestionStructured(
  from: number,
  to: number,
  instruction?: string
);

editor.commands.acceptSuggestion(diffId: string);
editor.commands.rejectSuggestion(diffId: string);
editor.commands.acceptAllSuggestions(groupId?: string);
editor.commands.rejectAllSuggestions(groupId?: string);
editor.commands.finalizeSuggestions();
```

### 后端 API

#### POST /api/ai/rewrite

**请求**:
```json
{
  "content": [
    { "text": "Hello", "marks": [] },
    { "text": " ", "marks": [] },
    { "text": "World", "marks": ["bold"] }
  ],
  "instruction": "Make it more formal",
  "format": "json"
}
```

**响应**:
```json
{
  "success": true,
  "data": [
    { "text": "Greetings", "marks": [] },
    { "text": " ", "marks": [] },
    { "text": "Universe", "marks": ["italic"] }
  ],
  "meta": {
    "model": "deepseek-chat",
    "duration": 1234,
    "tokenCount": 150
  }
}
```

#### GET /api/health

**响应**:
```json
{
  "status": "ok",
  "timestamp": 1638345600000
}
```

---

## Phase 1 PoC 计划

### 验证目标

**核心问题**: DeepSeek 能否理解并生成有效的 Yjs 操作序列？

### 测试用例

#### Test Case 1: 简单文本修改

**输入**:
```json
{
  "original": "Hello World",
  "instruction": "Change 'World' to 'Universe'"
}
```

**期望 Yjs 输出**:
```json
{
  "operations": [
    { "type": "delete", "position": 6, "length": 5 },
    { "type": "insert", "position": 6, "content": "Universe" }
  ]
}
```

#### Test Case 2: 格式变更

**输入**:
```json
{
  "original": {
    "type": "paragraph",
    "content": [
      { "type": "text", "text": "Hello ", "marks": [] },
      { "type": "text", "text": "World", "marks": ["bold"] }
    ]
  },
  "instruction": "Remove bold from World"
}
```

**期望 Yjs 输出**:
```json
{
  "operations": [
    {
      "type": "formatChange",
      "from": 6,
      "to": 11,
      "removeMark": "bold"
    }
  ]
}
```

#### Test Case 3: 块级结构变更

**输入**:
```json
{
  "original": {
    "type": "paragraph",
    "content": [{ "type": "text", "text": "Title" }]
  },
  "instruction": "Convert to heading level 1"
}
```

**期望 Yjs 输出**:
```json
{
  "operations": [
    {
      "type": "setBlockType",
      "from": 0,
      "to": 5,
      "blockType": "heading",
      "attrs": { "level": 1 }
    }
  ]
}
```

### 成功标准

- ✅ 文本修改准确率 >95%
- ✅ 格式保留率 >90%
- ✅ 输出格式一致性 >90%
- ✅ 响应时间 <3s

### 失败触发条件

- ❌ 任一指标低于阈值
- ❌ AI 无法理解 Yjs 格式
- ❌ 输出格式频繁变化

### 回退方案

如果 PoC 失败，立即切换到 **方案 C**:

```
AI 返回简单 JSON/HTML
      ↓
前端 Token Diff
      ↓
生成 Suggestion
```

**优点**:
- AI 只需返回改写后的文本/HTML
- 不需要理解 Yjs 复杂格式
- 降低 AI 集成复杂度

**实施步骤**:
1. 修改 DeepSeek prompt，返回 HTML
2. 使用 `schema.nodeFromHTML()` 解析
3. 前端 Token Diff（现有流程）

---

## 实施路线图

### Phase 1: PoC 验证 (2-3 天)

**任务**:
- [x] 创建 3 个测试用例
- [ ] 实现 DeepSeek 客户端原型
- [ ] 运行测试并收集数据
- [ ] 评估结果，决定回退

**交付物**:
- `tests/integration/poc.test.ts`
- PoC 测试报告
- 回退方案决策文档

---

### Phase 2: TokenCodec (3-4 天)

**任务**:
- [ ] 实现 `nodeToTokens()`
- [ ] 实现 `TokenCodec` 编码/解码
- [ ] 实现 `tokenizeText()` 词级分词
- [ ] 单元测试覆盖率 >80%
- [ ] 性能基准测试

**交付物**:
- `src/ai/tokenCodec.ts`
- `tests/unit/tokenCodec.test.ts`
- 性能报告

---

### Phase 3: StructuredDiff (4-5 天)

**任务**:
- [ ] 实现 `StructuredDiff.computeStructuredDiff()`
- [ ] 实现 `applyStructuredDiff()`
- [ ] 升级 `suggestion.ts` 的 `applyAISuggestionStructured` 命令
- [ ] 集成测试
- [ ] 格式保留验证

**交付物**:
- `src/ai/structuredDiff.ts`
- 升级后的 `src/extensions/suggestion.ts`
- `tests/integration/structuredDiff.test.ts`

---

### Phase 4: 服务端集成 (3-4 天)

**任务**:
- [ ] 创建 Express 服务器框架
- [ ] 实现 `/api/ai/rewrite` 端点
- [ ] 实现 `DeepSeekClient`
- [ ] 前端 `AIClient` 集成
- [ ] 错误处理和日志
- [ ] 环境变量配置

**交付物**:
- `server/index.ts`
- `server/deepseek.ts`
- `src/ai/aiClient.ts`
- `.env.example`
- API 文档

---

### Phase 5: 高级特性 (5-6 天)

**任务**:
- [ ] 升级 `SuggestionManager` 支持精细撤销
- [ ] 实现 `ConflictDetector`
- [ ] 实现 `ConflictResolver`
- [ ] 性能优化（增量 Diff、缓存）
- [ ] 位置优先排序
- [ ] 端到端测试

**交付物**:
- 升级后的 `src/extensions/suggestionManager.ts`
- `src/ai/conflictDetector.ts`
- `src/ai/conflictResolver.ts`
- 性能测试报告
- 用户手册

---

### 时间估算

**总计**: 17-22 天
**风险缓冲**: +30% → **22-28 天**

**里程碑**:
- **Week 1**: Phase 1 完成，PoC 决策点
- **Week 2**: Phase 2-3 完成，核心功能可用
- **Week 3**: Phase 4 完成，AI 集成完成
- **Week 4**: Phase 5 完成，生产就绪

---

## 性能优化

### 1. 增量 Diff

**策略**: 仅处理选区范围

```typescript
class PerformantStructuredDiff extends StructuredDiff {
  computeStructuredDiff(
    originalNode: ProseMirrorNode,
    aiNode: ProseMirrorNode,
    from: number,
    to: number
  ): DiffResult {
    // 关键: 只处理选区
    const slicedOriginal = originalNode.cut(from, to);
    const slicedAI = aiNode;

    const tokensA = nodeToTokens(slicedOriginal, from);
    const tokensB = nodeToTokens(slicedAI, from);

    // 大文档分块处理
    if (tokensA.length > 1000 || tokensB.length > 1000) {
      return this._chunkDiff(tokensA, tokensB, from);
    }

    return this._standardDiff(tokensA, tokensB, from);
  }
}
```

### 2. 缓存优化

**Token 编码缓存**:

```typescript
class TokenCodec {
  private tokenCache = new LRUCache<string, DocToken>(1000);
  private encodeCache = new LRUCache<string, string>(1000);

  encode(tokens: DocToken[]): string {
    const cacheKey = this._getCacheKey(tokens);

    if (this.encodeCache.has(cacheKey)) {
      return this.encodeCache.get(cacheKey)!;
    }

    const result = this._encodeTokens(tokens);
    this.encodeCache.set(cacheKey, result);

    return result;
  }
}
```

### 3. 性能指标

**目标**:
- 小文档 (<1000 字): <100ms
- 中文档 (1000-5000 字): <500ms
- 大文档 (>5000 字): <2s

**监控**:

```typescript
performance.mark('diff-start');
const result = diffEngine.computeStructuredDiff(...);
performance.mark('diff-end');

const measure = performance.measure('diff', 'diff-start', 'diff-end');
console.log(`Diff completed in ${measure.duration}ms`);

// 上报到监控系统
reportMetric('diff_duration', measure.duration);
```

---

## 风险评估

### 高风险

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| **DeepSeek 无法生成 Yjs 操作** | 🔴 高 | Phase 1 PoC 验证，准备回退方案 C |
| **大文档性能问题** | 🔴 高 | 增量 Diff + 分块处理 + 缓存 |
| **格式信息丢失** | 🔴 高 | Token 结构包含完整 marks + 单元测试 |

### 中风险

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| **冲突处理复杂** | 🟡 中 | 简化策略：时间戳优先 |
| **撤销机制复杂** | 🟡 中 | 复用 ProseMirror 历史系统 |
| **AI 响应慢** | 🟡 中 | 后端缓存 + 流式响应 |

### 低风险

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| **词级分词不准** | 🟢 低 | 使用成熟的分词库 |
| **Unicode 编码冲突** | 🟢 低 | 私有区有 6400+ 字符空间 |

---

## 附录

### A. 依赖更新

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "vitest": "^1.0.0",
    "concurrently": "^8.0.0"
  },
  "scripts": {
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "test": "vitest",
    "test:poc": "vitest run tests/integration/poc.test.ts"
  }
}
```

### B. 环境变量

```bash
# .env.example
DEEPSEEK_API_KEY=your_api_key_here
PORT=3001
NODE_ENV=development
```

### C. 文件结构

```
tiptap-ai-yjs-demo/
├── src/
│   ├── ai/                          # 新增
│   │   ├── types.ts
│   │   ├── tokenCodec.ts
│   │   ├── structuredDiff.ts
│   │   ├── aiClient.ts
│   │   ├── conflictDetector.ts
│   │   ├── conflictResolver.ts
│   │   └── index.ts
│   ├── extensions/
│   │   ├── suggestion.ts            # 升级
│   │   ├── suggestionManager.ts     # 升级
│   │   └── ...
│   └── ...
├── server/                          # 新增
│   ├── index.ts
│   ├── deepseek.ts
│   └── types.ts
├── tests/                           # 新增
│   ├── unit/
│   └── integration/
├── docs/
│   ├── EXPERT_AI_DESIGN.md          # 本文档
│   └── POC_PLAN.md
└── ...
```

---

## 结论

本技术设计文档详细描述了专家级 AI Suggestion 系统的完整实现方案，包括：

- ✅ **Token-based Diff**: 格式感知的结构化 Diff 引擎
- ✅ **DeepSeek 集成**: Express 服务器代理 + AI 客户端
- ✅ **精细撤销**: 每个操作独立可撤销
- ✅ **冲突处理**: 智能合并策略
- ✅ **性能优化**: 增量 Diff + 缓存

**下一步**: Phase 1 PoC 验证，验证 DeepSeek 生成 Yjs 操作的可行性。

---

**文档版本历史**:
- v1.0 (2025-12-08): 初始版本，完整技术设计
