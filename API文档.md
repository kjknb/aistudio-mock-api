# AIGC 创作平台 (AIStudio) — 接口文档

> **版本**: v1.0.0  
> **Base URL**: `http://localhost:3000`  
> **协议**: HTTPS (Mock 环境为 HTTP)  
> **认证**: Bearer Token (OAuth2 密码模式)  
> **更新时间**: 2025-04-07

---

## 1. 平台概述

AIStudio 是一个 AIGC 创作平台，集成多家第三方 AI 提供商（OpenAI、Anthropic、Midjourney 等），提供文本生成、图像生成、多轮对话等能力。

### 1.1 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "timestamp": "2025-04-07T05:41:00.000Z",
  "requestId": "a1b2c3d4"
}
```

### 1.2 错误码

| Code | HTTP Status | 含义 |
|------|-------------|------|
| 0 | 200/201/202 | 成功 |
| 400 | 400 | 参数错误 |
| 401 | 401 | 未认证 / Token 无效或过期 |
| 403 | 403 | 无权限 |
| 404 | 404 | 资源不存在 |
| 409 | 409 | 资源冲突（重复注册） |
| 429 | 429 | 配额超限 |
| 500 | 500 | 服务器错误 |

### 1.3 认证方式

登录后获取 `access_token`，在 Header 中携带：

```
Authorization: Bearer <access_token>
```

Token 有效期 2 小时，过期后通过 `refresh_token` 刷新。

### 1.4 分页

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| pageSize | int | 10 | 每页条数（最大100） |

```json
{
  "list": [...],
  "pagination": { "page": 1, "pageSize": 10, "total": 50, "totalPages": 5 }
}
```

### 1.5 核心调用链路

```
┌──────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│ 登录  │────▶│ 获取模型  │────▶│ 提交任务   │────▶│ 轮询状态  │────▶│ 获取结果  │
│ 鉴权  │     │ 选择配置  │     │ 生成内容   │     │ 等待完成  │     │ 展示使用  │
└──────┘     └──────────┘     └───────────┘     └──────────┘     └──────────┘
   1.1           2.1              4.1/4.2          4.3              4.3 result
```

---

## 2. 模块一：认证模块 (5 个接口)

### 2.1 用户注册

```
POST /api/v1/auth/register
```

| 字段 | 类型 | 必填 | 校验规则 |
|------|------|------|----------|
| username | string | ✅ | 3-20 字符 |
| password | string | ✅ | ≥8位，含大小写字母+数字 |
| email | string | ✅ | 邮箱格式 |
| nickname | string | ❌ | 昵称 |

**请求示例**

```json
{
  "username": "newuser01",
  "password": "Test1234",
  "email": "newuser@example.com",
  "nickname": "新用户"
}
```

**成功 201**: 返回用户信息（不含密码）

**失败场景**

| Code | Message | 触发条件 |
|------|---------|----------|
| 400 | 密码需至少8位，包含大小写字母和数字 | 密码不符合规则 |
| 409 | 用户名已被注册 | username 重复 |

---

### 2.2 用户登录

```
POST /api/v1/auth/login
```

模拟 OAuth2 密码模式，返回 `access_token` + `refresh_token`。

**请求**

```json
{
  "username": "creator01",
  "password": "Aa123456"
}
```

**成功 200**

```json
{
  "code": 0,
  "data": {
    "access_token": "a1b2c3d4e5f6...",
    "refresh_token": "f6e5d4c3b2a1...",
    "token_type": "Bearer",
    "expires_in": 7200,
    "user": {
      "id": "u_002",
      "username": "creator01",
      "nickname": "创意达人",
      "plan": "pro",
      "quota": {
        "dailyTokens": 100000,
        "dailyImages": 100,
        "usedTokens": 32500,
        "usedImages": 18
      }
    }
  }
}
```

---

### 2.3 刷新 Token

```
POST /api/v1/auth/refresh
```

**请求**

```json
{ "refresh_token": "f6e5d4c3b2a1..." }
```

**成功 200**: 返回新的 `access_token`

---

### 2.4 退出登录

```
POST /api/v1/auth/logout
```

需携带 Bearer Token。使当前 access_token 失效。

---

### 2.5 获取用户信息

```
GET /api/v1/user/profile
```

需携带 Bearer Token。返回完整用户信息 + 配额。

---

## 3. 模块二：模型模块 (3 个接口)

### 3.1 模型列表

```
GET /api/v1/models
```

**Query 参数**

| 参数 | 说明 | 可选值 |
|------|------|--------|
| type | 模型类型 | `text`, `image` |
| provider | 提供商 | `OpenAI`, `Anthropic`, `Xiaomi`, `Midjourney`, `StabilityAI`, `BlackForestLabs` |
| status | 状态 | `active`, `beta`, `deprecated` |
| tags | 标签（逗号分隔） | `文本`, `图片`, `代码`, `艺术`, `中文` 等 |

**成功 200**: 返回模型列表（不含详细参数schema）

---

### 3.2 模型详情

```
GET /api/v1/models/:id
```

返回完整模型信息，包括参数 schema。

**示例响应**

```json
{
  "id": "m_img_01",
  "name": "DALL·E 3",
  "provider": "OpenAI",
  "type": "image",
  "pricing": { "per_image": 0.04 },
  "parameters": {
    "size": { "type": "select", "default": "1024x1024", "options": ["1024x1024", "1792x1024", "1024x1792"] },
    "quality": { "type": "select", "default": "standard", "options": ["standard", "hd"] },
    "style": { "type": "select", "default": "vivid", "options": ["vivid", "natural"] }
  },
  "status": "active"
}
```

---

### 3.3 模型可用性检查

```
GET /api/v1/models/:id/status
```

返回模型实时状态、延迟、队列长度、可用率。

```json
{
  "modelId": "m_text_01",
  "status": "active",
  "available": true,
  "latency": "120ms",
  "queueLength": 3,
  "uptime": "99.97%"
}
```

---

## 4. 模块三：项目模块 (4 个接口)

项目是组织创作内容的容器，任务可以关联到项目。

### 4.1 创建项目

```
POST /api/v1/projects
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 项目名（≤50字符） |
| description | string | ❌ | 描述 |

### 4.2 项目列表

```
GET /api/v1/projects?page=1&pageSize=10
```

### 4.3 项目详情

```
GET /api/v1/projects/:id
```

返回项目信息 + 关联的任务摘要列表。

### 4.4 删除项目

```
DELETE /api/v1/projects/:id
```

---

## 5. 模块四：任务/生成模块 (6 个接口) ⭐核心链路

### 5.1 提交文本生成任务

```
POST /api/v1/generate/text
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| modelId | string | ✅ | 模型ID（须为text类型） |
| prompt | string | ✅ | 提示词 |
| parameters | object | ❌ | 模型参数（temperature, max_tokens 等） |
| projectId | string | ❌ | 关联项目ID |

**请求示例**

```json
{
  "modelId": "m_text_01",
  "prompt": "写一首关于春天的诗",
  "parameters": {
    "temperature": 0.9,
    "max_tokens": 2048
  },
  "projectId": "proj_002"
}
```

**成功 202 (异步)**

```json
{
  "code": 0,
  "message": "任务已提交",
  "data": {
    "taskId": "task_a1b2c3d4",
    "status": "processing",
    "estimatedTime": "3-5秒"
  }
}
```

---

### 5.2 提交图像生成任务

```
POST /api/v1/generate/image
```

参数同文本任务，`modelId` 须为 image 类型模型。

**请求示例**

```json
{
  "modelId": "m_img_01",
  "prompt": "一只在月球上喝茶的猫，水彩画风格",
  "parameters": {
    "size": "1792x1024",
    "quality": "hd",
    "style": "natural"
  }
}
```

---

### 5.3 查询任务状态（轮询接口）⭐

```
GET /api/v1/tasks/:taskId
```

**核心轮询接口**。前端需按 `polling.interval` 间隔反复调用直到 `status` 变为 `completed` 或 `failed`。

**processing 状态响应**

```json
{
  "taskId": "task_a1b2c3d4",
  "status": "processing",
  "progress": 50,
  "polling": { "interval": 1000, "nextRetry": 1000, "retryAfter": 1 }
}
```

**completed 状态响应（文本）**

```json
{
  "taskId": "task_a1b2c3d4",
  "status": "completed",
  "progress": 100,
  "type": "text",
  "result": {
    "text": "根据您的需求，我为您准备了以下内容...",
    "finish_reason": "stop",
    "tokenUsage": { "prompt": 15, "completion": 280, "total": 295 }
  },
  "cost": 0.001,
  "completedAt": "2025-04-07T05:41:05.000Z"
}
```

**completed 状态响应（图像）**

```json
{
  "taskId": "task_a1b2c3d4",
  "status": "completed",
  "progress": 100,
  "type": "image",
  "result": {
    "images": [{
      "url": "https://picsum.photos/seed/xxx/1024/1024",
      "width": 1024,
      "height": 1024,
      "format": "png",
      "revised_prompt": "..."
    }]
  },
  "cost": 0.04
}
```

**任务状态流转**

```
processing ──▶ completed
     │
     └──────▶ failed
     │
     └──────▶ cancelled (用户主动取消)
```

---

### 5.4 任务列表

```
GET /api/v1/tasks?page=1&pageSize=10&status=completed&type=image&projectId=proj_001
```

| 参数 | 说明 |
|------|------|
| status | `processing` / `completed` / `failed` / `cancelled` |
| type | `text` / `image` |
| projectId | 按项目筛选 |

---

### 5.5 取消任务

```
PUT /api/v1/tasks/:taskId/cancel
```

仅 `processing` 状态的任务可取消。

---

### 5.6 删除任务

```
DELETE /api/v1/tasks/:taskId
```

---

## 6. 模块五：对话模块 (2 个接口)

### 6.1 多轮对话（兼容 OpenAI Chat Completions 格式）

```
POST /api/v1/chat/completions
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| modelId | string | ✅ | 模型ID |
| messages | array | ✅ | 对话消息数组 |
| messages[].role | string | ✅ | `system` / `user` / `assistant` |
| messages[].content | string | ✅ | 消息内容 |
| parameters | object | ❌ | 模型参数 |

**请求示例**

```json
{
  "modelId": "m_text_01",
  "messages": [
    { "role": "system", "content": "你是一个专业的技术顾问" },
    { "role": "user", "content": "解释一下Docker和虚拟机的区别" }
  ],
  "parameters": { "temperature": 0.7 }
}
```

**成功 200**

```json
{
  "id": "chatcmpl-abc123",
  "model": "GPT-4o",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "Docker 和虚拟机的主要区别在于..." },
    "finish_reason": "stop"
  }],
  "usage": { "prompt_tokens": 25, "completion_tokens": 312, "total_tokens": 337 },
  "created": 1712470860
}
```

---

### 6.2 对话历史

```
GET /api/v1/chat/history?page=1&pageSize=20&modelId=m_text_01
```

---

## 7. 模块六：用量模块 (2 个接口)

### 7.1 配额与用量

```
GET /api/v1/usage/quota
```

```json
{
  "plan": "pro",
  "quota": {
    "dailyTokens": 100000,
    "dailyImages": 100,
    "usedTokens": 32500,
    "usedImages": 18
  },
  "usage": {
    "today": { "tasks": 5, "tokens": 32500, "images": 18, "cost": "0.72" },
    "allTime": { "tasks": 156, "cost": "23.45" }
  }
}
```

### 7.2 用量统计

```
GET /api/v1/usage/stats?period=7d
```

`period`: `7d` / `30d` / `90d`

返回每日的任务数、Token消耗、图片数、费用。

---

## 8. 预置数据

### 测试账号

| 用户名 | 密码 | 昵称 | 套餐 | 配额 |
|--------|------|------|------|------|
| admin | Aa123456 | 平台管理员 | enterprise | 100万Token/日, 500图/日 |
| creator01 | Aa123456 | 创意达人 | pro | 10万Token/日, 100图/日 |
| trial_user | Aa123456 | 试用用户 | free | 1万Token/日, 10图/日 |

### 可用模型

| ID | 名称 | 提供商 | 类型 |
|----|------|--------|------|
| m_text_01 | GPT-4o | OpenAI | text |
| m_text_02 | Claude 3.5 Sonnet | Anthropic | text |
| m_text_03 | MiMo-V2-Pro | Xiaomi | text |
| m_img_01 | DALL·E 3 | OpenAI | image |
| m_img_02 | Midjourney V6 | Midjourney | image |
| m_img_03 | Stable Diffusion XL | StabilityAI | image |
| m_img_04 | Flux.1 Pro | BlackForestLabs | image (beta) |

---

## 9. 自动化测试场景建议

### 9.1 端到端核心链路（最核心）

```
POST /auth/login
  → GET /models?status=active
  → GET /models/:id
  → POST /generate/image (提交任务)
  → GET /tasks/:id (轮询，直到 completed)
  → GET /tasks/:id (获取最终结果)
```

### 9.2 完整创作流程

```
登录 → 创建项目 → 提交文本任务 → 轮询完成
  → 提交图像任务 → 轮询完成 → 查看项目详情（含所有任务）
```

### 9.3 多轮对话链路

```
POST /chat/completions (第1轮)
  → POST /chat/completions (第2轮，带上下文)
  → POST /chat/completions (第3轮)
  → GET /chat/history
```

### 9.4 认证异常测试

| 场景 | 预期 |
|------|------|
| 不带 Token 访问受保护接口 | 401 |
| Token 过期 | 401 + message "访问令牌已过期" |
| 用 refresh_token 换新 access_token | 200 + 新 token |
| 密码错误登录 | 401 |
| 弱密码注册 | 400 + 密码规则提示 |

### 9.5 配额限制测试

| 场景 | 预期 |
|------|------|
| free 用户 Token 配额耗尽提交任务 | 429 "今日Token配额已用完" |
| free 用户图片配额耗尽提交任务 | 429 "今日图片配额已用完" |
| 查询 quota 接口 | 正确返回已用/总量 |

### 9.6 业务异常测试

| 场景 | 预期 |
|------|------|
| 用 text 模型提交图像任务 | 400 "不是图像模型" |
| 取消已完成的任务 | 400 "当前状态无法取消" |
| 查询不存在的任务 | 404 |
| 注册已存在的用户名 | 409 |

### 9.7 异步任务轮询

测试要点：
- 按 `polling.interval` 间隔轮询
- 任务从 `processing` → `completed` 状态变化
- `progress` 字段从 0 → 100 递增
- 最终 `result` 字段包含完整生成内容
- `cost` 字段在完成时计算
