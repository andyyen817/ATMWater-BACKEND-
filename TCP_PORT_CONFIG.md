# ========================================
# ATMWater Backend - TCP 端口配置说明
# ========================================

## 🔍 问题诊断

你遇到的问题是：
- ✅ 数据库连接成功
- ✅ 所有表都存在
- ✅ 测试数据已创建
- ✅ HTTP 服务器运行正常（端口 8080）
- ❌ **TCP 连接失败**（端口 55036）

**根本原因**：Zeabur 默认只暴露 HTTP 端口，TCP 端口需要额外配置。

---

## ✅ 解决方案

我已经创建了 `zeabur.yaml` 配置文件来暴露 TCP 端口。

### 方法1：通过 Zeabur 控制台配置（推荐）

#### 步骤1：登录 Zeabur 控制台
访问：https://zeabur.com

#### 步骤2：进入你的项目
点击你的项目 → 点击 `atmwater-backend` 服务

#### 步骤3：配置网络端口
1. 点击 "网络" 或 "Networking" 标签
2. 找到 "端口" 或 "Ports" 设置
3. 添加新端口：
   - **端口号**：`55036`
   - **协议**：`TCP`
   - **暴露**：勾选 ✓

#### 步骤4：保存并重启服务
保存配置后，Zeabur 会自动重启服务。

---

### 方法2：通过 zeabur.yaml 配置文件

我已经创建了 `zeabur.yaml` 文件：

\`\`\`yaml
# Zeabur 配置文件
ports:
  - port: 8080
    protocol: http
    
  - port: 55036
    protocol: tcp
    expose: true
\`\`\`

**推送到 GitHub**：
\`\`\`bash
cd D:\\airkopapp\\JKT99ATM-main\\ATMWater-BACKEND
git push origin main
\`\`\`

（注意：刚才 GitHub 连接失败，请稍后重试）

---

## 🔧 Zeabur 端口配置步骤（详细）

### 1. 打开 Zeabur 控制台
访问：https://zeabur.com/dashboard

### 2. 选择项目
点击你的项目名称

### 3. 选择服务
点击 `atmwater-backend` 服务

### 4. 配置端口
在服务详情页面，找到以下选项之一：
- "网络" (Networking)
- "端口" (Ports)
- "暴露端口" (Exposed Ports)

### 5. 添加 TCP 端口
点击 "添加端口" 或 "Add Port"，填写：
- **内部端口** (Internal Port): `55036`
- **协议** (Protocol): `TCP`
- **公开访问** (Public): 勾选 ✓

### 6. 获取外部端口
Zeabur 可能会分配一个不同的外部端口，例如：
- 内部端口：`55036`
- 外部端口：`12345`（示例）

**重要**：记下外部端口号！

### 7. 更新连接信息
如果 Zeabur 分配了不同的外部端口，你需要使用外部端口连接：
\`\`\`
服务器地址: atmwater-backend.zeabur.app
TCP 端口: [外部端口号]  # 例如：12345
\`\`\`

---

## 🧪 测试 TCP 连接

### 更新测试脚本

如果 Zeabur 分配了不同的外部端口，需要修改测试脚本：

\`\`\`python
# test_tcp_client.py
HOST = 'atmwater-backend.zeabur.app'
PORT = 12345  # 改为 Zeabur 分配的外部端口
\`\`\`

### 运行测试
\`\`\`bash
python test_tcp_client.py
\`\`\`

---

## 📊 Zeabur 端口配置示例

### 配置前（只有 HTTP）
\`\`\`
服务: atmwater-backend
端口:
  - 8080 (HTTP) ✓ 公开
\`\`\`

### 配置后（HTTP + TCP）
\`\`\`
服务: atmwater-backend
端口:
  - 8080 (HTTP) ✓ 公开
  - 55036 (TCP) ✓ 公开  → 外部端口: 12345
\`\`\`

---

## 🔍 验证端口是否暴露

### 方法1：使用 telnet
\`\`\`bash
telnet atmwater-backend.zeabur.app 55036
\`\`\`

如果连接成功，会显示：
\`\`\`
Trying [IP]...
Connected to atmwater-backend.zeabur.app.
\`\`\`

### 方法2：使用 nc (netcat)
\`\`\`bash
nc -zv atmwater-backend.zeabur.app 55036
\`\`\`

如果端口开放，会显示：
\`\`\`
Connection to atmwater-backend.zeabur.app 55036 port [tcp/*] succeeded!
\`\`\`

### 方法3：使用 Python
\`\`\`python
import socket

try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    result = sock.connect_ex(('atmwater-backend.zeabur.app', 55036))
    if result == 0:
        print("✅ Port 55036 is open")
    else:
        print("❌ Port 55036 is closed")
    sock.close()
except Exception as e:
    print(f"❌ Error: {e}")
\`\`\`

---

## 📋 常见问题

### Q1: Zeabur 不支持自定义 TCP 端口？
**A**: Zeabur 支持 TCP 端口，但需要在控制台手动配置。有些计划可能有限制。

### Q2: 端口配置后还是连接不上？
**A**: 
1. 确认服务已重启
2. 检查 Zeabur 日志，确认 TCP 服务器已启动
3. 确认防火墙没有阻止连接
4. 尝试使用 Zeabur 分配的外部端口

### Q3: 如何查看 Zeabur 日志？
**A**: 
1. 进入 Zeabur 控制台
2. 点击 `atmwater-backend` 服务
3. 点击 "日志" 或 "Logs" 标签
4. 查找 `[TCP] ✅ Server listening on port 55036`

### Q4: 可以使用其他端口吗？
**A**: 可以，但需要同时修改：
- 环境变量 `TCP_PORT`
- `zeabur.yaml` 配置
- 测试脚本中的端口号

---

## 🎯 下一步行动

### 1. 配置 Zeabur 端口（5 分钟）
- 登录 Zeabur 控制台
- 添加 TCP 端口 55036
- 记下外部端口号

### 2. 推送配置文件（可选）
\`\`\`bash
cd D:\\airkopapp\\JKT99ATM-main\\ATMWater-BACKEND
git push origin main
\`\`\`

### 3. 等待服务重启（2-3 分钟）

### 4. 测试 TCP 连接
\`\`\`bash
python test_tcp_client.py
\`\`\`

---

## 📞 需要帮助？

如果配置后还是连接不上，请提供：
1. Zeabur 端口配置截图
2. Zeabur 日志（最后 50 行）
3. 测试脚本的完整输出

---

## 🎉 预期结果

配置成功后，你应该看到：

\`\`\`
========================================
🧪 ATMWater TCP Server Test
========================================

[1/5] Connecting to atmwater-backend.zeabur.app:55036...
✅ Connected successfully

[2/5] Testing device authentication...
✅ Authentication successful

[3/5] Testing heartbeat...
✅ Heartbeat successful

[4/5] Testing swipe water (Physical Card)...
✅ Water dispensed successfully
   Balance: Rp 48750
   Transaction ID: 1

[5/5] Testing swipe water (Virtual Card)...
✅ Water dispensed successfully
   Balance: Rp 48000
   Transaction ID: 2

========================================
✅ All tests completed successfully!
========================================
\`\`\`

