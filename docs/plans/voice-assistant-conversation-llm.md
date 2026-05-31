# 计划：对话式语音助手 + DeepSeek LLM 接入

## 1. 范围边界

### 1.1 做什么

1. **前端 UI 改造**：将现有 `VoicePage` + `VoiceModal` 改为**对话式聊天界面**
   - 用户消息在右侧气泡，助手消息在左侧气泡（带头像）
   - 助手消息中可嵌入**操作卡片**（创建/更新/删除事件等）
   - 操作卡片显示事件详情，带确认/放弃按钮
   - 底部固定输入区：麦克风按钮 + 文字输入（可选）+ "处理中..." 状态
   - 支持连续多轮对话，同一页面内完成

2. **后端 LLM 接入**：接入 DeepSeek API，替代纯规则引擎做**意图识别 + 槽位提取**
   - 使用 DeepSeek Chat API（`deepseek-chat` 模型）
   - LLM 输出结构化 JSON，前端/后端据此渲染操作卡片或执行操作
   - 支持**一句话多事件拆分**（如"明天上午开会下午喝咖啡"拆为 2 个创建操作）
   - 支持**上下文引用**（如"会议时间更新为后天"能关联到最近创建的事件）

3. **对话接口**：新增 `POST /assistant/chat` 统一对话入口
   - 接收用户消息 + 对话上下文 + 用户最近事件列表
   - 返回助手回复文本 + 结构化操作列表
   - 支持 `tool_choice` / function calling 模式（如 DeepSeek 支持）

4. **操作执行**：现有 `/drafts`、`/events` API 不变，前端根据助手返回的操作调用对应 API
   - `create` → 走 `POST /drafts` + `POST /drafts/{id}/confirm`
   - `update` → 走 `PUT /events/{id}`
   - `delete` → 走 `DELETE /events/{id}`
   - `query` → 走 `GET /events`（前端本地已有事件列表，也可直接过滤展示）

### 1.2 不做什么（明确排除）

- 不实现服务端对话持久化（MVP 阶段对话上下文由前端维护）
- 不替换现有的 `chrono-node` 规则解析器，而是**LLM 优先 + 规则兜底**（后续可切换）
- 不改动现有 ASR/TTS 链路（阿里云 NLS 继续工作）
- 不实现 VAD 自动停录（仍用手动按住/松开）
- 不做 RAG / 向量检索（用户事件直接作为 prompt 上下文传入）
- 不做多模态（图片/文件输入）

---

## 2. 代码映射

### 2.1 新增文件

#### API 层

| 文件 | 职责 |
|---|---|
| `packages/api/src/integrations/llm/types.ts` | LLM Provider 接口定义（`LlmProvider`） |
| `packages/api/src/integrations/llm/deepseek-provider.ts` | DeepSeek API 调用实现（含 token 计数、错误处理） |
| `packages/api/src/services/assistant/assistant.service.ts` | 核心对话服务：构建 prompt、调用 LLM、解析操作、上下文管理 |
| `packages/api/src/services/assistant/prompts.ts` | System prompt、工具定义（functions schema） |
| `packages/api/src/http/routes/assistant.ts` | `POST /assistant/chat` 路由 |

#### Schemas 层

| 文件 | 职责 |
|---|---|
| `packages/schemas/src/v1/assistant.ts` | `AssistantChatRequest`、`AssistantChatResponse`、`ChatMessage`、`AssistantAction` 等 Zod schema |

#### Web 层

| 文件 | 职责 |
|---|---|
| `packages/web/src/components/ChatAssistant.tsx` | 对话助手主页面（替换现有 VoicePage） |
| `packages/web/src/components/ChatMessageBubble.tsx` | 消息气泡组件（用户/助手） |
| `packages/web/src/components/ChatActionCard.tsx` | 操作卡片组件（创建/更新/删除事件确认卡片） |
| `packages/web/src/components/ChatInputBar.tsx` | 底部输入栏（麦克风 + 文本输入 + 处理中状态） |
| `packages/web/src/hooks/useAssistantChat.ts` | `POST /assistant/chat` 调用 + 对话状态管理 |
| `packages/web/src/lib/assistant-actions.ts` | 前端操作执行映射（根据 action 类型调用 drafts/events API） |

### 2.2 修改文件

| 文件 | 改动点 |
|---|---|
| `packages/web/src/App.tsx` | 替换 `VoicePage` 为新的 `ChatAssistant`；`handleVoiceTranscript` 逻辑改为发送消息到对话 |
| `packages/web/src/components/VoiceModal.tsx` | **废弃或简化**：仅保留录音 + ASR 功能，作为 `ChatInputBar` 的子组件调用 |
| `packages/web/src/lib/api-client.ts` | 新增 `sendAssistantMessage()` 方法 |
| `packages/schemas/src/v1/index.ts` | 导出 assistant schema |
| `packages/api/src/index.ts` | 注册 `assistant` 路由 |
| `packages/api/src/config/runtime.ts` | 新增 `DEEPSEEK_API_KEY` 配置读取 |
| `docs/api-spec.md` | 补充 `/assistant/chat` 接口契约 |
| `docs/modules/api.md` | 更新模块范围：新增对话助手 + LLM 辅助解析 |

### 2.3 删除/废弃

- `packages/web/src/pages/VoicePage.tsx`（如有独立页面）→ 合并到 ChatAssistant
- `packages/web/src/lib/voice-ui.ts` 中的快捷指令硬编码 → 由 LLM 动态识别

---

## 3. 文档映射

| 文档 | 更新内容 |
|---|---|
| `docs/api-spec.md` | 新增 §4.x `Assistant` 接口：`POST /assistant/chat` 的请求/响应结构、错误码 |
| `docs/modules/api.md` | 更新模块范围：LLM 辅助解析纳入当前阶段；更新任务拆分 |
| `docs/prd.md` | 如有产品范围变化需同步（本计划不收缩范围，只加速落地 LLM 辅助） |
| `packages/api/AGENTS.md` | 如有新增目录边界说明则更新 |

---

## 4. 接口变化

### 4.1 新增：`POST /assistant/chat`

**请求体：**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "明天下午三点和张总在国贸喝咖啡",
      "type": "voice"
    }
  ],
  "timezone": "Asia/Shanghai",
  "referenceAt": "2026-05-30T01:00:00.000Z",
  "recentEvents": [
    {
      "id": "evt_xxx",
      "title": "周会",
      "startTime": "2026-05-31T02:00:00.000Z",
      "location": null
    }
  ]
}
```

**成功响应：**

```json
{
  "data": {
    "reply": {
      "role": "assistant",
      "content": "我识别到了 1 个可执行操作（创建），请确认是否执行："
    },
    "actions": [
      {
        "id": "act_001",
        "type": "create",
        "status": "pending",
        "eventDraft": {
          "title": "喝咖啡",
          "startAt": "2026-05-31T07:00:00.000Z",
          "endAt": null,
          "timezone": "Asia/Shanghai",
          "location": "国贸",
          "participants": ["张总"]
        }
      }
    ],
    "needsConfirmation": true
  }
}
```

**多事件拆分响应示例：**

```json
{
  "data": {
    "reply": {
      "role": "assistant",
      "content": "我识别到了 2 个可执行操作（创建），请确认："
    },
    "actions": [
      {
        "id": "act_001",
        "type": "create",
        "status": "pending",
        "eventDraft": { "title": "开会", "startAt": "...", ... }
      },
      {
        "id": "act_002",
        "type": "create",
        "status": "pending",
        "eventDraft": { "title": "喝咖啡", "startAt": "...", ... }
      }
    ],
    "needsConfirmation": true
  }
}
```

**上下文修改响应示例（用户说"会议时间更新为后天"）：**

```json
{
  "data": {
    "reply": {
      "role": "assistant",
      "content": "已将「周会」的时间更新为后天同一时间，请确认："
    },
    "actions": [
      {
        "id": "act_003",
        "type": "update",
        "status": "pending",
        "targetEventId": "evt_xxx",
        "changes": {
          "startTime": "2026-06-02T02:00:00.000Z"
        }
      }
    ],
    "needsConfirmation": true
  }
}
```

**错误响应：**

| 错误码 | 场景 |
|---|---|
| `LLM_UNAVAILABLE` | DeepSeek API 调用失败 |
| `LLM_PARSE_ERROR` | LLM 返回非预期格式 |
| `RATE_LIMITED` | 触发限流 |

### 4.2 DeepSeek 调用参数

```ts
const response = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [systemPrompt, ...historyMessages, userMessage],
    tools: assistantTools,  // function definitions
    tool_choice: 'auto',
    response_format: { type: 'json_object' }, // 当不需要 tool call 时约束为 JSON
  }),
})
```

### 4.3 工具（Function）定义

| 工具名 | 用途 | 参数 |
|---|---|---|
| `create_event` | 创建事件草稿 | `title`, `startAt`, `endAt?`, `location?`, `participants?[]`, `timezone` |
| `update_event` | 更新已有事件 | `eventId` 或 `eventReference`（如"刚才的会议"）, `changes` |
| `delete_event` | 删除事件 | `eventId` 或 `eventReference` |
| `query_events` | 查询日程 | `timeRange?`, `keyword?` |
| `ask_clarify` | 向用户提问 | `question` |

LLM 返回 `tool_calls` 时，后端将其转换为 `actions` 数组返回给前端；返回普通文本时作为闲聊回复。

---

## 5. 验收标准

### 5.1 功能验收

- [ ] 打开语音助手页面，呈现聊天界面（消息列表 + 底部输入区）
- [ ] 按住麦克风说话，ASR 转写后作为用户消息发送到对话
- [ ] 助手回复消息气泡，若包含操作则展示操作卡片
- [ ] 操作卡片显示：类型标签（创建/更新/删除）、事件详情（标题、时间、地点）、确认/放弃按钮
- [ ] 点击确认后，前端调用对应 API 执行，执行完成后在卡片上显示"已执行"状态
- [ ] 支持一句话多事件：如"明天上午开会下午喝咖啡"，助手返回 2 个独立的创建卡片
- [ ] 支持上下文修改：先创建一个会议，然后说"会议时间更新为后天"，助手能正确识别并返回更新卡片
- [ ] LLM 不可用时，降级为规则解析 + 通用提示（不阻塞用户）
- [ ] 语音反馈（TTS）在对话模式下仍可用：助手回复后自动播报

### 5.2 接口验收

- [ ] `POST /assistant/chat` 200 返回结构符合上述契约
- [ ] `POST /assistant/chat` 在 DeepSeek API 异常时返回 `LLM_UNAVAILABLE`（503）
- [ ] Schema 校验通过 `pnpm --filter @vocalendar/schemas check`
- [ ] API 类型检查通过 `pnpm --filter @vocalendar/api check`

### 5.3 构建验收

- [ ] `pnpm --filter @vocalendar/web build` 成功
- [ ] `pnpm --filter @vocalendar/api build` 成功
- [ ] `pnpm check` 根目录通过

---

## 6. 依赖与阻塞

### 6.1 当前依赖（已具备）

- ✅ ASR/TTS 链路（阿里云 NLS）
- ✅ JWT 认证
- ✅ Drafts / Events CRUD API
- ✅ WebSocket realtime（可用于推送 draft.clarification）
- ✅ React + Tailwind 前端技术栈

### 6.2 外部依赖

- **DeepSeek API Key**：需要用户配置 `DEEPSEEK_API_KEY` 到 `.env`
- **DeepSeek API 可用性**：依赖第三方服务稳定性，需做超时和降级

### 6.3 潜在阻塞

| 风险 | 缓解措施 |
|---|---|
| DeepSeek API 调用延迟高（>3s） | 前端先展示"处理中..."，后端设置 10s 超时 |
| DeepSeek 返回格式不稳定 | 使用 `response_format: { type: 'json_object' }` + Zod 严格校验 + 失败时降级规则解析 |
| Token 消耗过高 | 限制 `recentEvents` 传入数量（最多 10 条），限制对话历史轮数（最多 6 轮） |
| 中文时间表达歧义 | 保留 `chrono-node` 作为后端二次校验/兜底 |

### 6.4 实现顺序建议

```
Step 1: 后端 scaffold
  - DeepSeek provider + types
  - Assistant service + prompts
  - POST /assistant/chat 路由
  - Schema 定义

Step 2: 后端联调
  - 用 curl/Postman 测试 DeepSeek 返回
  - 校验 action 解析正确性
  - 降级逻辑验证

Step 3: 前端 UI
  - ChatAssistant 页面框架
  - ChatMessageBubble 组件
  - ChatActionCard 组件
  - ChatInputBar（整合现有录音逻辑）

Step 4: 前端联调
  - 对接 /assistant/chat
  - 操作确认 → 调用 drafts/events API
  - TTS 播报集成

Step 5: 端到端测试 + 文档更新
```

---

## 7. 配置变更

新增环境变量：

```env
# DeepSeek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com  # 可选，默认官方地址
DEEPSEEK_MODEL=deepseek-chat  # 可选，默认 deepseek-chat
```

---

## 8. 安全与合规

- `DEEPSEEK_API_KEY` 仅存储在服务端 `.env`，不暴露给前端
- 用户事件数据作为 prompt 上下文传入 LLM，需确认 DeepSeek 无训练保留（DeepSeek API 声明不用于训练）
- 对话历史不持久化到数据库，仅在请求周期内存在于内存
