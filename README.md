# AnimalAgent

一个支持多轮对话、联网检索、信源标注、流式输出和后端会话保存的动物专业科普知识查询智能体。

## 架构

当前实现保留零依赖运行方式，但已经按后续持久化扩展拆分为前后端结构：

```text
animalAgent/
  backend/
    config/              # 环境变量与路径配置
    prompts/             # 动物专家系统提示词
    repositories/        # 会话仓储层，当前为 JSON 文件存储
    routes/              # API 路由
    services/            # LLM、Search、Chat、Title 业务服务
    utils/               # HTTP、SSE、静态文件工具
  frontend/
    src/
      components/        # 侧栏、聊天窗口渲染
      services/          # API 与 SSE 客户端
      utils/             # Markdown 渲染工具
  public/                # HTML 和 CSS
  data/                  # 运行后生成 conversations.json
```

后续要接 SQLite/Postgres 时，优先替换 `backend/repositories/conversationRepository.js`，业务层和前端 API 可以保持不变。

## 功能

- **物种百科精准检索**：输出英文名、拉丁学名、习性、食性、栖息地、IUCN 保护现状和演化特点。
- **趣味行为学解码**：从演化动机、行为生态学和动物心理学角度解释动物行为。
- **跨物种对比分析**：对比相似动物时使用 Markdown 表格。
- **生态链与环境关联**：说明物种的生态位、食物链位置和数量变化影响。
- **联网搜索与信源标注**：回答前调用 Search API，提示词强制使用 `[1]`、`[2]` 标注来源。
- **流式输出**：通过 SSE 输出打字机效果。
- **后端会话保存**：会话保存到 `data/conversations.json`，刷新浏览器仍然存在。
- **旧会话迁移**：首次打开新版页面时，会把旧版浏览器本地会话迁移到后端存储。
- **多会话侧栏**：左侧可新建、切换、清空和删除对话。

## 启动

```bash
copy .env.example .env
npm run dev
```

打开：

```text
http://localhost:3010
```

## 环境变量

模型接口：

- `ANIMAL_AGENT_API_KEY`：OpenAI 兼容接口密钥。也会回退读取 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。
- `ANIMAL_AGENT_BASE_URL`：OpenAI 兼容接口地址，默认 `https://api.deepseek.com/v1`。
- `ANIMAL_AGENT_MODEL`：模型名，默认 `deepseek-chat`。
- `ANIMAL_AGENT_TEMPERATURE`：回答创造性，默认 `0.4`。

联网搜索：

- `SEARCH_PROVIDER`：`tavily`、`serper`、`brave` 或 `off`。
- `SEARCH_API_KEY`：Search API Key。也可使用 `TAVILY_API_KEY`、`SERPER_API_KEY`、`BRAVE_SEARCH_API_KEY`。
- `SEARCH_MAX_RESULTS`：检索结果数量，默认 `5`，最大 `8`。
- `SEARCH_TIMEOUT_MS`：检索超时时间，默认 `10000`。

存储：

- `STORAGE_PROVIDER`：当前为 `json`。后续可扩展为 `sqlite` 或 `postgres`。

服务：

- `PORT`：服务端口，默认 `3010`。

## API

- `GET /api/conversations`：获取会话列表。
- `POST /api/conversations`：创建会话。
- `POST /api/conversations/import`：导入旧版本地会话。
- `GET /api/conversations/:id`：获取单个会话详情。
- `DELETE /api/conversations/:id`：删除会话。
- `POST /api/conversations/:id/clear`：清空当前会话。
- `POST /api/conversations/:id/chat/stream`：向指定会话发送消息，并通过 SSE 返回流式回答。
- `POST /api/chat`：兼容旧版非持久化问答接口。
- `POST /api/title`：兼容旧版标题生成接口。

SSE 事件：

- `status`：当前阶段。
- `sources`：联网搜索结果。
- `delta`：模型增量文本。
- `done`：完成，返回最新会话。
- `error`：错误信息。
