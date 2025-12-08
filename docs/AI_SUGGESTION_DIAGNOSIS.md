# AI Suggestion 功能诊断报告

## 当前状态

### ✅ 已修复问题
- **ProseMirror Fragment 错误已解决** - 不再有 RangeError 崩溃
- **代码执行正常** - console.log 显示函数执行完成
- **CSS 样式已定义** - `.tiptap-suggestion-add` 和 `.tiptap-suggestion-delete` 存在

### ❌ 当前问题
用户点击 AI Suggest 按钮后：
- 控制台输出日志正常
- **但没有看到视觉上的 diff 标记**（绿色/红色高亮）

## 诊断分析

### 日志输出
```
Original: ive editor demo using Tiptap 3 and Yjs. (AI enhanced)
AI Suggestion: ive editor demo using Tiptap 3 and Yjs. (AI enhanced) [improved]
```

### 问题识别

**问题 1: 选区不正确**
- 原始文本: "ive editor demo..." - 缺少开头的 "t"
- 这表明选区可能不完整，或者文档状态已改变

**问题 2: Diff 太小**
- AI 只添加了 " [improved]"
- 这是一个很小的改动，可能不够明显

**问题 3: simulateAIRewrite 的随机性**
- 使用 `Math.random() > 0.5` 决定是否应用转换
- 大多数转换可能没有应用
- 只有最后的 fallback 添加了 "[improved]"

## 根本原因

### 1. 模拟函数问题

[src/main.ts:218-252](../src/main.ts#L218-L252) 的 `simulateAIRewrite` 函数：

```typescript
// 当前实现
transformations.forEach((transform) => {
  if (Math.random() > 0.5) {  // ❌ 太随机！
    result = transform(result);
  }
});

// 如果没有改变，添加 [improved]
if (result === text) {
  result = text + " [improved]";
}
```

**问题**:
1. 大部分转换因为随机性而跳过
2. 最终 diff 非常小（只有 " [improved]"）
3. 没有测试文本中的关键词，导致转换无效

### 2. 选区范围问题

从日志看原始文本是 "ive editor demo..." 而不是 "Collaborative editor demo..."：
- 说明选区不完整
- 或者之前的 suggestion 已经被接受并修改了文档

## 解决方案

### 方案 A: 改进模拟函数（推荐用于测试）

让模拟函数产生**明显的、可预测的**变化：

```typescript
function simulateAIRewrite(text: string): string {
  // 确保有明显的变化用于测试 diff 功能

  // 1. 应用确定性转换（不用随机）
  let result = text;

  // 替换常见词汇
  result = result.replace(/collaboration/gi, "teamwork and collaboration");
  result = result.replace(/editor/gi, "advanced editor");
  result = result.replace(/demo/gi, "demonstration");

  // 2. 添加专业术语
  result = result.replace(/Tiptap 3/gi, "Tiptap 3 (rich-text framework)");
  result = result.replace(/Yjs/gi, "Yjs CRDT");

  // 3. 确保总有变化（用于测试）
  if (result === text) {
    // 如果上面的替换都没匹配，就在句尾添加
    result = text.replace(/\.$/, " with enhanced features.");
    if (result === text) {
      result = text + " (professionally enhanced)";
    }
  }

  return result;
}
```

**效果预测**:
```
原始: "Collaborative editor demo using Tiptap 3 and Yjs."
AI建议: "Collaborative advanced editor demonstration using Tiptap 3 (rich-text framework) and Yjs CRDT with enhanced features."
```

这将产生**明显的绿色添加标记**，便于测试。

### 方案 B: 使用真实 AI API（生产环境）

用 DeepSeek API 替换模拟函数：

```typescript
async function getAISuggestion(text: string): Promise<string> {
  try {
    const response = await fetch('http://localhost:3001/api/ai/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text,
        instruction: "Improve the writing style and make it more professional",
        format: "json"  // 暂时返回纯文本，Phase 2 后用 "yjs"
      })
    });

    const result = await response.json();
    return result.success ? result.data : text;
  } catch (error) {
    console.error('AI API error:', error);
    return text; // Fallback to original
  }
}

// 在 applyAISuggestionDemo 中使用
async function applyAISuggestionDemo() {
  const { from, to } = editor.state.selection;
  const originalText = editor.state.doc.textBetween(from, to);

  // 显示加载状态
  suggestionUI.showLoading();

  const aiText = await getAISuggestion(originalText);

  console.log("Original:", originalText);
  console.log("AI Suggestion:", aiText);

  const groupId = `g${Date.now()}`;
  editor.commands.applyAISuggestion(originalText, aiText, from, to, groupId);

  suggestionManager.registerGroup(groupId);
  suggestionUI.show();
}
```

### 方案 C: 添加调试日志

在应用 suggestion 前后检查状态：

```typescript
// 在 applyAISuggestionDemo 中添加
console.log("Selection:", { from, to });
console.log("Editor content before:", editor.getHTML());

editor.commands.applyAISuggestion(originalText, aiText, from, to, groupId);

// 延迟后检查结果
setTimeout(() => {
  console.log("Editor content after:", editor.getHTML());

  // 检查是否有 suggestion marks
  const hasSuggestions = editor.getHTML().includes('data-suggestion-type');
  console.log("Has suggestions?", hasSuggestions);

  // 检查 DOM
  const addMarks = document.querySelectorAll('.tiptap-suggestion-add');
  const deleteMarks = document.querySelectorAll('.tiptap-suggestion-delete');
  console.log("Add marks:", addMarks.length);
  console.log("Delete marks:", deleteMarks.length);
}, 100);
```

## 立即测试步骤

### 快速验证修复

1. **打开浏览器控制台**

2. **执行测试命令**:
   ```javascript
   // 在控制台执行
   const editor = window.editor; // 假设 editor 是全局的

   // 手动创建一个有明显 diff 的测试
   editor.commands.applyAISuggestion(
     "Hello world",
     "Hello beautiful world with AI enhancements",
     0,
     11,
     "test-group"
   );

   // 检查结果
   console.log(editor.getHTML());
   ```

3. **预期看到**:
   - HTML 中包含 `<span data-suggestion-type="add">` 标签
   - 绿色高亮显示添加的文本
   - 如果原文有被删除的部分，会有红色删除线

### 如果还是看不到标记

**检查清单**:

```javascript
// 1. 检查 editor schema 是否有 suggestion mark
console.log(editor.schema.marks.suggestion); // 应该存在

// 2. 检查存储
console.log(editor.storage.suggestion); // 应该有 activeDiffId 等

// 3. 检查当前文档中的 marks
editor.state.doc.descendants((node, pos) => {
  const marks = node.marks.filter(m => m.type.name === 'suggestion');
  if (marks.length > 0) {
    console.log('Found suggestion at', pos, marks);
  }
});

// 4. 强制 UI 更新
suggestionManager.registerGroup('test-group');
suggestionUI.show();
```

## 推荐行动

### 立即执行（5分钟）

**修复 simulateAIRewrite 函数** - 使其产生明显、确定性的变化：

```typescript
// src/main.ts:218
function simulateAIRewrite(text: string): string {
  // 确定性转换，确保测试时有明显的 diff
  let result = text
    .replace(/collaboration/gi, "teamwork and collaboration")
    .replace(/editor/gi, "advanced editor")
    .replace(/demo/gi, "demonstration")
    .replace(/using/gi, "powered by");

  // 如果没有匹配到任何替换，添加明显的后缀
  if (result === text) {
    result = text.replace(/\.$/, " with AI enhancements.");
    if (result === text) {
      result = text + " (AI enhanced)";
    }
  }

  return result;
}
```

### 中期目标（1小时）

1. **添加调试模式**：在 UI 中显示 diff 详情
2. **改进选区处理**：确保完整选中段落
3. **添加视觉反馈**：加载状态、成功/失败提示

### 长期目标（Phase 2）

1. **集成真实 AI**：使用 DeepSeek API
2. **Token-based Diff**：Phase 2 实现格式保留
3. **E2E 测试**：自动化测试 AI suggestion 工作流

## 总结

### 好消息 ✅
- **Fragment 错误已完全修复** - 这是最严重的 blocker
- 代码结构正确，只需改进测试数据
- CSS 样式完整，UI 组件存在

### 需要改进 ⚠️
- **simulateAIRewrite 产生的 diff 太小**
- 随机性导致测试不可靠
- 需要更明显的视觉变化来验证功能

### 下一步 🎯
1. 修改 `simulateAIRewrite` 产生明显的确定性变化
2. 测试并验证绿色/红色标记显示
3. 准备集成 Phase 1 PoC 的 DeepSeek API

---

**状态**: 🟡 部分完成 - Fragment 错误已修复，需要改进测试体验
**优先级**: P1 - 影响用户测试体验
**预计修复时间**: 5-10分钟
