# 🚀 ATMWater Backend - MySQL 版本部署指南

## ✅ 已完成的工作

### 1. 数据库迁移
- ✅ 从 MongoDB 迁移到 MySQL
- ✅ 使用 Sequelize ORM
- ✅ 创建了 4 个核心数据模型

### 2. 核心模型（MySQL）

#### User.mysql.js - 用户模型
```javascript
字段：
- phone (手机号，唯一)
- password (密码，bcrypt加密)
- pin (4位PIN码)
- balance (钱包余额)
- virtualRfid (虚拟RFID)
- referralCode (推荐码)
- role (角色: User/Admin/Steward)
```

#### PhysicalCard.mysql.js - 实体卡模型
```javascript
字段：
- rfid (RFID卡号，唯一)
- userId (绑定的用户ID)
- status (状态: Active/Inactive/Lost/Damaged)
- batchId (批次ID)
```

#### Unit.mysql.js - 设备模型
```javascript
字段：
- deviceId (设备ID，唯一)
- password (设备密码)
- location (位置)
- status (状态: Online/Offline/Maintenance/Error)
- pricePerLiter (每升价格)
- tdsValue (TDS水质值)
- temperature (水温)
```

#### Transaction.mysql.js - 交易模型
```javascript
字段：
- userId (用户ID)
- unitId (设备ID)
- type (类型: TopUp/WaterPurchase/Withdrawal/Refund)
- amount (金额)
- volume (出水量)
- rfid (RFID卡号)
- status (状态: Pending/Completed/Failed/Cancelled)
```

### 3. TCP 服务器

#### 支持的指令

| 指令 | 说明 | 请求格式 | 响应格式 |
|------|------|---------|---------|
| AU | 设备认证 | `{"Cmd":"AU","DId":"DEVICE001","Type":"WaterDispenser","Pwd":"pudow"}` | `{"Cmd":"AU","Result":"OK","Msg":"..."}` |
| HB | 心跳 | `{"Cmd":"HB","DId":"DEVICE001"}` | `{"Cmd":"HB","Result":"OK","ServerTime":"..."}` |
| SW | 刷卡出水 | `{"Cmd":"SW","DId":"DEVICE001","RFID":"RFID001","Vol":"2.5","Price":"500"}` | `{"Cmd":"SW","Result":"OK","Balance":47500}` |
| DS | 设备状态 | `{"Cmd":"DS","DId":"DEVICE001","Status":"Online"}` | `{"Cmd":"DS","Result":"OK"}` |
| WQ | 水质数据 | `{"Cmd":"WQ","DId":"DEVICE001","TDS":"50","Temp":"25.5"}` | `{"Cmd":"WQ","Result":"OK"}` |

### 4. 服务器配置

#### server.js
- ✅ 移除 MongoDB 依赖
- ✅ 使用 Sequelize 连接 MySQL
- ✅ 启动 HTTP 服务器（端口 8080）
- ✅ 启动 TCP 服务器（端口 55036）

#### package.json
- ✅ 添加 `sequelize` 和 `mysql2`
- ✅ 移除 `mongoose`
- ✅ 更新启动脚本

---

## 📋 部署步骤

### 步骤1：推送代码到 GitHub

```bash
# 如果网络连接失败，请重试
cd D:\airkopapp\JKT99ATM-main\ATMWater-BACKEND
git push origin main
```

### 步骤2：Zeabur 自动部署

Zeabur 会自动检测到代码更新并重新部署：

1. 检测到 `package.json` 变更
2. 运行 `npm install`（安装 sequelize 和 mysql2）
3. 运行 `npm start`（启动 server.js）
4. 自动连接 MySQL 数据库

### 步骤3：检查部署日志

在 Zeabur 控制台查看日志，应该看到：

```
✅ Environment variables loaded
[MySQL] ✅ Connection established successfully
[MySQL] 📊 Database: zeabur
[MySQL] 🌐 Host: atmwater-backend.zeabur.internal
[MySQL] ✅ Database synchronized
[HTTP] ✅ Server running on port 8080
[HTTP] 🌍 Health check: http://localhost:8080/api/health
[TCP] ✅ Server listening on port 55036
```

### 步骤4：初始化数据库

**方法A：在 Zeabur 终端运行**

1. 进入 Zeabur 控制台
2. 点击服务 → "终端" 或 "Terminal"
3. 运行初始化脚本：

```bash
node scripts/initDatabase.js
```

**方法B：在本地运行（需要配置环境变量）**

```bash
# 设置环境变量
$env:DB_HOST="atmwater-backend.zeabur.internal"
$env:DB_PORT="3306"
$env:DB_NAME="zeabur"
$env:DB_USER="root"
$env:DB_PASSWORD="m6RE5f3pADClMNn9ca47Z1z028gbXxuW"

# 运行初始化
node scripts/initDatabase.js
```

### 步骤5：测试 TCP 连接

创建测试脚本 `test_tcp.py`：

```python
import socket
import json

HOST = 'atmwater-backend.zeabur.app'
PORT = 55036

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((HOST, PORT))
print(f"✅ Connected to {HOST}:{PORT}")

# 1. 设备认证
auth_cmd = {
    "Cmd": "AU",
    "DId": "DEVICE001",
    "Type": "WaterDispenser",
    "Pwd": "pudow"
}
sock.send((json.dumps(auth_cmd) + '\n').encode('utf-8'))
response = sock.recv(1024).decode('utf-8')
print(f"📥 Auth response: {response}")

# 2. 心跳
hb_cmd = {"Cmd": "HB", "DId": "DEVICE001"}
sock.send((json.dumps(hb_cmd) + '\n').encode('utf-8'))
response = sock.recv(1024).decode('utf-8')
print(f"📥 Heartbeat response: {response}")

# 3. 刷卡出水
sw_cmd = {
    "Cmd": "SW",
    "DId": "DEVICE001",
    "RFID": "RFID001",
    "Vol": "2.5",
    "Price": "500"
}
sock.send((json.dumps(sw_cmd) + '\n').encode('utf-8'))
response = sock.recv(1024).decode('utf-8')
print(f"📥 Swipe water response: {response}")

sock.close()
print("✅ Test completed")
```

运行测试：
```bash
python test_tcp.py
```

---

## 🔍 故障排查

### 问题1：MongoDB 错误（已解决）

**错误信息**：
```
Operation `renrencards.find()` buffering timed out after 10000ms
Operation `units.find()` buffering timed out after 10000ms
```

**原因**：旧代码使用 MongoDB，但 Zeabur 没有配置 MongoDB

**解决方案**：✅ 已迁移到 MySQL

---

### 问题2：数据库连接失败

**可能原因**：
- 环境变量配置错误
- MySQL 服务未启动

**检查步骤**：
1. 在 Zeabur 控制台查看环境变量
2. 确认 MySQL 服务正在运行
3. 查看服务日志

---

### 问题3：TCP 端口无法连接

**可能原因**：
- TCP 端口 55036 未暴露

**解决方案**：
1. 进入 Zeabur 服务设置
2. 点击 "网络" → "暴露新端口"
3. 输入端口号：`55036`
4. 选择协议：`TCP`
5. 保存

---

## 📊 测试数据

初始化脚本会创建以下测试数据：

### 测试用户
```
手机号: 081234567890
密码: password123
PIN: 1234
余额: Rp 50,000
虚拟RFID: VIRT_081234567890
```

### 测试设备
```
设备ID: DEVICE001
密码: pudow
位置: Jakarta Office
价格: Rp 500/升
```

### 测试RFID卡
```
RFID: RFID001
绑定用户: 081234567890
状态: Active
```

---

## 🎯 下一步行动

1. ✅ **推送代码到 GitHub**
   ```bash
   git push origin main
   ```

2. ⏳ **等待 Zeabur 自动部署**（约 2-3 分钟）

3. ✅ **检查部署日志**
   - 确认 MySQL 连接成功
   - 确认 TCP 服务器启动

4. ✅ **运行初始化脚本**
   ```bash
   node scripts/initDatabase.js
   ```

5. ✅ **测试 TCP 连接**
   ```bash
   python test_tcp.py
   ```

6. ✅ **提供信息给硬件工程师**
   - 服务器地址：`atmwater-backend.zeabur.app`
   - TCP 端口：`55036`
   - 测试设备ID：`DEVICE001`
   - 测试密码：`pudow`

---

## 📞 联系信息

如有问题，请检查：
- Zeabur 控制台：https://zeabur.com
- GitHub 仓库：https://github.com/andyyen817/ATMWater-BACKEND-
- 技术文档：`App前后端服务器数据库打通任务执行清单v10206.md`

