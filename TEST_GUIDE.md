# ATMWater Backend - 自动化测试指南

## 📋 测试脚本说明

我已经创建了 3 个自动化测试脚本：

### 1. `test_all.bat` (Windows)
完整的自动化测试脚本，包括：
- ✅ 检查 Python 安装
- ✅ 测试健康检查接口
- ✅ 提示在 Zeabur 初始化数据库
- ✅ 测试 TCP 连接

### 2. `test_all.sh` (Linux/Mac)
与 `test_all.bat` 功能相同，适用于 Linux/Mac 系统

### 3. `init_zeabur.ps1` (Zeabur 终端)
在 Zeabur 终端运行的初始化脚本

---

## 🚀 使用方法

### 方法A：完整自动化测试（推荐）

#### Windows:
```bash
cd D:\airkopapp\JKT99ATM-main\ATMWater-BACKEND
test_all.bat
```

#### Linux/Mac:
```bash
cd /path/to/ATMWater-BACKEND
chmod +x test_all.sh
./test_all.sh
```

**脚本会自动执行以下步骤**：
1. 检查 Python 安装
2. 测试健康检查接口
3. 提示你在 Zeabur 终端运行初始化脚本
4. 测试 TCP 连接（设备认证、心跳、刷卡出水）

---

### 方法B：分步执行

#### 步骤1：在 Zeabur 终端初始化数据库

1. 打开 Zeabur 控制台：https://zeabur.com
2. 进入你的项目
3. 点击 `atmwater-backend` 服务
4. 点击 "终端" 或 "Terminal" 标签
5. 运行：

```bash
node scripts/initDatabase.js
```

**预期输出**：
```
========================================
🚀 Starting database initialization...
========================================

[1/5] Testing database connection...
✅ Database connection successful

[2/5] Synchronizing database schema...
✅ Database schema synchronized

[3/5] Creating test users...
✅ Created user: 081234567890 (ID: 1)
✅ Created admin: 081234567891 (ID: 2)

[4/5] Creating test devices...
✅ Created device: DEVICE001 (ID: 1)

[5/5] Creating test RFID cards...
✅ Created RFID card: RFID001 (bound to user 081234567890)

========================================
✅ Database initialization completed!
========================================

📋 Test Data Summary:
─────────────────────────────────────
👤 Test User:
   Phone: 081234567890
   Password: password123
   PIN: 1234
   Balance: Rp 50,000
   Virtual RFID: VIRT_081234567890

🔧 Test Device:
   Device ID: DEVICE001
   Password: pudow
   Location: Jakarta Office
   Price: Rp 500/L

💳 Test RFID Card:
   RFID: RFID001
   Bound to: 081234567890
─────────────────────────────────────
```

#### 步骤2：在本地测试 TCP 连接

```bash
cd D:\airkopapp\JKT99ATM-main\ATMWater-BACKEND
python test_tcp_client.py
```

**预期输出**：
```
========================================
🧪 ATMWater TCP Server Test
========================================

[1/5] Connecting to atmwater-backend.zeabur.app:55036...
✅ Connected successfully

[2/5] Testing device authentication...
📤 Sent: {"Cmd":"AU","DId":"DEVICE001","Type":"WaterDispenser","Pwd":"pudow"}
📥 Received: {"Cmd":"AU","Result":"OK","Msg":"Authentication successful"}
✅ Authentication successful

[3/5] Testing heartbeat...
📤 Sent: {"Cmd":"HB","DId":"DEVICE001"}
📥 Received: {"Cmd":"HB","Result":"OK","ServerTime":"2025-01-27T..."}
✅ Heartbeat successful

[4/5] Testing swipe water (Physical Card)...
📤 Sent: {"Cmd":"SW","DId":"DEVICE001","RFID":"RFID001","Vol":"2.5","Price":"500"}
📥 Received: {"Cmd":"SW","Result":"OK","Balance":48750,"TransactionId":1}
✅ Water dispensed successfully
   Balance: Rp 48750
   Transaction ID: 1

[5/5] Testing swipe water (Virtual Card)...
📤 Sent: {"Cmd":"SW","DId":"DEVICE001","RFID":"VIRT_081234567890","Vol":"1.5","Price":"500"}
📥 Received: {"Cmd":"SW","Result":"OK","Balance":48000,"TransactionId":2}
✅ Water dispensed successfully
   Balance: Rp 48000
   Transaction ID: 2

========================================
✅ All tests completed successfully!
========================================
```

---

## 🔍 故障排查

### 问题1：健康检查失败

**错误信息**：
```
❌ Health check failed
```

**解决方案**：
1. 检查 Zeabur 服务是否正在运行
2. 访问 https://atmwater-backend.zeabur.app/api/health
3. 查看 Zeabur 日志

---

### 问题2：TCP 连接失败

**错误信息**：
```
❌ Connection timeout - Server may not be running
```

**解决方案**：
1. 确认 TCP 端口 55036 已在 Zeabur 暴露
2. 检查 Zeabur 日志，确认 TCP 服务器已启动
3. 确认防火墙没有阻止连接

---

### 问题3：设备认证失败

**错误信息**：
```
{"Cmd":"AU","Result":"Fail","Msg":"Device not found"}
```

**解决方案**：
1. 确认已运行数据库初始化脚本
2. 检查设备ID和密码是否正确
3. 在 Zeabur 终端运行：
   ```bash
   node scripts/initDatabase.js
   ```

---

### 问题4：余额不足

**错误信息**：
```
{"Cmd":"SW","Result":"Fail","Msg":"Insufficient balance"}
```

**解决方案**：
1. 测试用户初始余额为 Rp 50,000
2. 如果余额用完，需要重新初始化数据库
3. 或者手动充值（通过 API）

---

## 📊 测试数据

初始化脚本会创建以下测试数据：

| 类型 | 数据 |
|------|------|
| **测试用户** | 手机号：`081234567890`<br>密码：`password123`<br>PIN：`1234`<br>余额：Rp 50,000 |
| **管理员** | 手机号：`081234567891`<br>密码：`admin123`<br>PIN：`9999` |
| **测试设备** | 设备ID：`DEVICE001`<br>密码：`pudow`<br>位置：Jakarta Office |
| **实体卡** | RFID：`RFID001`<br>绑定用户：`081234567890` |
| **虚拟卡** | RFID：`VIRT_081234567890`<br>绑定用户：`081234567890` |

---

## 🎯 提供给硬件工程师的信息

```yaml
# TCP 服务器连接信息
服务器地址: atmwater-backend.zeabur.app
TCP 端口: 55036
协议: TCP长连接
数据格式: JSON (每条消息以 \n 结尾)
字符编码: UTF-8
心跳间隔: 60秒
超时时间: 120秒

# 测试设备认证
设备ID: DEVICE001
设备密码: pudow
设备类型: WaterDispenser

# 测试RFID卡
实体卡: RFID001
虚拟卡: VIRT_081234567890

# 测试用户
手机号: 081234567890
余额: Rp 50,000
PIN: 1234
```

---

## 📞 支持

如有问题，请检查：
- Zeabur 控制台：https://zeabur.com
- GitHub 仓库：https://github.com/andyyen817/ATMWater-BACKEND-
- 技术文档：`DEPLOYMENT.md`

