# AnimalAgent

动物专业科普知识查询智能体，支持多轮对话、联网检索、信源标注、流式输出和会话持久化。

## 本地启动

```bash
copy .env.example .env
npm run build
npm run dev
```

打开：

```text
http://localhost:3010
```

本地默认使用 `STORAGE_PROVIDER=json`，会话保存在 `data/conversations.json`。

## Vercel 部署

项目已经支持 Vercel：

- 静态页面由 `public/` 托管。
- 前端源码在 `frontend/src/`，部署前通过 `npm run build` 同步到 `public/src/`。
- API 入口是 `api/[...path].js`。
- 会话存储在 Vercel 上建议使用 Postgres。

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 进入项目目录

```bash
cd animalAgent
```

### 3. 配置环境变量

在 Vercel Dashboard 的 Project Settings -> Environment Variables 中添加：

```env
ANIMAL_AGENT_API_KEY=your_model_api_key
ANIMAL_AGENT_BASE_URL=https://api.deepseek.com/v1
ANIMAL_AGENT_MODEL=deepseek-chat
ANIMAL_AGENT_TEMPERATURE=0.4

SEARCH_PROVIDER=tavily
SEARCH_API_KEY=your_search_api_key
SEARCH_MAX_RESULTS=5
SEARCH_TIMEOUT_MS=10000

STORAGE_PROVIDER=postgres
```

再连接 Vercel Postgres 或 Neon Postgres。Vercel Postgres 会自动注入 `POSTGRES_URL` 等变量。

### 4. 部署

```bash
vercel
vercel --prod
```

Vercel 会执行：

```bash
npm run build
```

并把 `public/` 作为静态输出目录。

## 架构

```text
animalAgent/
  api/
    [...path].js                  # Vercel Function 入口
  backend/
    config/
    prompts/
    repositories/
      jsonConversationRepository.js
      postgresConversationRepository.js
      conversationRepository.js   # 按 STORAGE_PROVIDER 选择实现
    routes/
    services/
    utils/
  frontend/
    src/
      components/
      services/
      utils/
  public/
    index.html
    styles.css
    src/                          # npm run build 生成
```

## API

- `GET /api/health`
- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/conversations/import`
- `GET /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `POST /api/conversations/:id/clear`
- `POST /api/conversations/:id/chat/stream`
- `POST /api/chat`
- `POST /api/title`

SSE 事件：

- `status`：当前阶段
- `sources`：联网搜索结果
- `delta`：模型增量文本
- `done`：完成，返回最新会话
- `error`：错误信息

## 存储

本地：

```env
STORAGE_PROVIDER=json
```

Vercel：

```env
STORAGE_PROVIDER=postgres
```

Postgres 表会在首次调用时自动创建：

- `animal_conversations`
- `animal_messages`
