# 固件部署 404 问题排查指南

## 📋 问题现象

**错误信息：**
```
POST https://atmwater-backend.zeabur.app/api/firmware/upgrade 404 (Not Found)
```

**前端日志：**
```javascript
[API] Request URL: /api/firmware/upgrade
[API] Request method: post
[Deploy] Error: AxiosError: Request failed with status code 404
```

---

## 🔍 已确认的信息

### 1. 代码已正确修改 ✅

**文件：** `src/routes/firmwareRoutes.js`

**第 34 行：**
```javascript
router.post('/upgrade', createBatchUpgrade); // 前端兼容路由
```

**Git 提交：** `9c32ee0` (已推送到 GitHub)

### 2. 路由注册正确 ✅

**文件：** `server.js` 第 730 行

```javascript
app.use('/api/firmware', require('./src/routes/firmwareRoutes'));
```

**完整路径：** `POST /api/firmware/upgrade`

### 3. 控制器已兼容参数 ✅

**文件：** `src/controllers/firmwareController.js`

```javascript
const firmwareVersionId = req.body.firmwareVersionId || req.body.firmwareId;
const deviceIds = req.body.deviceIds || req.body.unitIds;
```

---

## 🎯 可能的原因

### 原因 1：Zeabur 缓存问题（最可能）

**症状：**
- 代码已推送到 GitHub
- Zeabur 显示部署成功
- 但 API 仍然返回 404

**原因：**
- Zeabur 可能缓存了旧版本的代码
- 或者部署的不是最新的 commit

**解决方案：**

#### 方案 A：强制重新部署
1. 访问 Zeabur Dashboard
2. 找到 ATMWater-BACKEND 项目
3. 点击"Redeploy"或"Rebuild"按钮
4. 等待部署完成（约 2-3 分钟）

#### 方案 B：检查部署的 commit
1. 在 Zeabur Dashboard 查看当前部署的 commit hash
2. 确认是否为最新的 `73d4f2c` 或 `9c32ee0`
3. 如果不是，手动触发部署

#### 方案 C：清除 Zeabur 缓存
1. 在 Zeabur Dashboard 中找到"Settings"
2. 查找"Clear Cache"或类似选项
3. 清除缓存后重新部署

---

### 原因 2：路由顺序冲突（已修复）

**问题：**
Express 路由按顺序匹配，如果 `/upgrade/:taskId` 在 `/upgrade` 之前，可能会拦截请求。

**修复：**
已调整路由顺序，将更具体的路由放在前面：

```javascript
// 升级任务管理
router.post('/upgrade/cancel/:taskId', cancelUpgradeTask);  // 最具体
router.post('/upgrade/batch', createBatchUpgrade);
router.post('/upgrade', createBatchUpgrade);                // 最通用
router.get('/upgrade/tasks', getUpgradeTasks);
router.get('/upgrades', getUpgradeTasks);
```

**Git 提交：** `73d4f2c`

---

### 原因 3：权限中间件问题（不太可能）

**检查：**
```javascript
// src/routes/firmwareRoutes.js 第 17-18 行
router.use(protect);
router.use(authorize('Admin', 'Super-Admin', 'GM'));
```

**验证：**
- 其他固件 API（如 `/api/firmware/list`）返回 200 OK
- 说明权限中间件工作正常
- 不是权限问题

---

## 🧪 测试验证

### 测试 1：检查 Zeabur 部署状态

```bash
# 访问 Zeabur Dashboard
https://zeabur.com/dashboard

# 检查：
# 1. 最新部署的 commit hash
# 2. 部署状态（Running/Failed）
# 3. 部署日志（是否有错误）
```

### 测试 2：直接测试 API

```bash
# 获取 token（使用超级管理员账号登录）
curl -X POST https://atmwater-backend.zeabur.app/api/auth/login-password \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"081234567891","password":"admin123"}'

# 测试固件部署 API
curl -X POST https://atmwater-backend.zeabur.app/api/firmware/upgrade \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firmwareId": 1,
    "unitIds": ["898608311123900885420001"]
  }'

# 期望结果：201 Created
# 实际结果：如果仍然 404，说明 Zeabur 没有部署最新代码
```

### 测试 3：检查路由是否注册

在 Zeabur 部署的应用中添加临时调试端点：

```javascript
// server.js 临时添加
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({ routes });
});
```

然后访问：
```
https://atmwater-backend.zeabur.app/api/debug/routes
```

查看是否包含 `POST /api/firmware/upgrade`

---

## 🚀 推荐解决步骤

### 第一步：确认 Zeabur 部署状态

1. 访问 Zeabur Dashboard
2. 检查最新部署的 commit
3. 确认是否为 `73d4f2c` 或更新

### 第二步：强制重新部署

如果 Zeabur 部署的不是最新代码：

1. 点击"Redeploy"按钮
2. 等待部署完成
3. 测试 API

### 第三步：验证修复

```bash
# 测试固件部署 API
curl -X POST https://atmwater-backend.zeabur.app/api/firmware/upgrade \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firmwareId": 1,
    "unitIds": ["898608311123900885420001"]
  }'
```

**期望结果：**
```json
{
  "success": true,
  "message": "Created 1 upgrade tasks",
  "data": {
    "taskCount": 1,
    "tasks": [...]
  }
}
```

---

## 📊 Git 提交历史

```
73d4f2c - fix: reorder firmware routes to prevent path conflicts
9c32ee0 - fix: add firmware upgrade API route and parameter compatibility
1c3797c - fix: add status field to firmware API response for frontend compatibility
045c59a - fix: update device type from HS003 to ATM-ID-1000P
6697f5e - docs: add comprehensive backend issues fix report
```

---

## 🔧 临时解决方案（如果 Zeabur 持续有问题）

### 方案 A：修改前端 API 调用

**文件：** `atmwater-web-react/src/services/api.js`

```javascript
// 修改前
triggerUpgrade: (data) => api.post('/api/firmware/upgrade', data),

// 修改后（使用已知可用的端点）
triggerUpgrade: (data) => api.post('/api/firmware/upgrade/batch', {
  firmwareVersionId: data.firmwareId,
  deviceIds: data.unitIds
}),
```

**优点：**
- 立即可用
- 不依赖 Zeabur 部署

**缺点：**
- 需要修改前端代码
- 需要重新部署前端

---

### 方案 B：使用环境变量切换端点

**前端添加环境变量：**
```javascript
const FIRMWARE_UPGRADE_ENDPOINT = process.env.REACT_APP_FIRMWARE_UPGRADE_ENDPOINT || '/api/firmware/upgrade';

triggerUpgrade: (data) => api.post(FIRMWARE_UPGRADE_ENDPOINT, data),
```

**优点：**
- 灵活切换
- 不需要修改代码

---

## 📝 总结

### 问题根源
Zeabur 可能缓存了旧版本的代码，导致新添加的路由未生效。

### 解决方案
1. **首选：** 在 Zeabur Dashboard 强制重新部署
2. **备选：** 修改前端使用 `/api/firmware/upgrade/batch` 端点

### 验证方法
使用 curl 测试 API 端点是否返回 201 Created

---

**文档生成时间：** 2026-03-17
**最新 Commit：** 73d4f2c
**问题状态：** 等待 Zeabur 重新部署
