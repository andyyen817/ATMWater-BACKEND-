# ATMWater Backend Server

ATMWater 后端服务器 - 支持 TCP 协议的智能取水站管理系统

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **MySQL** - 数据库 (Sequelize ORM)
- **TCP Server** - 硬件设备通信
- **WebSocket** - 实时通知

## 功能特性

- ✅ TCP 长连接管理（端口 55036）
- ✅ 设备认证与心跳监控
- ✅ 用水交易处理（带事务保护）
- ✅ 余额查询与充值
- ✅ 水质数据记录
- ✅ WebSocket 实时推送
- ✅ RESTful API

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 数据库配置
DB_HOST=hkg1.clusters.zeabur.com
DB_PORT=30886
DB_NAME=atmwater
DB_USER=root
DB_PASSWORD=your_password

# 服务器配置
NODE_ENV=production
PORT=5000
TCP_PORT=55036

# JWT配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
```

### 3. 初始化数据库

```bash
# 初始化设备
node scripts/initDevices.js

# 初始化测试用户
node scripts/initUsers.js
```

### 4. 启动服务器

```bash
npm start
```

## TCP 协议说明

### 连接信息

- **服务器地址**: `atmwater-backend.zeabur.app`
- **TCP 端口**: `55036`
- **数据格式**: JSON (每条消息以 `\n` 结尾)
- **字符编码**: UTF-8

### 支持的指令

| 指令 | 说明 | 方向 |
|------|------|------|
| AU | 设备认证 | 设备 → 服务器 |
| HB | 心跳 | 设备 ⇄ 服务器 |
| WR | 用水上报 | 设备 → 服务器 |
| QB | 余额查询 | 设备 → 服务器 |
| OW | 开水指令 | 服务器 → 设备 |
| AM | 充值指令 | 服务器 → 设备 |

## API 文档

### 认证接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/send-otp` - 发送验证码

### 钱包接口

- `POST /api/wallet/topup` - 充值
- `GET /api/wallet/balance` - 查询余额
- `GET /api/wallet/transactions` - 交易记录

### 设备接口

- `POST /api/iot/authorize-dispense` - 授权出水
- `GET /api/iot/nearby` - 获取附近设备
- `GET /api/iot/units/:id` - 设备详情
- `GET /api/iot/water-quality/:id` - 水质历史

## 部署到 Zeabur

1. 连接 GitHub 仓库
2. 配置环境变量
3. 暴露端口 5000 和 55036
4. 自动部署

## 项目结构

```
ATMWater-BACKEND/
├── src/
│   ├── config/          # 配置文件
│   ├── models/          # 数据模型
│   ├── controllers/     # 控制器
│   ├── routes/          # 路由
│   ├── services/        # 服务层
│   │   ├── tcpServer.js       # TCP服务器
│   │   └── websocketService.js # WebSocket服务
│   └── middleware/      # 中间件
├── scripts/             # 初始化脚本
├── server.js            # 入口文件
└── package.json
```

## 许可证

MIT License

## 联系方式

- 项目维护: 开发团队
- 技术支持: [GitHub Issues](https://github.com/andyyen817/ATMWater-BACKEND-/issues)

