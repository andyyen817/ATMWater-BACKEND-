# ATMWater 后端开发指南 (MVP 阶段)

## 任务 P1-INF-001：环境与数据库配置

当前已完成后端基础工程的搭建。为了让系统真正运行起来，您需要配置 MongoDB Atlas 云数据库。

### 1. 准备工作 (技术小白操作指南)
1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)。
2. 创建一个免费集群 (Free Tier)。
3. 在 "Network Access" 中添加当前 IP (或 0.0.0.0/0 允许所有)。
4. 在 "Database User" 中创建一个账号密码。
5. 点击 "Connect" -> "Drivers" -> 复制连接字符串 (Connection String)。

### 2. 配置环境变量
在 `ATMWater-BACKEND` 目录下创建一个名为 `.env` 的文件，内容如下：
```env
PORT=3000
MONGODB_URI=mongodb+srv://Molly:Molly78901@atmrefill.7t5xtjk.mongodb.net/ATMWater_Refill?appName=ATMRefill
JWT_SECRET=eb127bb1d485ebfe231dea8fd53ce36054a80b00194395bd40852171b6ae586f
HMAC_SECRET=ATMWater_HMAC_Security_Key
```

### 3. 如何运行
在终端执行：
```bash
cd ATMWater-BACKEND
npm start
```
如果看到 `✅ MongoDB Connected`，说明您的后端基础设施已成功部署。

---
**当前已安装的技术组件：**
- **Express**: 处理所有的网页请求。
- **Mongoose**: 专门负责与 MongoDB 数据库打交道。
- **Helmet & CORS**: 保护服务器免受基础攻击，并允许移动端连接。
- **Dotenv**: 保护您的数据库密码不被泄露。

