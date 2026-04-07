const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// ==================== Middleware ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id,X-Platform');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ==================== Helpers ====================
const now = () => new Date().toISOString();
const genId = (prefix = '') => prefix + crypto.randomBytes(8).toString('hex');
const success = (data, message = 'success', requestId) => ({ code: 0, message, data, timestamp: now(), requestId: requestId || uuidv4().slice(0, 8) });
const fail = (code, message, data, requestId) => ({ code, message, data: data || null, timestamp: now(), requestId: requestId || uuidv4().slice(0, 8) });

function paginate(arr, page = 1, pageSize = 10) {
  const p = Math.max(1, Number(page));
  const ps = Math.min(100, Math.max(1, Number(pageSize)));
  return {
    list: arr.slice((p - 1) * ps, p * ps),
    pagination: { page: p, pageSize: ps, total: arr.length, totalPages: Math.ceil(arr.length / ps) }
  };
}

// ==================== Mock Database ====================
const db = {
  users: [
    { id: 'u_001', username: 'admin', password: 'Aa123456', email: 'admin@aistudio.ai', nickname: '平台管理员', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', role: 'admin', plan: 'enterprise', quota: { dailyTokens: 1000000, dailyImages: 500, usedTokens: 0, usedImages: 0 }, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'u_002', username: 'creator01', password: 'Aa123456', email: 'creator@example.com', nickname: '创意达人', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator', role: 'user', plan: 'pro', quota: { dailyTokens: 100000, dailyImages: 100, usedTokens: 32500, usedImages: 18 }, createdAt: '2025-02-15T10:00:00Z' },
    { id: 'u_003', username: 'trial_user', password: 'Aa123456', email: 'trial@example.com', nickname: '试用用户', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=trial', role: 'user', plan: 'free', quota: { dailyTokens: 10000, dailyImages: 10, usedTokens: 9800, usedImages: 8 }, createdAt: '2025-03-20T08:00:00Z' },
  ],
  tokens: {},
  models: [
    { id: 'm_text_01', name: 'GPT-4o', provider: 'OpenAI', type: 'text', description: '最新的多模态大语言模型，支持文本生成、代码编写、推理分析', maxTokens: 128000, pricing: { input: 0.005, output: 0.015, unit: 'per_1k_tokens' }, parameters: { temperature: { type: 'number', default: 0.7, min: 0, max: 2, step: 0.1 }, top_p: { type: 'number', default: 1, min: 0, max: 1, step: 0.05 }, max_tokens: { type: 'integer', default: 4096, min: 1, max: 128000 }, system_prompt: { type: 'string', default: 'You are a helpful assistant.' } }, status: 'active', tags: ['文本', '代码', '推理'], createdAt: '2025-01-01T00:00:00Z' },
    { id: 'm_text_02', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', type: 'text', description: '擅长长文本理解、创意写作和代码生成', maxTokens: 200000, pricing: { input: 0.003, output: 0.015, unit: 'per_1k_tokens' }, parameters: { temperature: { type: 'number', default: 0.7, min: 0, max: 1, step: 0.1 }, max_tokens: { type: 'integer', default: 4096, min: 1, max: 200000 } }, status: 'active', tags: ['文本', '长上下文', '创意'], createdAt: '2025-01-15T00:00:00Z' },
    { id: 'm_text_03', name: 'MiMo-V2-Pro', provider: 'Xiaomi', type: 'text', description: '小米自研大语言模型，中文理解能力强', maxTokens: 32000, pricing: { input: 0.001, output: 0.003, unit: 'per_1k_tokens' }, parameters: { temperature: { type: 'number', default: 0.7, min: 0, max: 2, step: 0.1 }, top_p: { type: 'number', default: 0.95, min: 0, max: 1, step: 0.05 } }, status: 'active', tags: ['文本', '中文'], createdAt: '2025-03-01T00:00:00Z' },
    { id: 'm_img_01', name: 'DALL·E 3', provider: 'OpenAI', type: 'image', description: '高质量图像生成，支持多种尺寸和风格', pricing: { per_image: 0.04 }, parameters: { size: { type: 'select', default: '1024x1024', options: ['1024x1024', '1792x1024', '1024x1792'] }, quality: { type: 'select', default: 'standard', options: ['standard', 'hd'] }, style: { type: 'select', default: 'vivid', options: ['vivid', 'natural'] } }, status: 'active', tags: ['图片', '艺术', '写实'], createdAt: '2025-01-01T00:00:00Z' },
    { id: 'm_img_02', name: 'Midjourney V6', provider: 'Midjourney', type: 'image', description: '顶级艺术风格图像生成，擅长概念艺术和插画', pricing: { per_image: 0.05 }, parameters: { aspect_ratio: { type: 'select', default: '1:1', options: ['1:1', '16:9', '9:16', '4:3', '3:4'] }, stylize: { type: 'number', default: 100, min: 0, max: 1000, step: 10 }, chaos: { type: 'number', default: 0, min: 0, max: 100, step: 5 } }, status: 'active', tags: ['图片', '艺术', '插画'], createdAt: '2025-01-10T00:00:00Z' },
    { id: 'm_img_03', name: 'Stable Diffusion XL', provider: 'StabilityAI', type: 'image', description: '开源图像生成模型，支持自定义风格迁移', pricing: { per_image: 0.02 }, parameters: { width: { type: 'integer', default: 1024, min: 512, max: 2048, step: 64 }, height: { type: 'integer', default: 1024, min: 512, max: 2048, step: 64 }, steps: { type: 'integer', default: 30, min: 10, max: 100 }, cfg_scale: { type: 'number', default: 7, min: 1, max: 20, step: 0.5 } }, status: 'active', tags: ['图片', '开源', '风格迁移'], createdAt: '2025-02-01T00:00:00Z' },
    { id: 'm_img_04', name: 'Flux.1 Pro', provider: 'BlackForestLabs', type: 'image', description: '新一代高保真图像生成，文字渲染精准', pricing: { per_image: 0.03 }, parameters: { aspect_ratio: { type: 'select', default: '1:1', options: ['1:1', '16:9', '9:16', '3:2', '2:3'] }, seed: { type: 'integer', default: null, min: 0, max: 4294967295 } }, status: 'beta', tags: ['图片', '高保真', '文字渲染'], createdAt: '2025-03-15T00:00:00Z' },
  ],
  projects: [
    { id: 'proj_001', userId: 'u_002', name: '品牌海报系列', description: '为Q2新品发布会制作的AI海报', coverImage: 'https://picsum.photos/seed/proj1/400/300', resultCount: 12, createdAt: '2025-03-20T10:00:00Z', updatedAt: '2025-04-01T15:30:00Z' },
    { id: 'proj_002', userId: 'u_002', name: '产品文案助手', description: '利用GPT-4o生成产品描述文案', coverImage: 'https://picsum.photos/seed/proj2/400/300', resultCount: 45, createdAt: '2025-03-25T09:00:00Z', updatedAt: '2025-04-05T11:00:00Z' },
  ],
  tasks: [
    { id: 'task_001', userId: 'u_002', projectId: 'proj_001', modelId: 'm_img_01', type: 'image', prompt: '一只戴着墨镜的柴犬站在东京街头，赛博朋克风格，霓虹灯', parameters: { size: '1024x1024', quality: 'hd', style: 'vivid' }, status: 'completed', progress: 100, result: { images: [{ url: 'https://picsum.photos/seed/task001/1024/1024', width: 1024, height: 1024, format: 'png', revised_prompt: 'A Shiba Inu wearing sunglasses standing on a Tokyo street, cyberpunk style with neon lights' }] }, error: null, tokenUsage: null, cost: 0.04, createdAt: '2025-04-01T10:00:00Z', startedAt: '2025-04-01T10:00:02Z', completedAt: '2025-04-01T10:00:15Z' },
    { id: 'task_002', userId: 'u_002', projectId: 'proj_002', modelId: 'm_text_01', type: 'text', prompt: '为一款智能手表写一段200字的产品介绍文案，突出健康监测和长续航', parameters: { temperature: 0.8, max_tokens: 1024 }, status: 'completed', progress: 100, result: { text: '在快节奏的都市生活中，时间与健康同样珍贵。这款智能手表搭载全新一代生物传感器，支持24小时心率监测、血氧饱和度检测和睡眠质量分析，让您随时掌握身体状态。14天超长续航，一次充电轻松覆盖两周使用，告别频繁充电的烦恼。1.43英寸AMOLED高清屏幕，细腻显示每一个通知与数据。IP68级防水，无论是雨中晨跑还是游泳池畔，都从容应对。科技赋能生活，从腕间开始。', finish_reason: 'stop', tokenUsage: { prompt: 45, completion: 168, total: 213 } }, error: null, cost: 0.001065, createdAt: '2025-04-02T14:00:00Z', startedAt: '2025-04-02T14:00:01Z', completedAt: '2025-04-02T14:00:04Z' },
    { id: 'task_003', userId: 'u_002', projectId: 'proj_001', modelId: 'm_img_02', type: 'image', prompt: '未来城市天际线，太阳能飞行汽车穿梭，透明建筑，极简主义插画风格', parameters: { aspect_ratio: '16:9', stylize: 500 }, status: 'completed', progress: 100, result: { images: [{ url: 'https://picsum.photos/seed/task003/1792/1024', width: 1792, height: 1024, format: 'png' }] }, error: null, tokenUsage: null, cost: 0.05, createdAt: '2025-04-03T09:00:00Z', startedAt: '2025-04-03T09:00:03Z', completedAt: '2025-04-03T09:00:35Z' },
  ],
  history: [
    { id: 'hist_001', userId: 'u_002', type: 'text', modelId: 'm_text_01', modelProvider: 'OpenAI', messages: [{ role: 'user', content: '解释一下量子计算的基本原理' }, { role: 'assistant', content: '量子计算是一种利用量子力学原理进行信息处理的计算范式。与经典计算机使用比特（0或1）不同，量子计算机使用量子比特（qubit），它可以同时处于0和1的叠加态...' }], tokenUsage: { prompt: 12, completion: 356, total: 368 }, cost: 0.0054, createdAt: '2025-04-01T08:30:00Z' },
    { id: 'hist_002', userId: 'u_002', type: 'text', modelId: 'm_text_03', modelProvider: 'Xiaomi', messages: [{ role: 'user', content: '用Python写一个快速排序算法' }, { role: 'assistant', content: '```python\ndef quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quick_sort(left) + middle + quick_sort(right)\n```' }], tokenUsage: { prompt: 10, completion: 89, total: 99 }, cost: 0.000099, createdAt: '2025-04-02T11:00:00Z' },
  ],
};

// ==================== Auth Middleware ====================
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !db.tokens[token]) {
    return res.status(401).json(fail(401, '未登录或访问令牌无效'));
  }
  const t = db.tokens[token];
  if (Date.now() > t.expiresAt) {
    delete db.tokens[token];
    return res.status(401).json(fail(401, '访问令牌已过期，请重新登录'));
  }
  req.userId = t.userId;
  req.user = db.users.find(u => u.id === t.userId);
  next();
}

// ==================== Task Processing Simulator ====================
function simulateTaskProcessing(taskId) {
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Simulate processing stages
  const stages = task.type === 'image'
    ? [{ delay: 1000, progress: 20, msg: '解析提示词...' }, { delay: 3000, progress: 50, msg: '生成中...' }, { delay: 5000, progress: 80, msg: '优化细节...' }, { delay: 2000, progress: 100, msg: 'completed' }]
    : [{ delay: 500, progress: 30, msg: '理解问题...' }, { delay: 1500, progress: 70, msg: '生成回答...' }, { delay: 1000, progress: 100, msg: 'completed' }];

  let elapsed = 0;
  stages.forEach(stage => {
    setTimeout(() => {
      if (task.status === 'cancelled') return;
      task.progress = stage.progress;
      if (stage.progress === 100) {
        task.status = 'completed';
        task.completedAt = now();
        // Generate mock result
        if (task.type === 'image') {
          task.result = { images: [{ url: `https://picsum.photos/seed/${taskId}/1024/1024`, width: 1024, height: 1024, format: 'png', revised_prompt: task.prompt }] };
          task.cost = db.models.find(m => m.id === task.modelId)?.pricing?.per_image || 0.03;
        } else {
          const responses = ['根据您的需求，我为您准备了以下内容：\n\n这是一个由AI生成的文本示例。在实际使用中，这里会返回模型根据您的提示词生成的高质量文本内容。内容会根据您设定的温度、最大token数等参数进行调整。', '以下是为您生成的回答：\n\n这是一个模拟的AI回复。该回复会根据不同的模型和参数设置呈现不同的风格和长度。在真实场景中，GPT-4o、Claude等模型会返回富有创造力和逻辑性的回复。'];
          task.result = { text: responses[Math.floor(Math.random() * responses.length)], finish_reason: 'stop', tokenUsage: { prompt: Math.floor(Math.random() * 50) + 10, completion: Math.floor(Math.random() * 300) + 50, total: 0 } };
          task.result.tokenUsage.total = task.result.tokenUsage.prompt + task.result.tokenUsage.completion;
          task.cost = 0.001;
        }
      }
    }, elapsed + stage.delay);
    elapsed += stage.delay;
  });
}

// ================================================================
//                    API ROUTES
// ================================================================

// ==================== MODULE 0: HEALTH ====================

app.get('/api/health', (req, res) => {
  res.json(success({ status: 'ok', version: '1.0.0', uptime: process.uptime(), modules: ['auth', 'model', 'project', 'task', 'chat', 'usage'] }));
});

// ==================== MODULE 1: AUTH (5 APIs) ====================

// 1.1 用户注册
app.post('/api/v1/auth/register', (req, res) => {
  const { username, password, email, nickname } = req.body;
  if (!username || !password || !email) return res.status(400).json(fail(400, '缺少必填字段：username, password, email'));
  if (username.length < 3 || username.length > 20) return res.status(400).json(fail(400, '用户名长度需为3-20个字符'));
  if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(password)) return res.status(400).json(fail(400, '密码需至少8位，包含大小写字母和数字'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json(fail(400, '邮箱格式不正确'));
  if (db.users.find(u => u.username === username)) return res.status(409).json(fail(409, '用户名已被注册'));
  if (db.users.find(u => u.email === email)) return res.status(409).json(fail(409, '邮箱已被注册'));

  const user = { id: 'u_' + genId(), username, password, email, nickname: nickname || username, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, role: 'user', plan: 'free', quota: { dailyTokens: 10000, dailyImages: 10, usedTokens: 0, usedImages: 0 }, createdAt: now() };
  db.users.push(user);
  const { password: _, ...safe } = user;
  res.status(201).json(success(safe, '注册成功'));
});

// 1.2 用户登录（OAuth2 密码模式模拟）
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password, grant_type } = req.body;
  if (!username || !password) return res.status(400).json(fail(400, '请输入用户名和密码'));

  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json(fail(401, '用户名或密码错误'));

  const accessToken = uuidv4().replace(/-/g, '');
  const refreshToken = uuidv4().replace(/-/g, '');
  const expiresIn = 7200; // 2h

  db.tokens[accessToken] = { userId: user.id, type: 'access', expiresAt: Date.now() + expiresIn * 1000 };
  db.tokens[refreshToken] = { userId: user.id, type: 'refresh', expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 };

  const { password: _, quota, ...safeUser } = user;
  res.json(success({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    user: { ...safeUser, quota: user.quota }
  }));
});

// 1.3 刷新Token
app.post('/api/v1/auth/refresh', (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token || !db.tokens[refresh_token]) return res.status(401).json(fail(401, 'refresh_token无效'));

  const t = db.tokens[refresh_token];
  if (Date.now() > t.expiresAt) {
    delete db.tokens[refresh_token];
    return res.status(401).json(fail(401, 'refresh_token已过期'));
  }

  const newAccessToken = uuidv4().replace(/-/g, '');
  db.tokens[newAccessToken] = { userId: t.userId, type: 'access', expiresAt: Date.now() + 7200 * 1000 };
  res.json(success({ access_token: newAccessToken, token_type: 'Bearer', expires_in: 7200 }));
});

// 1.4 退出登录
app.post('/api/v1/auth/logout', auth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  delete db.tokens[token];
  res.json(success(null, '已退出登录'));
});

// 1.5 获取用户信息
app.get('/api/v1/user/profile', auth, (req, res) => {
  const { password: _, ...safe } = req.user;
  res.json(success({ ...safe, quota: req.user.quota }));
});

// ==================== MODULE 2: MODELS (3 APIs) ====================

// 2.1 获取模型列表
app.get('/api/v1/models', (req, res) => {
  const { type, provider, status, tags } = req.query;
  let list = [...db.models];
  if (type) list = list.filter(m => m.type === type);
  if (provider) list = list.filter(m => m.provider === provider);
  if (status) list = list.filter(m => m.status === status);
  if (tags) {
    const tagArr = tags.split(',');
    list = list.filter(m => tagArr.some(t => m.tags.includes(t)));
  }
  res.json(success(list.map(({ parameters, ...m }) => ({ ...m, parameterCount: Object.keys(parameters).length }))));
});

// 2.2 获取模型详情（含参数schema）
app.get('/api/v1/models/:id', (req, res) => {
  const model = db.models.find(m => m.id === req.params.id);
  if (!model) return res.status(404).json(fail(404, '模型不存在'));
  res.json(success(model));
});

// 2.3 模型可用性检查
app.get('/api/v1/models/:id/status', (req, res) => {
  const model = db.models.find(m => m.id === req.params.id);
  if (!model) return res.status(404).json(fail(404, '模型不存在'));

  const latency = Math.floor(Math.random() * 200) + 50;
  res.json(success({
    modelId: model.id,
    status: model.status,
    available: model.status === 'active',
    latency: `${latency}ms`,
    queueLength: Math.floor(Math.random() * 10),
    uptime: '99.97%',
    lastChecked: now()
  }));
});

// ==================== MODULE 3: PROJECTS (4 APIs) ====================

// 3.1 创建项目
app.post('/api/v1/projects', auth, (req, res) => {
  const { name, description } = req.body;
  if (!name || name.length > 50) return res.status(400).json(fail(400, '项目名称必填且不超过50字符'));

  const project = {
    id: 'proj_' + genId(), userId: req.userId, name,
    description: description || '', coverImage: `https://picsum.photos/seed/${Date.now()}/400/300`,
    resultCount: 0, createdAt: now(), updatedAt: now()
  };
  db.projects.push(project);
  res.status(201).json(success(project, '项目创建成功'));
});

// 3.2 项目列表
app.get('/api/v1/projects', auth, (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  const list = db.projects.filter(p => p.userId === req.userId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(success(paginate(list, page, pageSize)));
});

// 3.3 项目详情
app.get('/api/v1/projects/:id', auth, (req, res) => {
  const proj = db.projects.find(p => p.id === req.params.id && p.userId === req.userId);
  if (!proj) return res.status(404).json(fail(404, '项目不存在'));
  const tasks = db.tasks.filter(t => t.projectId === proj.id);
  res.json(success({ ...proj, tasks: tasks.map(t => ({ id: t.id, type: t.type, modelId: t.modelId, status: t.status, prompt: t.prompt.slice(0, 50) + '...', createdAt: t.createdAt })) }));
});

// 3.4 删除项目
app.delete('/api/v1/projects/:id', auth, (req, res) => {
  const idx = db.projects.findIndex(p => p.id === req.params.id && p.userId === req.userId);
  if (idx === -1) return res.status(404).json(fail(404, '项目不存在'));
  db.projects.splice(idx, 1);
  res.json(success(null, '项目已删除'));
});

// ==================== MODULE 4: TASKS / GENERATION (6 APIs) ====================

// 4.1 提交文本生成任务
app.post('/api/v1/generate/text', auth, (req, res) => {
  const { modelId, prompt, parameters = {}, projectId } = req.body;
  if (!modelId || !prompt) return res.status(400).json(fail(400, 'modelId 和 prompt 为必填项'));
  const model = db.models.find(m => m.id === modelId && m.type === 'text');
  if (!model) return res.status(400).json(fail(400, '模型不存在或不是文本模型'));

  // Quota check
  const user = db.users.find(u => u.id === req.userId);
  if (user.quota.usedTokens >= user.quota.dailyTokens) return res.status(429).json(fail(429, '今日Token配额已用完'));

  const task = {
    id: 'task_' + genId(), userId: req.userId, projectId: projectId || null, modelId,
    type: 'text', prompt, parameters, status: 'processing', progress: 0,
    result: null, error: null, tokenUsage: null, cost: 0,
    createdAt: now(), startedAt: now(), completedAt: null
  };
  db.tasks.push(task);
  simulateTaskProcessing(task.id);
  res.status(202).json(success({ taskId: task.id, status: task.status, estimatedTime: '3-5秒' }, '任务已提交'));
});

// 4.2 提交图像生成任务
app.post('/api/v1/generate/image', auth, (req, res) => {
  const { modelId, prompt, parameters = {}, projectId } = req.body;
  if (!modelId || !prompt) return res.status(400).json(fail(400, 'modelId 和 prompt 为必填项'));
  const model = db.models.find(m => m.id === modelId && m.type === 'image');
  if (!model) return res.status(400).json(fail(400, '模型不存在或不是图像模型'));

  const user = db.users.find(u => u.id === req.userId);
  if (user.quota.usedImages >= user.quota.dailyImages) return res.status(429).json(fail(429, '今日图片配额已用完'));

  const task = {
    id: 'task_' + genId(), userId: req.userId, projectId: projectId || null, modelId,
    type: 'image', prompt, parameters, status: 'processing', progress: 0,
    result: null, error: null, tokenUsage: null, cost: 0,
    createdAt: now(), startedAt: now(), completedAt: null
  };
  db.tasks.push(task);
  simulateTaskProcessing(task.id);
  res.status(202).json(success({ taskId: task.id, status: task.status, estimatedTime: '10-30秒' }, '任务已提交'));
});

// 4.3 查询任务状态（轮询接口）
app.get('/api/v1/tasks/:id', auth, (req, res) => {
  const task = db.tasks.find(t => t.id === req.params.id && t.userId === req.userId);
  if (!task) return res.status(404).json(fail(404, '任务不存在'));

  const response = {
    taskId: task.id, type: task.type, modelId: task.modelId,
    status: task.status, progress: task.progress,
    prompt: task.prompt, parameters: task.parameters,
    result: task.result, error: task.error,
    tokenUsage: task.tokenUsage, cost: task.cost,
    createdAt: task.createdAt, startedAt: task.startedAt, completedAt: task.completedAt
  };

  // Add polling hint
  if (task.status === 'processing') {
    response.polling = { interval: 1000, nextRetry: 1000, retryAfter: 1 };
  }
  res.json(success(response));
});

// 4.4 任务列表
app.get('/api/v1/tasks', auth, (req, res) => {
  const { page = 1, pageSize = 10, status, type, projectId } = req.query;
  let list = db.tasks.filter(t => t.userId === req.userId);
  if (status) list = list.filter(t => t.status === status);
  if (type) list = list.filter(t => t.type === type);
  if (projectId) list = list.filter(t => t.projectId === projectId);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const result = paginate(list, page, pageSize);
  // Slim down for list view
  result.list = result.list.map(t => ({
    taskId: t.id, type: t.type, modelId: t.modelId, status: t.status, progress: t.progress,
    prompt: t.prompt.length > 60 ? t.prompt.slice(0, 60) + '...' : t.prompt,
    cost: t.cost, createdAt: t.createdAt, completedAt: t.completedAt
  }));
  res.json(success(result));
});

// 4.5 取消任务
app.put('/api/v1/tasks/:id/cancel', auth, (req, res) => {
  const task = db.tasks.find(t => t.id === req.params.id && t.userId === req.userId);
  if (!task) return res.status(404).json(fail(404, '任务不存在'));
  if (task.status !== 'processing') return res.status(400).json(fail(400, `当前状态 [${task.status}] 无法取消`));

  task.status = 'cancelled';
  task.completedAt = now();
  res.json(success({ taskId: task.id, status: 'cancelled' }, '任务已取消'));
});

// 4.6 删除任务
app.delete('/api/v1/tasks/:id', auth, (req, res) => {
  const idx = db.tasks.findIndex(t => t.id === req.params.id && t.userId === req.userId);
  if (idx === -1) return res.status(404).json(fail(404, '任务不存在'));
  db.tasks.splice(idx, 1);
  res.json(success(null, '任务已删除'));
});

// ==================== MODULE 5: CHAT / MULTI-TURN (2 APIs) ====================

// 5.1 多轮对话
app.post('/api/v1/chat/completions', auth, (req, res) => {
  const { modelId, messages, parameters = {} } = req.body;
  if (!modelId || !messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json(fail(400, 'modelId 和 messages 为必填项'));
  }
  const model = db.models.find(m => m.id === modelId && m.type === 'text');
  if (!model) return res.status(400).json(fail(400, '模型不存在或不是文本模型'));

  const lastMessage = messages[messages.length - 1];
  const mockResponses = [
    '这是一个模拟的多轮对话回复。在实际环境中，AI会根据对话历史和上下文生成连贯、有逻辑的回答。您可以继续追问，我会保持对话上下文。',
    '收到您的问题。让我分析一下：\n\n1. 首先，这个问题涉及到多个层面的考量\n2. 从技术角度来看，有几种常见的解决方案\n3. 建议根据具体场景选择最合适的方案\n\n需要我展开讲解某个方面吗？',
    '好的，我理解了您的需求。以下是建议的实现步骤：\n\n```python\n# 示例代码\ndef solve():\n    pass\n```\n\n如果需要更详细的实现，可以告诉我具体的约束条件。'
  ];

  const promptTokens = messages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0);
  const completionText = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  const completionTokens = Math.ceil(completionText.length / 4);

  const result = {
    id: 'chatcmpl-' + genId(),
    model: model.name,
    choices: [{ index: 0, message: { role: 'assistant', content: completionText }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
    created: Math.floor(Date.now() / 1000)
  };

  // Save to history
  db.history.push({
    id: 'hist_' + genId(), userId: req.userId, type: 'text', modelId,
    modelProvider: model.provider,
    messages: [...messages, { role: 'assistant', content: completionText }],
    tokenUsage: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
    cost: (promptTokens * model.pricing.input + completionTokens * model.pricing.output) / 1000,
    createdAt: now()
  });

  res.json(success(result));
});

// 5.2 对话历史
app.get('/api/v1/chat/history', auth, (req, res) => {
  const { page = 1, pageSize = 20, modelId } = req.query;
  let list = db.history.filter(h => h.userId === req.userId);
  if (modelId) list = list.filter(h => h.modelId === modelId);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(success(paginate(list, page, pageSize)));
});

// ==================== MODULE 6: USAGE & STATS (2 APIs) ====================

// 6.1 配额与用量
app.get('/api/v1/usage/quota', auth, (req, res) => {
  const user = req.user;
  const today = db.tasks.filter(t => t.userId === req.userId && t.createdAt.startsWith(now().slice(0, 10)));
  res.json(success({
    plan: user.plan,
    quota: user.quota,
    usage: {
      today: {
        tasks: today.length,
        tokens: today.reduce((s, t) => s + (t.result?.tokenUsage?.total || 0), 0),
        images: today.filter(t => t.type === 'image' && t.status === 'completed').length,
        cost: today.reduce((s, t) => s + t.cost, 0).toFixed(4)
      },
      allTime: {
        tasks: db.tasks.filter(t => t.userId === req.userId).length,
        cost: db.tasks.filter(t => t.userId === req.userId).reduce((s, t) => s + t.cost, 0).toFixed(4)
      }
    }
  }));
});

// 6.2 用量统计
app.get('/api/v1/usage/stats', auth, (req, res) => {
  const { period = '7d' } = req.query;
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const stats = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    stats.push({
      date: dateStr,
      tasks: Math.floor(Math.random() * 15),
      tokens: Math.floor(Math.random() * 50000),
      images: Math.floor(Math.random() * 20),
      cost: (Math.random() * 2).toFixed(4)
    });
  }
  res.json(success({ period, data: stats }));
});

// ==================== Error Handling ====================
app.use('/api/*', (req, res) => {
  res.status(404).json(fail(404, `接口 ${req.method} ${req.originalUrl} 不存在`));
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json(fail(400, '请求体JSON格式错误'));
  }
  res.status(500).json(fail(500, '服务器内部错误'));
});

// ==================== Start ====================
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║              AIGC 创作平台 (AIStudio) Mock Server             ║
  ║              http://localhost:${PORT}                            ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  [认证模块]                                                    ║
  ║  POST   /api/v1/auth/register          注册                   ║
  ║  POST   /api/v1/auth/login             登录                   ║
  ║  POST   /api/v1/auth/refresh           刷新Token              ║
  ║  POST   /api/v1/auth/logout            退出                   ║
  ║  GET    /api/v1/user/profile           用户信息               ║
  ║                                                               ║
  ║  [模型模块]                                                    ║
  ║  GET    /api/v1/models                 模型列表               ║
  ║  GET    /api/v1/models/:id             模型详情               ║
  ║  GET    /api/v1/models/:id/status      模型可用性             ║
  ║                                                               ║
  ║  [项目模块]                                                    ║
  ║  POST   /api/v1/projects               创建项目               ║
  ║  GET    /api/v1/projects               项目列表               ║
  ║  GET    /api/v1/projects/:id           项目详情               ║
  ║  DELETE /api/v1/projects/:id           删除项目               ║
  ║                                                               ║
  ║  [任务/生成模块]                                                ║
  ║  POST   /api/v1/generate/text          提交文本任务            ║
  ║  POST   /api/v1/generate/image         提交图像任务            ║
  ║  GET    /api/v1/tasks/:id              查询任务状态(轮询)      ║
  ║  GET    /api/v1/tasks                  任务列表                ║
  ║  PUT    /api/v1/tasks/:id/cancel       取消任务                ║
  ║  DELETE /api/v1/tasks/:id              删除任务                ║
  ║                                                               ║
  ║  [对话模块]                                                    ║
  ║  POST   /api/v1/chat/completions       多轮对话               ║
  ║  GET    /api/v1/chat/history           对话历史               ║
  ║                                                               ║
  ║  [用量模块]                                                    ║
  ║  GET    /api/v1/usage/quota            配额与用量             ║
  ║  GET    /api/v1/usage/stats            用量统计               ║
  ║                                                               ║
  ║  共 22 个接口 | 6 大模块                                       ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);
});
