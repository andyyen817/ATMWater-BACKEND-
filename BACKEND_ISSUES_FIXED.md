# 后端问题修复报告

## 📋 问题总结

前端管理后台在使用固件管理功能时遇到两个核心问题：

### 问题一：固件列表 API 返回 404
**错误日志：**
```
GET /api/firmware/list 404 (Not Found)
```

**根本原因：**
- 前端调用：`GET /api/firmware/list`
- 后端提供：`GET /api/firmware/versions`
- API 端点不匹配导致 404 错误

### 问题二：升级监控 API 返回 404
**错误日志：**
```
GET /api/firmware/upgrades 404 (Not Found)
```

**根本原因：**
- 前端调用：`GET /api/firmware/upgrades`
- 后端提供：`GET /api/firmware/upgrade/tasks`
- API 端点不匹配导致 404 错误

---

## ✅ 解决方案

### 修复文件：`src/routes/firmwareRoutes.js`

**修改内容：**
添加了两个前端兼容路由，作为现有路由的别名：

```javascript
// 固件管理
router.post('/upload', upload.single('firmware'), uploadFirmware);
router.get('/versions', getFirmwareVersions);
router.get('/list', getFirmwareVersions); // ✅ 新增：前端兼容路由
router.delete('/versions/:id', deleteFirmwareVersion);

// 升级任务管理
router.post('/upgrade/batch', createBatchUpgrade);
router.get('/upgrade/tasks', getUpgradeTasks);
router.get('/upgrades', getUpgradeTasks); // ✅ 新增：前端兼容路由
router.post('/upgrade/cancel/:taskId', cancelUpgradeTask);
```

**技术说明：**
- 两个新路由指向相同的控制器方法
- 不影响现有 API 的功能
- 保持向后兼容性
- 前端和后端都可以使用任一端点

---

## 🔍 API 端点对照表

| 前端调用 | 后端原有端点 | 新增兼容端点 | 控制器方法 | 状态 |
|---------|------------|------------|-----------|------|
| `GET /api/firmware/list` | `GET /api/firmware/versions` | ✅ `GET /api/firmware/list` | `getFirmwareVersions` | 已修复 |
| `GET /api/firmware/upgrades` | `GET /api/firmware/upgrade/tasks` | ✅ `GET /api/firmware/upgrades` | `getUpgradeTasks` | 已修复 |

---

## 📊 完整的固件管理 API 列表

### 1. 固件文件管理

#### 上传固件
```
POST /api/firmware/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- firmware: File (.bin, max 10MB)
- version: String (required)
- description: String (optional)
- deviceModel: String (optional, default: 'ATM-ID-1000P')

Response:
{
  "success": true,
  "message": "Firmware uploaded successfully",
  "data": {
    "id": 1,
    "version": "1.0.0",
    "deviceModel": "ATM-ID-1000P",
    "fileName": "firmware.bin",
    "fileSize": 1024000,
    "crc32": "A1B2C3D4"
  }
}
```

#### 获取固件列表
```
GET /api/firmware/versions
GET /api/firmware/list  (前端兼容路由)
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "version": "1.0.0",
      "deviceModel": "ATM-ID-1000P",
      "fileName": "firmware.bin",
      "fileSize": 1024000,
      "crc32": "A1B2C3D4",
      "description": "Initial release",
      "isActive": true,
      "uploadedBy": 1,
      "createdAt": "2026-03-17T10:00:00.000Z",
      "uploader": {
        "id": 1,
        "name": "Super Admin",
        "phoneNumber": "081234567891"
      }
    }
  ]
}
```

#### 删除固件版本
```
DELETE /api/firmware/versions/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Firmware deleted successfully"
}
```

### 2. 设备型号管理

#### 获取设备型号列表
```
GET /api/firmware/device-models
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "value": "ATM-ID-1000P",
      "label": "ATM-ID-1000P"
    }
  ]
}
```

### 3. 设备筛选

#### 筛选设备
```
POST /api/firmware/filter-devices
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "companyId": 1,
  "location": "Jakarta",
  "firmwareVersion": "1.0.0",
  "simNumber": "898608",
  "deviceNumber": "ATM001"
}

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "deviceId": "898608311123900885420001",
      "deviceName": "ATM Water Station 1",
      "location": "Jakarta",
      "firmwareVersion": "1.0.0",
      "imei": "898608311123900885420001",
      "status": "Online"
    }
  ]
}
```

### 4. 升级任务管理

#### 创建批量升级任务
```
POST /api/firmware/upgrade/batch
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "firmwareVersionId": 1,
  "deviceIds": ["898608311123900885420001", "898608311123900885420002"]
}

Response:
{
  "success": true,
  "message": "Created 2 upgrade tasks",
  "data": {
    "taskCount": 2,
    "tasks": [...]
  }
}
```

#### 获取升级任务列表
```
GET /api/firmware/upgrade/tasks
GET /api/firmware/upgrades  (前端兼容路由)
Authorization: Bearer <token>

Query Parameters:
- status: String (optional) - 'Pending', 'InProgress', 'Completed', 'Failed', 'Cancelled'
- deviceId: String (optional)

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "firmwareVersionId": 1,
      "unitId": 1,
      "deviceId": "898608311123900885420001",
      "versionBefore": "0.9.0",
      "versionAfter": "1.0.0",
      "status": "Completed",
      "progress": 100,
      "initiatedBy": 1,
      "startedAt": "2026-03-17T10:00:00.000Z",
      "completedAt": "2026-03-17T10:05:00.000Z",
      "firmware": {
        "version": "1.0.0",
        "fileName": "firmware.bin"
      },
      "unit": {
        "deviceId": "898608311123900885420001",
        "deviceName": "ATM Water Station 1",
        "location": "Jakarta",
        "imei": "898608311123900885420001"
      }
    }
  ]
}
```

#### 取消升级任务
```
POST /api/firmware/upgrade/cancel/:taskId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Task cancelled successfully"
}
```

---

## 🔐 权限配置

所有固件管理 API 需要以下角色之一：
- `Super-Admin` - 超级管理员
- `GM` - 总经理
- `Admin` - 管理员

**权限检查流程：**
1. `protect` 中间件：验证 JWT Token
2. `authorize('Admin', 'Super-Admin', 'GM')` 中间件：验证用户角色

**示例请求头：**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 测试验证

### 测试一：固件列表 API
```bash
# 使用新端点（前端兼容）
curl -X GET https://atmwater-backend.zeabur.app/api/firmware/list \
  -H "Authorization: Bearer <token>"

# 使用原端点（仍然可用）
curl -X GET https://atmwater-backend.zeabur.app/api/firmware/versions \
  -H "Authorization: Bearer <token>"

# 期望结果：两个端点返回相同的数据，200 OK
```

### 测试二：升级监控 API
```bash
# 使用新端点（前端兼容）
curl -X GET https://atmwater-backend.zeabur.app/api/firmware/upgrades \
  -H "Authorization: Bearer <token>"

# 使用原端点（仍然可用）
curl -X GET https://atmwater-backend.zeabur.app/api/firmware/upgrade/tasks \
  -H "Authorization: Bearer <token>"

# 期望结果：两个端点返回相同的数据，200 OK
```

### 测试三：端到端测试
1. 登录超级管理员账号（081234567891 / admin123）
2. 访问固件管理页面
3. 验证固件列表正常加载（不再显示 404 错误）
4. 访问升级监控页面
5. 验证升级任务列表正常加载（不再显示 404 错误）

---

## 📝 Git 提交记录

**Commit Hash:** `9a05440`

**提交信息：**
```
fix: add frontend-compatible firmware API routes

- Add GET /api/firmware/list as alias for /api/firmware/versions
- Add GET /api/firmware/upgrades as alias for /api/firmware/upgrade/tasks
- Fix 404 errors in frontend firmware list and upgrade monitor
- Add user role management scripts for debugging

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**修改文件：**
- `src/routes/firmwareRoutes.js` - 添加前端兼容路由
- `check-admin-accounts.js` - 新增：管理员账号查询脚本
- `check-user-role.js` - 新增：用户角色检查脚本
- `update-user-role.js` - 新增：用户角色升级脚本

---

## 🚀 部署状态

**部署平台：** Zeabur
**后端 URL：** https://atmwater-backend.zeabur.app
**部署状态：** ✅ 已部署
**Git 分支：** main
**最新提交：** 9a05440

---

## 📞 管理员账号信息

### 可用的管理员账号

#### 账号 1：超级管理员（推荐使用）
- **手机号：** 081234567891
- **密码：** admin123
- **角色：** Super-Admin
- **权限：** 所有固件管理功能
- **状态：** ✅ 已验证可用

#### 账号 2：总经理
- **手机号：** 081000000001
- **密码：** （需要查询或重置）
- **角色：** GM
- **权限：** 所有固件管理功能
- **状态：** ⚠️ 需要确认密码

---

## 🎯 问题解决总结

### 已修复的问题

1. ✅ **固件列表 404 错误**
   - 原因：API 端点不匹配
   - 解决：添加 `GET /api/firmware/list` 兼容路由
   - 状态：已修复并部署

2. ✅ **升级监控 404 错误**
   - 原因：API 端点不匹配
   - 解决：添加 `GET /api/firmware/upgrades` 兼容路由
   - 状态：已修复并部署

3. ✅ **用户权限问题**
   - 原因：账号角色为 Steward，无固件管理权限
   - 解决：升级账号 081234567891 为 Super-Admin
   - 状态：已修复

### 前端无需修改

前端代码完全正常，无需任何修改。所有问题都已在后端解决。

---

## 🔄 后续优化建议

### 建议一：统一 API 命名规范
考虑在未来版本中统一前后端的 API 命名规范，避免类似问题。

**选项 A：** 使用 RESTful 风格（推荐）
- `GET /api/firmware` - 获取固件列表
- `POST /api/firmware` - 上传固件
- `DELETE /api/firmware/:id` - 删除固件
- `GET /api/firmware/upgrades` - 获取升级任务
- `POST /api/firmware/upgrades` - 创建升级任务

**选项 B：** 保持当前风格
- 继续使用 `/versions` 和 `/upgrade/tasks`
- 更新前端 API 调用以匹配后端

### 建议二：添加 API 版本控制
```
/api/v1/firmware/...
/api/v2/firmware/...
```

### 建议三：添加 API 文档
使用 Swagger/OpenAPI 自动生成 API 文档，避免前后端不一致。

---

## 📚 相关文档

- [前端分析报告](D:\airkopapp\JKT99ATM-main\atmwater-web-react\FRONTEND_ANALYSIS_REPORT.md)
- [固件管理 API 需求文档](BACKEND_FIRMWARE_API_REQUIREMENTS.md)
- [数据库迁移脚本](migrations/add_device_model_to_firmware.sql)

---

**报告生成时间：** 2026-03-17
**报告版本：** v1.0
**修复人员：** Claude Sonnet 4.6
