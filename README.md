# AnimalAgent

动物专业科普知识查询智能体，支持多轮对话、联网检索、信源标注、流式输出和会话持久化。

## 本地启动

```bash
copy .env.example .env
npm install
npm run dev
```

打开：

```text
http://localhost:3010
```

本地默认使用 `STORAGE_PROVIDER=json`，会话保存在 `data/conversations.json`。

## Vercel 部署

项目结构已对齐 `singleAgent/weeklyReport`：

- `animalClient/index.html`：单文件静态前端。
- `animalServer/index.js`：Express 服务端入口。
- `backend/`：动物智能体业务服务层。
- `vercel.json`：把 `/api/*` 路由到 Express 服务，把其他路径路由到前端页面。

### 1. Vercel 项目设置

在 Vercel New Project 中：

```text
Root Directory: animalAgent
Framework Preset: Other
Build Command: 留空
Output Directory: 留空
Install Command: npm install
```

这个结构和 `singleAgent/weeklyReport` 类似：静态前端和 Express 服务端由 `vercel.json` 路由。

### 2. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 3. 进入项目目录

```bash
cd animalAgent
```

### 4. 配置环境变量

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

### 5. 部署

```bash
vercel
vercel --prod
```

Vercel 会按 `vercel.json` 路由：

- `/api/*` -> `animalServer/index.js`
- `/*` -> `animalClient/index.html`

## 架构

```text
animalAgent/
  animalClient/
    index.html                    # 静态前端，类似 weeklyReport/wrclient
  animalServer/
    index.js                      # Express 服务，类似 weeklyReport/wrserver
    package.json
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
