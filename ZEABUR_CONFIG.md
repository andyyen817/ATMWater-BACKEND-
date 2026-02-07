# Zeabur 部署配置说明

## 📋 环境变量配置

### 必须配置的环境变量

在 Zeabur 服务设置中添加以下环境变量：

```bash
# ========== 数据库配置（使用 Zeabur MySQL 内网连接）==========
DB_HOST=${MYSQL_HOST}
DB_PORT=${MYSQL_PORT}
DB_NAME=${MYSQL_DATABASE}
DB_USER=${MYSQL_USERNAME}
DB_PASSWORD=${MYSQL_PASSWORD}

# ========== 服务器配置 ==========
NODE_ENV=production
PORT=8080
TCP_PORT=55036

# ========== JWT密钥 ==========
JWT_SECRET=${PASSWORD}
JWT_EXPIRE=30d
```

### Zeabur 自动注入的环境变量（无需手动配置）

```bash
# MySQL 数据库变量
MYSQL_HOST=atmwater-backend.zeabur.internal
MYSQL_PORT=3306
MYSQL_DATABASE=zeabur
MYSQL_USERNAME=root
MYSQL_PASSWORD=m6RE5f3pADClMNn9ca47Z1z028gbXxuW

# 通用密码变量
PASSWORD=C5n2e4BI8frbjvt3k6MZ7GuXwh1JH90m
```

## 🌐 网络配置

### 内网访问（项目内部服务）

```yaml
主机: atmwater-backend.zeabur.internal
端口: 8080
协议: HTTP
```

### 公网访问

```yaml
域名: atmwater-backend.zeabur.app
HTTP端口: 443 (HTTPS)
TCP端口: 55036 (需要手动添加)
```

## 🔧 端口配置

### 已配置的端口

- ✅ **HTTP端口**: `8080` (容器端口)
  - 公网访问: `https://atmwater-backend.zeabur.app`
  - 用途: REST API、WebSocket

### 需要添加的端口

- ⚠️ **TCP端口**: `55036` (容器端口)
  - 公网访问: `atmwater-backend.zeabur.app:55036`
  - 用途: 硬件设备 TCP 长连接

**添加步骤：**
1. 进入 Zeabur 服务设置
2. 点击 "网络" 标签
3. 点击 "暴露新端口"
4. 输入端口号: `55036`
5. 选择协议: `TCP`
6. 保存

## 📊 数据库配置对比

| 项目 | 旧配置（公网） | 新配置（Zeabur内网） |
|------|--------------|-------------------|
| 主机 | hkg1.clusters.zeabur.com | ${MYSQL_HOST} |
| 端口 | 30886 | ${MYSQL_PORT} (3306) |
| 数据库名 | atmwater | ${MYSQL_DATABASE} (zeabur) |
| 用户名 | root | ${MYSQL_USERNAME} (root) |
| 密码 | 手动配置 | ${MYSQL_PASSWORD} (自动注入) |

**优势：**
- ✅ 内网连接更快
- ✅ 更安全（不暴露公网）
- ✅ 自动管理密码

## 🚀 部署检查清单

- [ ] GitHub 仓库已连接
- [ ] 环境变量已配置
- [ ] HTTP 端口 8080 已暴露
- [ ] TCP 端口 55036 已暴露
- [ ] 服务部署成功
- [ ] 数据库连接正常
- [ ] TCP 服务器启动正常

## 🧪 测试命令

### 测试 HTTP 接口

```bash
curl https://atmwater-backend.zeabur.app/api/health
```

### 测试 TCP 端口

```bash
# Windows PowerShell
Test-NetConnection -ComputerName atmwater-backend.zeabur.app -Port 55036

# Linux/Mac
telnet atmwater-backend.zeabur.app 55036
```

## 📝 提供给硬件工程师的信息

```yaml
# TCP 服务器连接信息
服务器地址: atmwater-backend.zeabur.app
TCP 端口: 55036
协议: TCP长连接
数据格式: JSON (每条消息以 \n 结尾)
字符编码: UTF-8
心跳间隔: 60秒
超时时间: 120秒

# 设备认证信息
设备ID: DEVICE001
设备密码: pudow
设备类型: WaterDispenser
```

## ⚠️ 重要注意事项

1. **端口变更**: 从 `5000` 改为 `8080`
2. **数据库名**: 从 `atmwater` 改为 `zeabur`
3. **内网连接**: 使用 Zeabur 环境变量而非硬编码
4. **JWT密钥**: 使用 Zeabur 提供的 `PASSWORD` 变量
5. **TCP端口**: 需要手动在 Zeabur 控制台添加

## 🔗 相关链接

- **GitHub 仓库**: https://github.com/andyyen817/ATMWater-BACKEND-
- **Zeabur 控制台**: https://zeabur.com
- **公网域名**: https://atmwater-backend.zeabur.app

