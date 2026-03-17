# 固件管理 API 端点对照表

## 📋 问题总结

前端和后端的 API 端点和参数名称不一致，导致多个功能失败。

---

## 🔍 API 端点对照

### 1. 获取固件列表

| 前端调用 | 后端原有 | 后端新增 | 状态 |
|---------|---------|---------|------|
| `GET /api/firmware/list` | `GET /api/firmware/versions` | ✅ `/list` | 已修复 |

**修复：** 添加 `/list` 作为 `/versions` 的别名

---

### 2. 获取升级任务列表

| 前端调用 | 后端原有 | 后端新增 | 状态 |
|---------|---------|---------|------|
| `GET /api/firmware/upgrades` | `GET /api/firmware/upgrade/tasks` | ✅ `/upgrades` | 已修复 |

**修复：** 添加 `/upgrades` 作为 `/upgrade/tasks` 的别名

---

### 3. 创建升级任务（部署固件）

| 前端调用 | 后端原有 | 后端新增 | 状态 |
|---------|---------|---------|------|
| `POST /api/firmware/upgrade` | `POST /api/firmware/upgrade/batch` | ✅ `/upgrade` | 已修复 |

**修复：** 添加 `/upgrade` 作为 `/upgrade/batch` 的别名

---

## 🔧 参数名称对照

### 创建升级任务参数

| 前端发送 | 后端期望 | 兼容性 | 状态 |
|---------|---------|--------|------|
| `firmwareId` | `firmwareVersionId` | ✅ 已兼容 | 已修复 |
| `unitIds` | `deviceIds` | ✅ 已兼容 | 已修复 |

**前端发送的数据：**
```javascript
{
  firmwareId: 1,
  unitIds: ["898608311123900885420001"]
}
```

**后端期望的数据：**
```javascript
{
  firmwareVersionId: 1,
  deviceIds: ["898608311123900885420001"]
}
```

**修复方案：**
后端控制器现在同时支持两种参数名：
```javascript
const firmwareVersionId = req.body.firmwareVersionId || req.body.firmwareId;
const deviceIds = req.body.deviceIds || req.body.unitIds;
```

---

## 📊 响应数据字段对照

### 固件列表响应

| 前端期望 | 后端原有 | 后端新增 | 状态 |
|---------|---------|---------|------|
| `status` (string) | `isActive` (boolean) | ✅ `status` | 已修复 |

**前端期望的数据：**
```javascript
{
  id: 1,
  version: "v1",
  status: "active" | "testing" | "inactive"
}
```

**后端原有的数据：**
```javascript
{
  id: 1,
  version: "v1",
  isActive: true | false
}
```

**修复方案：**
后端现在同时返回两个字段：
```javascript
{
  id: 1,
  version: "v1",
  isActive: true,
  status: "active"  // 基于 isActive 映射
}
```

---

## ✅ 完整的 API 端点列表

### 固件文件管理

#### 1. 上传固件
```
POST /api/firmware/upload
Content-Type: multipart/form-data

Body:
- firmware: File (.bin, max 10MB)
- version: String (required)
- description: String (optional)
- deviceModel: String (optional, default: 'ATM-ID-1000P')
```

#### 2. 获取固件列表
```
GET /api/firmware/versions  (原有)
GET /api/firmware/list       (前端兼容)

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "version": "v1",
      "deviceModel": "ATM-ID-1000P",
      "fileName": "firmware.bin",
      "fileSize": 58770,
      "crc32": "2587342265",
      "description": "AA",
      "isActive": true,
      "status": "active",
      "uploader": {
        "id": 2,
        "name": "Super Admin",
        "phoneNumber": "081234567891"
      }
    }
  ]
}
```

#### 3. 删除固件版本
```
DELETE /api/firmware/versions/:id

Response:
{
  "success": true,
  "message": "Firmware deleted successfully"
}
```

---

### 设备型号管理

#### 4. 获取设备型号列表
```
GET /api/firmware/device-models

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

---

### 设备筛选

#### 5. 筛选设备
```
POST /api/firmware/filter-devices
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
      "deviceName": "Production Device 1",
      "location": "Jakarta",
      "firmwareVersion": "G4PDWMR01.1_260212T",
      "imei": "89860831112390088542",
      "status": "Online"
    }
  ]
}
```

---

### 升级任务管理

#### 6. 创建升级任务
```
POST /api/firmware/upgrade/batch  (原有)
POST /api/firmware/upgrade         (前端兼容)
Content-Type: application/json

Body (支持两种参数名):
{
  "firmwareVersionId": 1,  // 或 "firmwareId": 1
  "deviceIds": [...]       // 或 "unitIds": [...]
}

Response:
{
  "success": true,
  "message": "Created 1 upgrade tasks",
  "data": {
    "taskCount": 1,
    "tasks": [...]
  }
}
```

#### 7. 获取升级任务列表
```
GET /api/firmware/upgrade/tasks  (原有)
GET /api/firmware/upgrades       (前端兼容)

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
      "versionBefore": "G4PDWMR01.1_260212T",
      "versionAfter": "v1",
      "status": "Pending",
      "progress": 0,
      "initiatedBy": 2,
      "createdAt": "2026-03-17T12:00:00.000Z",
      "firmware": {
        "version": "v1",
        "fileName": "firmware.bin"
      },
      "unit": {
        "deviceId": "898608311123900885420001",
        "deviceName": "Production Device 1",
        "location": null,
        "imei": "89860831112390088542"
      }
    }
  ]
}
```

#### 8. 取消升级任务
```
POST /api/firmware/upgrade/cancel/:taskId

Response:
{
  "success": true,
  "message": "Task cancelled successfully"
}
```

---

## 🔐 权限要求

所有固件管理 API 需要以下角色之一：
- `Super-Admin` - 超级管理员
- `GM` - 总经理
- `Admin` - 管理员

**请求头：**
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 🎯 修复历史

### 修复 1：固件列表 404 错误
**时间：** 2026-03-17
**Commit：** 9a05440
**问题：** 前端调用 `/api/firmware/list`，后端只有 `/api/firmware/versions`
**解决：** 添加 `/list` 作为 `/versions` 的别名

### 修复 2：升级监控 404 错误
**时间：** 2026-03-17
**Commit：** 9a05440
**问题：** 前端调用 `/api/firmware/upgrades`，后端只有 `/api/firmware/upgrade/tasks`
**解决：** 添加 `/upgrades` 作为 `/upgrade/tasks` 的别名

### 修复 3：固件列表显示空数据
**时间：** 2026-03-17
**Commit：** 1c3797c
**问题：** 前端期望 `status` 字段，后端只返回 `isActive` 字段
**解决：** 后端添加 `status` 字段映射

### 修复 4：固件部署 404 错误
**时间：** 2026-03-17
**Commit：** 9c32ee0
**问题：** 前端调用 `/api/firmware/upgrade`，后端只有 `/api/firmware/upgrade/batch`
**解决：** 添加 `/upgrade` 作为 `/upgrade/batch` 的别名

### 修复 5：固件部署参数不匹配
**时间：** 2026-03-17
**Commit：** 9c32ee0
**问题：** 前端发送 `{firmwareId, unitIds}`，后端期望 `{firmwareVersionId, deviceIds}`
**解决：** 后端控制器兼容两种参数名

---

## 📝 前端 API 调用示例

### 获取固件列表
```javascript
const response = await firmwareAPI.getFirmwareList();
// GET /api/firmware/list
```

### 获取升级任务
```javascript
const response = await firmwareAPI.getUpgradeTasks();
// GET /api/firmware/upgrades
```

### 创建升级任务
```javascript
const response = await firmwareAPI.triggerUpgrade({
  firmwareId: 1,
  unitIds: ["898608311123900885420001"]
});
// POST /api/firmware/upgrade
```

---

## 🚀 测试验证

### 测试 1：固件列表
```bash
curl -X GET https://atmwater-backend.zeabur.app/api/firmware/list \
  -H "Authorization: Bearer <token>"

# 期望结果：200 OK，返回固件列表
```

### 测试 2：升级任务列表
```bash
curl -X GET https://atmwater-backend.zeabur.app/api/firmware/upgrades \
  -H "Authorization: Bearer <token>"

# 期望结果：200 OK，返回升级任务列表
```

### 测试 3：创建升级任务
```bash
curl -X POST https://atmwater-backend.zeabur.app/api/firmware/upgrade \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firmwareId": 1,
    "unitIds": ["898608311123900885420001"]
  }'

# 期望结果：201 Created，返回创建的任务
```

---

## 📊 总结

### 修复的问题

1. ✅ 固件列表 API 端点不匹配
2. ✅ 升级监控 API 端点不匹配
3. ✅ 固件列表响应字段不匹配
4. ✅ 固件部署 API 端点不匹配
5. ✅ 固件部署参数名称不匹配

### 兼容性策略

- 保留原有 API 端点（向后兼容）
- 添加前端期望的 API 端点（前端兼容）
- 支持多种参数名称（灵活性）
- 返回多种字段格式（完整性）

### 后续建议

1. **统一命名规范** - 前后端团队协商统一的 API 命名规范
2. **API 文档** - 使用 Swagger/OpenAPI 生成 API 文档
3. **自动化测试** - 添加 API 集成测试，防止类似问题
4. **版本控制** - 考虑使用 API 版本控制（如 `/api/v1/firmware/...`）

---

**文档生成时间：** 2026-03-17
**文档版本：** v1.0
**维护人员：** Claude Sonnet 4.6
