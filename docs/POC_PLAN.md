# Phase 1 PoC 验证计划

**目标**: 验证 DeepSeek 生成 Yjs 操作序列的可行性
**时间**: 2-3 天
**状态**: 待启动

---

## 📋 目录

1. [验证目标](#验证目标)
2. [测试用例设计](#测试用例设计)
3. [实施步骤](#实施步骤)
4. [成功标准](#成功标准)
5. [回退方案](#回退方案)
6. [交付物清单](#交付物清单)

---

## 验证目标

### 核心问题

**DeepSeek 能否理解并生成有效的 Yjs 操作序列？**

### 验证要点

1. ✅ **格式理解**: AI 能否正确理解 ProseMirror/Yjs 的数据结构？
2. ✅ **操作生成**: AI 能否生成正确的 Yjs 操作（insert/delete/formatChange）？
3. ✅ **格式保留**: 生成的操作是否保留原始格式信息（bold, italic 等）？
4. ✅ **输出一致性**: 多次调用是否返回一致的格式？
5. ✅ **响应速度**: 是否满足 <3s 的性能要求？

---

## 测试用例设计

### Test Case 1: 简单文本修改

**场景**: 基础文本替换，无格式

**输入**:
```json
{
  "original": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Hello World" }
        ]
      }
    ]
  },
  "instruction": "Change 'World' to 'Universe'",
  "outputFormat": "yjs"
}
```

**期望输出**:
```json
{
  "operations": [
    {
      "type": "delete",
      "position": 6,
      "length": 5,
      "description": "Delete 'World'"
    },
    {
      "type": "insert",
      "position": 6,
      "content": "Universe",
      "description": "Insert 'Universe'"
    }
  ]
}
```

**验证点**:
- 位置计算正确（position: 6）
- 删除长度正确（length: 5）
- 插入内容正确（"Universe"）

---

### Test Case 2: 内联格式变更

**场景**: 文本内容不变，格式变更

**输入**:
```json
{
  "original": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Hello " },
          {
            "type": "text",
            "text": "World",
            "marks": [{ "type": "bold" }]
          }
        ]
      }
    ]
  },
  "instruction": "Change 'World' from bold to italic",
  "outputFormat": "yjs"
}
```

**期望输出**:
```json
{
  "operations": [
    {
      "type": "formatChange",
      "from": 6,
      "to": 11,
      "removeMark": { "type": "bold" },
      "addMark": { "type": "italic" },
      "description": "Change World from bold to italic"
    }
  ]
}
```

**验证点**:
- 识别格式变更（不是删除+插入）
- 正确的 mark 操作（remove bold, add italic）
- 范围正确（from: 6, to: 11）

---

### Test Case 3: 块级结构变更

**场景**: 段落转换为标题

**输入**:
```json
{
  "original": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Title Text" }
        ]
      }
    ]
  },
  "instruction": "Convert this paragraph to a heading level 1",
  "outputFormat": "yjs"
}
```

**期望输出**:
```json
{
  "operations": [
    {
      "type": "setBlockType",
      "from": 0,
      "to": 10,
      "blockType": "heading",
      "attrs": { "level": 1 },
      "description": "Convert paragraph to heading level 1"
    }
  ]
}
```

**验证点**:
- 块级操作识别（setBlockType）
- 正确的目标类型（heading）
- 属性正确（level: 1）

---

### Test Case 4: 复合操作

**场景**: 同时修改文本和格式

**输入**:
```json
{
  "original": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Hello " },
          {
            "type": "text",
            "text": "World",
            "marks": [{ "type": "bold" }]
          }
        ]
      }
    ]
  },
  "instruction": "Change 'World' to 'Universe' and make it italic instead of bold",
  "outputFormat": "yjs"
}
```

**期望输出**:
```json
{
  "operations": [
    {
      "type": "delete",
      "position": 6,
      "length": 5,
      "description": "Delete 'World' (bold)"
    },
    {
      "type": "insert",
      "position": 6,
      "content": "Universe",
      "marks": [{ "type": "italic" }],
      "description": "Insert 'Universe' (italic)"
    }
  ]
}
```

**验证点**:
- 正确处理复合操作
- 格式信息保留在 insert 操作中

---

### Test Case 5: 多段落操作

**场景**: 跨段落的文本修改

**输入**:
```json
{
  "original": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "First paragraph." }]
      },
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Second paragraph." }]
      }
    ]
  },
  "instruction": "Combine into one paragraph",
  "outputFormat": "yjs"
}
```

**期望输出**:
```json
{
  "operations": [
    {
      "type": "delete",
      "position": 16,
      "length": 1,
      "description": "Delete paragraph break"
    },
    {
      "type": "insert",
      "position": 16,
      "content": " ",
      "description": "Insert space"
    }
  ]
}
```

**验证点**:
- 跨块级节点操作
- 正确的段落合并逻辑

---

## 实施步骤

### Day 1: 环境准备和基础测试

#### 1.1 创建测试框架

**文件**: `tests/integration/poc.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { DeepSeekClient } from '../../server/deepseek';

describe('Phase 1 PoC: DeepSeek Yjs Operations', () => {
  const client = new DeepSeekClient(process.env.DEEPSEEK_API_KEY!);

  it('Test Case 1: Simple text modification', async () => {
    const input = {
      original: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }]
          }
        ]
      },
      instruction: "Change 'World' to 'Universe'",
      outputFormat: 'yjs'
    };

    const result = await client.rewrite(input.original, input.instruction, 'yjs');

    // 验证
    expect(result.data.operations).toBeDefined();
    expect(result.data.operations).toHaveLength(2);

    const deleteOp = result.data.operations[0];
    expect(deleteOp.type).toBe('delete');
    expect(deleteOp.position).toBe(6);
    expect(deleteOp.length).toBe(5);

    const insertOp = result.data.operations[1];
    expect(insertOp.type).toBe('insert');
    expect(insertOp.position).toBe(6);
    expect(insertOp.content).toBe('Universe');
  });

  // 其他测试用例...
});
```

#### 1.2 配置 DeepSeek System Prompt

**文件**: `server/deepseek.ts`

```typescript
private getSystemPrompt(format: string): string {
  if (format === 'yjs') {
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
1. Position starts at 0
2. Preserve ALL formatting information (bold, italic, etc.)
3. Use minimal operations (prefer formatChange over delete+insert for format-only changes)
4. Include clear description for each operation
5. Ensure operations are in correct order

## Examples:
Input: "Hello World" → "Hello Universe"
Output: {"operations": [{"type":"delete","position":6,"length":5},{"type":"insert","position":6,"content":"Universe"}]}

Input: Change "World" from bold to italic
Output: {"operations": [{"type":"formatChange","from":6,"to":11,"removeMark":{"type":"bold"},"addMark":{"type":"italic"}}]}`;
  }

  // 其他格式...
}
```

#### 1.3 运行 Test Case 1-2

```bash
npm run test:poc
```

**记录结果**:
- AI 响应时间
- 输出格式是否正确
- 操作是否准确

---

### Day 2: 复杂测试和数据收集

#### 2.1 运行 Test Case 3-5

```bash
npm run test:poc -- --grep "Test Case [3-5]"
```

#### 2.2 一致性测试

**目标**: 验证多次调用的一致性

```typescript
it('Consistency test: Same input produces similar output', async () => {
  const input = { /* Test Case 1 */ };

  const results = await Promise.all([
    client.rewrite(input.original, input.instruction, 'yjs'),
    client.rewrite(input.original, input.instruction, 'yjs'),
    client.rewrite(input.original, input.instruction, 'yjs')
  ]);

  // 验证结果是否一致
  const operations1 = JSON.stringify(results[0].data.operations);
  const operations2 = JSON.stringify(results[1].data.operations);
  const operations3 = JSON.stringify(results[2].data.operations);

  // 允许一定程度的差异（如 description 字段）
  expect(compareOperations(results[0], results[1])).toBeGreaterThan(0.9);
  expect(compareOperations(results[1], results[2])).toBeGreaterThan(0.9);
});
```

#### 2.3 性能测试

```typescript
it('Performance test: Response time < 3s', async () => {
  const input = { /* Test Case 1 */ };

  const start = Date.now();
  const result = await client.rewrite(input.original, input.instruction, 'yjs');
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(3000);
  console.log(`Response time: ${duration}ms`);
});
```

#### 2.4 错误处理测试

```typescript
it('Error handling: Invalid input', async () => {
  const invalidInput = { /* 格式错误的输入 */ };

  await expect(
    client.rewrite(invalidInput, 'test', 'yjs')
  ).rejects.toThrow();
});
```

---

### Day 3: 结果分析和决策

#### 3.1 数据汇总

**创建测试报告**: `docs/POC_TEST_REPORT.md`

```markdown
# PoC 测试报告

## 测试结果汇总

| 测试用例 | 通过 | 准确率 | 响应时间 | 备注 |
|---------|------|--------|----------|------|
| TC1: 简单文本 | ✅ | 95% | 1.2s | 位置计算准确 |
| TC2: 格式变更 | ✅ | 90% | 1.5s | 偶尔使用 delete+insert |
| TC3: 块级变更 | ✅ | 85% | 1.8s | setBlockType 识别率高 |
| TC4: 复合操作 | ⚠️ | 75% | 2.1s | 格式信息偶尔丢失 |
| TC5: 多段落 | ❌ | 60% | 2.5s | 跨段落逻辑不稳定 |

## 一致性测试
- 同一输入 3 次调用一致性: 88%

## 性能测试
- 平均响应时间: 1.8s
- 95th percentile: 2.5s

## 格式保留率
- Bold/Italic: 92%
- Link: 85%
- 复杂 mark: 78%
```

#### 3.2 决策评估

**成功标准检查**:

| 指标 | 目标 | 实际 | 通过 |
|------|------|------|------|
| 文本修改准确率 | >95% | ?% | ? |
| 格式保留率 | >90% | ?% | ? |
| 输出一致性 | >90% | ?% | ? |
| 响应时间 | <3s | ?s | ? |

**决策矩阵**:

```
如果所有指标通过 ✅
  → 继续使用 Yjs 方案
  → 进入 Phase 2

如果 1-2 个指标未通过 ⚠️
  → 优化 System Prompt
  → 重新测试
  → 评估是否可接受

如果 3+ 个指标未通过 ❌
  → 切换到回退方案 C
  → AI 返回 HTML/JSON
  → 前端 Token Diff
```

---

## 成功标准

### 定量指标

- ✅ **文本修改准确率 >95%**: TC1, TC4 通过率
- ✅ **格式保留率 >90%**: TC2, TC4 格式信息完整性
- ✅ **输出一致性 >90%**: 3 次调用结果相似度
- ✅ **响应时间 <3s**: 95th percentile 响应时间

### 定性指标

- ✅ **可解析性**: JSON 输出格式正确
- ✅ **可执行性**: 生成的操作可以直接应用到 Yjs 文档
- ✅ **鲁棒性**: 各种输入下不崩溃

---

## 回退方案

### 方案 C: 前端 Token Diff

**触发条件**:
- 任一定量指标低于阈值
- AI 无法理解 Yjs 格式
- 输出格式频繁变化

**实施方案**:

```typescript
// 1. 修改 AI 输出格式为简单 HTML
private getSystemPrompt(format: string): string {
  if (format === 'html') {
    return `You are a writing assistant. Improve the given text and return HTML.

Preserve all formatting (bold, italic, links, etc.) in HTML format.

Example:
Input: "Hello <b>World</b>"
Output: "<p>Hello <i>Universe</i></p>"`;
  }
}

// 2. 前端解析 HTML 为 ProseMirror Node
const aiHTML = await aiClient.rewrite(content, instruction, 'html');
const aiNode = editor.schema.nodeFromHTML(aiHTML.data);

// 3. 使用现有 Token Diff 流程
const codec = new TokenCodec();
const diffEngine = new StructuredDiff(codec);
const diffResult = diffEngine.computeStructuredDiff(
  originalNode,
  aiNode,
  from,
  to
);

// 4. 应用 Suggestion
applyStructuredDiff(editor, diffResult, from, to, groupId);
```

**优点**:
- AI 只需返回 HTML，理解成本低
- 充分利用 ProseMirror 的 HTML 解析能力
- 前端 Token Diff 可完全控制

**缺点**:
- 前端计算压力更大
- HTML 解析可能有歧义

---

## 交付物清单

### 必需交付物

- [x] `tests/integration/poc.test.ts` - 测试代码
- [ ] `docs/POC_TEST_REPORT.md` - 测试报告
- [ ] `docs/POC_DECISION.md` - 决策文档
- [ ] `server/deepseek.ts` - DeepSeek 客户端原型

### 可选交付物

- [ ] 性能分析图表
- [ ] 失败案例分析
- [ ] System Prompt 优化历史

---

## 执行检查清单

### Day 1
- [ ] 配置测试环境
- [ ] 实现 DeepSeekClient 原型
- [ ] 创建测试框架
- [ ] 运行 TC1-2
- [ ] 记录初步结果

### Day 2
- [ ] 运行 TC3-5
- [ ] 一致性测试（3 次）
- [ ] 性能测试
- [ ] 错误处理测试
- [ ] 数据汇总

### Day 3
- [ ] 生成测试报告
- [ ] 指标评估
- [ ] 决策矩阵分析
- [ ] 编写决策文档
- [ ] 如果失败，准备回退方案

---

## 附录

### A. System Prompt 优化 Tips

```markdown
## 如果格式保留率低:
- 增加 "Preserve ALL formatting" 强调
- 提供更多格式示例
- 明确 marks 结构定义

## 如果输出格式不一致:
- 使用 JSON Schema 约束
- 增加输出格式示例
- 设置 temperature = 0.1（更确定性）

## 如果位置计算错误:
- 明确位置从 0 开始
- 提供位置计算示例
- 强调字符级别的精确度
```

### B. 测试数据集

所有测试用例的完整数据见 `tests/fixtures/poc-test-cases.json`

### C. 环境配置

```bash
# .env.test
DEEPSEEK_API_KEY=test_key_here
TEST_MODE=poc
LOG_LEVEL=debug
```

---

**PoC 负责人**: [待指定]
**审核人**: [待指定]
**开始日期**: [待定]
**预计结束**: [开始日期 + 3 天]
