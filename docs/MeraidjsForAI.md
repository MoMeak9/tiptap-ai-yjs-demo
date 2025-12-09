# 架构深度：基于 Tiptap 与 LLM 的上下文感知型 Mermaid 智能图表生成系统技术白皮书

## 1. 执行摘要与系统愿景

在当代企业级知识管理和协作平台中，富文本编辑器（Rich Text Editor, RTE）正经历着从单纯的内容录入工具向智能辅助创作平台的范式转移。传统的文档编辑体验往往割裂了文本叙述与可视化表达，用户在撰写复杂的系统架构、业务流程或逻辑时序时，不得不中断写作心流，切换至 Visio、Lucidchart 或其他绘图工具进行创作，随后以静态图片的形式回插至文档。这种非线性的工作流不仅降低了生产效率，更导致了图表内容与文本描述的"语义脱节"——图表一旦生成便成为死数据，难以随着文本的迭代而自动更新。

Mermaid.js 的出现通过"代码即图表"（Diagram-as-Code）的理念极大地缓解了这一问题，但在实际工程实践中，Mermaid 语法的学习曲线依然构成了显著的用户门槛。随着大语言模型（Large Language Models, LLM）在自然语言理解（NLU）和代码生成（Code Generation）领域的突破性进展，构建一个能够理解用户自然语言意图、自动提取上下文逻辑并实时生成 Mermaid 图表的智能系统已成为可能。

本技术报告旨在提供一份详尽的、专家级的实施方案，深入探讨基于 **Tiptap (ProseMirror)** 编辑器框架，结合 **LLM（如 GPT-4o, Claude 3.5 Sonnet）** 与 **Mermaid.js** 渲染引擎的端到端技术架构。报告将超越基础的功能实现，深入剖析 **上下文感知算法（Context Awareness Algorithm）**、**流式数据传输（Streaming Data Transfer）**、**节点视图生命周期管理（Node View Lifecycle Management）** 以及 **协同编辑环境下的冲突消解** 等进阶技术难题。

本方案的核心价值主张在于通过技术手段消弭"文本"与"图表"之间的认知鸿沟，实现从非结构化文本到结构化可视化的无缝流转，从而提升企业知识库的表达力与维护性。

------

## 2. 系统架构设计与核心组件

### 2.1 整体架构蓝图

为了实现高响应、高可用且具备上下文感知能力的图表生成系统，我们将架构划分为四个核心层级：**感知层（Editor & Selection Layer）**、**解析层（Context Analysis Layer）**、**推理层（AI Orchestration Layer）** 以及 **渲染层（Visualization Layer）**。

| **架构层级** | **核心组件**                      | **技术栈**                 | **职责描述**                                        |
| ------------ | --------------------------------- | -------------------------- | --------------------------------------------------- |
| **感知层**   | Tiptap Editor, Selection API      | ProseMirror, React/Vue     | 捕获用户交互，确定触发时机，定位选区坐标。          |
| **解析层**   | Context Extractor, Intl.Segmenter | TypeScript, Intl API       | 基于光标位置向外辐射，提取语义完整的上下文片段。    |
| **推理层**   | LLM Gateway, Prompt Engine        | OpenAI API, Claude API     | 组装 Prompt，执行推理，处理流式响应，进行语法纠错。 |
| **渲染层**   | Mermaid Block, Shadow DOM         | Mermaid.js, Web Components | 实时渲染图表，提供编辑与预览的交互界面，隔离样式。  |

### 2.2 Tiptap 与 ProseMirror 的数据模型基础

深入理解 Tiptap 的底层——ProseMirror 的数据模型是构建该系统的基石。ProseMirror 不像传统的 HTML 编辑器那样直接操作 DOM，而是维护了一个独立的数据结构（Document Model）。文档被表示为一棵树（Node Tree），每个节点（Node）包含内容（Content）和属性（Attributes）。

在实现 Mermaid 生成功能时，我们主要关注以下几个 ProseMirror 核心概念：

1. **ResolvedPos（解析位置）**：与简单的整数索引不同，`ResolvedPos` 提供了位置在文档树中的深度信息（Depth）、父节点信息（Parent）以及偏移量 1。这是我们进行上下文回溯的关键。
2. **Transaction（事务）**：ProseMirror 的状态更新是原子的。所有的变更（插入 Mermaid 节点、更新代码）都必须通过 Transaction 完成 3。在流式生成过程中，频繁的 Transaction 提交会导致性能瓶颈，因此需要设计特殊的更新策略。
3. **Node View（节点视图）**：这是连接 ProseMirror 数据层与浏览器 DOM 渲染层的桥梁。对于 Mermaid 这种非文本的复杂块级元素，必须自定义 Node View 来接管渲染逻辑 5。

------

## 3. 进阶上下文感知：从选区到语义场

用户在使用 AI 功能时，往往只会选中一个核心词（如"订单流程"），或者仅仅将光标停留在某个段落中。如果系统仅将选区内的文本发送给 AI，生成的结果将缺乏细节甚至完全错误。因此，构建一个智能的"上下文提取引擎"是本方案的核心竞争力。

### 3.1 基于 `ResolvedPos` 的层级遍历算法

为了获取高质量的上下文，我们需要从当前选区出发，向文档的"上级"和"四周"进行辐射检索。

#### 3.1.1 纵向回溯：理解文档结构

ProseMirror 的 `ResolvedPos` 对象提供了 `$pos.node(depth)` 方法，允许我们访问当前位置的所有祖先节点 1。

- **当前块级上下文（Block Context）**：通过 `$from.parent` 获取光标所在的最小文本块（如 Paragraph）。这是最直接的上下文。
- **容器级上下文（Container Context）**：如果光标位于列表（ListItem）或引用（Blockquote）中，AI 需要知道列表的层级关系。例如，在生成类图时，列表项往往代表类的属性或方法，而列表的父级文本可能定义了类名。我们需要通过 `$from.node($from.depth - 1)` 向上回溯，直到找到非列表的容器为止。
- **文档大纲（Global Outline）**：为了让 AI 理解当前内容在全文中的位置，我们应提取文档中的所有 Headings（H1-H6）。通过遍历文档树（`doc.descendants`），构建一个简化的目录树 7。这能帮助 AI 判断当前是在"数据库设计"章节还是"API 接口"章节，从而调整生成图表的侧重点（如 ER 图 vs 时序图）。

#### 3.1.2 横向扩展：语义边界探测

仅仅依靠 DOM 节点的边界是不够的，用户意图往往跨越节点。我们需要向前后搜索相关的文本节点。

- **兄弟节点聚合**：利用 `$pos.index(depth)` 获取当前节点在父容器中的索引，进而访问 `nodeBefore` 和 `nodeAfter` 8。例如，在描述一个流程时，用户可能分多个段落书写。算法应尝试聚合前后各 2-3 个段落的文本，直到遇到明确的分隔符（如 Heading 或 Horizontal Rule）。
- **智能文本截断**：为避免超出 LLM 的 Context Window，需要对提取的文本进行加权截断。距离光标越近的文本权重越高，保留完整度越高；距离越远的仅保留摘要或关键句。

### 3.2 基于 `Intl.Segmenter` 的高精度句子识别

在处理用户的不精确选区（如只选中了半个句子）时，必须将选区自动扩展到完整的语义边界。传统的基于正则表达式的句子分割（如 `split('.')`）在处理多语言（特别是中文、日文不使用空格分词的语言）或包含复杂标点（如 "e.g."、"Dr."）的文本时表现极差 9。

本方案强烈推荐使用浏览器原生的 **`Intl.Segmenter` API** 11。这是一个高性能、国际化感知的文本分割工具。

**实施策略：**

1. **实例化分割器**：`const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });`。这里的 `locale` 应动态获取自 Tiptap 的配置或浏览器环境。
2. **定位边界**：获取包含选区的完整段落文本，调用 `segmenter.segment(text)`。
3. **扩展算法**：
   - 遍历分割出的 Segments。
   - 找到包含 `selection.from` 的 Segment，将其 `index` 作为新的起始点。
   - 找到包含 `selection.to` 的 Segment，将其 `index + length` 作为新的结束点。
   - 利用 `TextSelection.create` 创建新的选区，或者仅在发送给 AI 的 Prompt 中使用扩展后的文本，而不改变编辑器 UI 中的选区（以免干扰用户）10。

这种方法确保了 AI 接收到的是完整的陈述句，从而极大地降低了语义理解的幻觉率。

### 3.3 数据结构：Prompt Context Payload

最终，传递给推理层的数据包应包含以下结构化信息：

JSON

```
{
  "focus_text": "选区内的核心文本",
  "surrounding_context": "扩展后的前后段落文本，用于解析指代关系（如'该系统'指代什么）",
  "document_hierarchy": ["H1: 系统架构", "H2: 订单模块"],
  "user_instruction": "用户输入的额外指令（如'生成时序图'）"
}
```

------

## 4. 推理层：Mermaid 专属的 Prompt Engineering

Mermaid.js 是一种对语法极其敏感的领域特定语言（DSL）。与生成 Python 或 JavaScript 不同，Mermaid 的渲染器容错率极低，一个非法的括号或关键字冲突就会导致渲染失败。因此，Prompt Engineering 在此处的首要任务是**防御性生成（Defensive Generation）**。

### 4.1 思维链（CoT）与双路径强化

直接要求 LLM 输出 Mermaid 代码往往会导致逻辑跳跃，生成的图表结构混乱。研究表明，采用 **思维链（Chain-of-Thought, CoT）** 策略可以显著提升复杂逻辑可视化的准确性 14。

双路径强化（Dual-Path Reinforcement）策略：

我们要求 LLM 在输出代码之前，先用自然语言进行"视觉规划"。

**System Prompt 模板设计：**

> **Role**: You are a Senior System Architect and Mermaid.js Expert.
>
> **Objective**: Translate the provided technical text into a valid Mermaid.js diagram.
>
> **Process (Must Follow)**:
>
> 1. **Analysis Phase**: Identify all Entities (Actors, Systems, Classes) and Relationships (Data flows, Dependencies) in the text. Explicitly list them.
> 2. **Logic Mapping**: Determine the most appropriate diagram type (Flowchart, Sequence, State, ER). Explain why.
> 3. **Code Generation**: Output the Mermaid code block.
>
> **Constraints**:
>
> - **Syntax Strictness**: Node IDs must contain only alphanumeric characters and underscores (e.g., `Node_A`, not `Node A`). Use labels for display text: `Node_A["Node A"]`.16
> - **Direction**: Always specify diagram direction (e.g., `graph TD` or `graph LR`) for flowcharts.
> - **Escaping**: Ensure all label text is properly quoted if it contains special characters.
> - **No Hallucination**: Do not invent steps not present in the text, but you may infer logical connections implied by context.

这种"先思考，后编码"的模式利用自然语言作为中间层，消除了文本歧义，使生成的结构更加稳固 15。

### 4.2 结构化输出与 JSON Schema

为了进一步降低解析错误，建议强制 LLM 返回结构化的 JSON 数据，而非纯文本。OpenAI 的 **Structured Outputs** 功能在此处极为适用 18。

**Schema 定义：**

JSON

```
{
  "type": "object",
  "properties": {
    "analysis": { "type": "string", "description": "The logic analysis and entity extraction" },
    "diagram_type": { "type": "string", "enum": ["flowchart", "sequence", "class", "state", "gantt", "er"] },
    "mermaid_code": { "type": "string", "description": "The pure Mermaid.js code, without markdown backticks" },
    "title": { "type": "string", "description": "A concise title for the diagram" }
  },
  "required": ["analysis", "diagram_type", "mermaid_code"]
}
```

通过这种方式，前端可以直接读取 `mermaid_code` 字段，无需编写脆弱的正则表达式来去除 Markdown 标记或解析自然语言废话 19。

### 4.3 语法纠错与自动修复（Self-Healing）

即便有完美的 Prompt，LLM 仍可能生成错误的语法（例如在 flowchart 中使用了 sequence diagram 的箭头）。系统必须具备**自动修复能力**。

**闭环修复流程**：

1. **预检（Pre-flight Check）**：在前端接收到代码后，先调用 `mermaid.parse(code)` 进行静默验证 21。
2. **捕获错误**：如果 `parse` 抛出异常，捕获具体的错误信息（Error Message）。
3. **递归修复**：将 **错误的 Mermaid 代码** + **Mermaid 解析器的报错信息** 作为一个新的 Prompt 发送回 LLM。
   - *Prompt*："The following Mermaid code failed to render with error: `{error_msg}`. Please fix the syntax constraints and return the corrected code."
4. **重试**：通常 1 次重试即可修复 95% 的语法微瑕疵 23。只有在重试失败后，才向用户展示错误 UI。

------

## 5. 前端渲染层：自定义 Node View 实现

在 Tiptap 中，默认的 `CodeBlock` 节点不足以支撑 Mermaid 的富交互需求。我们需要创建一个自定义的 `MermaidBlock`，它具有"双重形态"：源码编辑态与图表预览态。

### 5.1 节点架构设计 (Schema Definition)

首先，在 ProseMirror Schema 中定义 `mermaidBlock`。该节点应被设计为 **Block Atom**（原子块），意味着它在文档结构中是一个不可分割的整体，光标无法进入其内部进行常规文本编辑（除非通过特定的交互）25。

TypeScript

```
Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true, // 关键：原子化
  draggable: true, // 允许拖拽
  addAttributes() {
    return {
      code: { default: 'graph TD\nA --> B[End]' },
      status: { default: 'idle' } // idle, loading, error
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent)
  }
})
```

### 5.2 React Node View 的核心实现

Node View 是 Tiptap 与 UI 框架（React/Vue）的结合点。对于 Mermaid，核心挑战在于**异步渲染**与**DOM 隔离**。

#### 5.2.1 异步渲染管线

Mermaid 的渲染是异步的（`mermaid.render` 返回 Promise）。在 React 组件中，我们需要管理渲染生命周期，避免在数据流快速变化时（如 AI 流式输出）频繁触发重绘。

**渲染逻辑优化：**

1. **防抖（Debounce）**：AI 流式输出速度很快（每秒数十 Token）。如果每次 Token 到达都触发 `mermaid.render`，会导致浏览器主线程阻塞。必须引入 300ms-500ms 的防抖机制 27。
2. **Shadow DOM 隔离**：Mermaid 生成的 SVG 包含大量类名和 ID。为了防止不同图表间的样式冲突（ID 碰撞是常见问题），或者编辑器自身的 CSS 污染图表，建议将渲染结果放入 **Shadow DOM** 中 29。
3. **唯一 ID 生成**：每次调用 `mermaid.render` 必须传入唯一的 ID，否则 Mermaid 可能会复用缓存或导致渲染混乱。

#### 5.2.2 性能优化的关键：`ignoreMutation`

这是 ProseMirror 集成 React 最棘手的深水区。当 Mermaid 异步更新 DOM（插入 SVG）时，ProseMirror 的 `MutationObserver` 会侦测到这次 DOM 变更。由于这次变更不是由 ProseMirror 的 Transaction 触发的，ProseMirror 会认为 DOM 与数据模型不一致，从而尝试"修复"它（通常是销毁并重建节点），这会导致图表闪烁或状态丢失。

**解决方案**：在 Node View 配置中显式定义 `ignoreMutation`。

JavaScript

```
// 在 addNodeView 返回配置中
ignoreMutation: (mutation) => {
  // 如果变动发生在图表预览区域，告诉 ProseMirror "忽略它，我知道我在做什么"
  // 仅当变动触及节点本身的结构属性时才返回 false
  return true; 
}
```

通过这种方式，我们划定了一块"法外之地"，由 React 和 Mermaid 完全接管，ProseMirror 不再干涉其内部 DOM 结构 30。

### 5.3 流式数据传输（Streaming）与侧信道更新

当 AI 正在逐字生成 Mermaid 代码时，如何将其实时推送到编辑器中而不阻塞 UI 线程？

错误做法：在流的每个 Chunk 到达时，调用 editor.commands.updateAttributes(...)。

后果：这将触发 ProseMirror 的 Transaction 机制 -> 更新 State -> 触发 dispatch -> React 重新渲染整个编辑器视图。在高频流式场景下，这会导致 FPS 骤降，编辑器卡顿。

推荐做法：侧信道（Side-Channel）更新

我们将 AI 的流式数据暂存在 Node View 组件的 Local State 中，仅在流结束或节流（Throttle）时间点同步到 ProseMirror Document。

1. **启动阶段**：插入一个空的 `MermaidBlock`，标记 `status='loading'`。
2. **流式阶段**：
   - AI 的 Chunk 通过 Event Bus 或 Context 传递给 React 组件。
   - 组件内部使用 `useState` 或 `useRef` 更新代码缓冲区。
   - 组件内部显示"正在生成..."的动态效果或实时渲染（如果防抖允许）。
   - **此时不提交 Transaction**。ProseMirror 认为文档没有变化。
3. **完成/节流阶段**：
   - 每隔 1-2 秒，或者在流结束时，调用一次 `updateAttributes` 将缓冲区的内容"落盘"到 ProseMirror 文档模型中。
   - 这确保了撤销栈（Undo History）不会被数千个字符级的变更填满，用户按一次 Ctrl+Z 就能撤销整段生成的代码 32。

------

## 6. 交互体验设计与协同考量

### 6.1 UI/UX 交互模式

- **Slash Command 集成**：用户输入 `/mermaid` 或 `/chart` 唤起。支持参数化指令，如 `/chart 登录流程`，系统自动将"登录流程"作为 Prompt 的一部分 35。
- **Bubble Menu 智能推荐**：当用户选中一段包含"步骤"、"流程"、"首先...然后"等特征词的文本时，Bubble Menu 自动出现"转化为图表"按钮。这需要一个轻量级的本地正则分类器 37。
- **双模态编辑**：
  - **预览态**：展示渲染后的 SVG。提供"下载图片"、"复制 Mermaid 代码"按钮。
  - **编辑态**：双击图表进入。左侧显示 Mermaid 源码编辑器（集成简单的语法高亮），右侧实时预览。利用 `NodeViewWrapper` 和 `NodeViewContent` 实现布局 39。

### 6.2 协同编辑（Collaborative Editing）下的挑战

如果编辑器集成了 Y.js 进行实时协作，AI 生成会带来新的复杂性。

- **原子性问题**：如果用户 A 触发了 AI 生成，正在流式写入；用户 B 此时删除了该节点。这会导致流式写入报错或写入错误的位置。
- **解决方案**：
  - 在流式写入期间，对该 Node 施加一个临时的 **Decoration（装饰器）** 锁，或者在 Y.js 层面标记该节点为"占用状态"。
  - 使用 `Mapping` 技术：在流式写入的每一步，都要将初始的 `pos` 通过 `tr.mapping.map(pos)` 映射到当前文档版本的最新位置，以应对并发修改导致的坐标偏移 3。

### 6.3 安全性考量

Mermaid 渲染是基于浏览器端的，若 AI 被恶意 Prompt 注入（Prompt Injection），可能会生成包含 XSS 攻击向量的代码（例如在节点标签中嵌入 `<script>` 或 `javascript:` 链接）。

**防御措施**：

1. **配置安全级别**：初始化 Mermaid 时设置 `securityLevel: 'strict'` 17。
2. **DOMPurify**：在将 SVG 注入 DOM 之前，使用 DOMPurify 对 SVG 字符串进行二次清洗，确保不包含执行脚本。

------

## 7. 性能基准与优化总结

在实施该方案时，需关注以下性能指标与优化手段：

| **性能指标**       | **潜在瓶颈**     | **优化策略**                                                 |
| ------------------ | ---------------- | ------------------------------------------------------------ |
| **TTFB (AI 响应)** | LLM 推理延迟     | 使用流式传输（Streaming），让用户在 1s 内看到首字。          |
| **FPS (编辑器)**   | 高频 Transaction | 侧信道更新（Side-Channel），React Local State 缓冲，节流同步。 |
| **渲染耗时**       | 复杂图表计算     | 防抖（Debounce），Web Worker（将 Mermaid 计算移出主线程，需 Webpack 配置支持）。 |
| **内存占用**       | 大量 SVG 节点    | 虚拟滚动（Virtual Scrolling），不可见时销毁 Mermaid 实例。   |

## 8. 结论

本技术报告展示了在 Tiptap 生态中构建"上下文感知 Mermaid 生成系统"的全景图。通过深度利用 ProseMirror 的 `ResolvedPos` 进行高维上下文提取，结合 `Intl.Segmenter` 进行精准语义分割，利用 LLM 的 Prompt Engineering 与结构化输出保障代码质量，最后通过自定义 React Node View 与侧信道流式技术解决渲染与性能矛盾，我们能够为用户提供一种流畅、智能且专业的图表创作体验。这不仅是编辑器功能的累加，更是向"意图驱动开发"（Intent-Driven Development）迈出的坚实一步。
