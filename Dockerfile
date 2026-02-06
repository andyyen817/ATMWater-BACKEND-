FROM node:22-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 环境变量
ENV NODE_ENV=production

# 移除硬编码的 PORT，让 Zeabur 注入
# EXPOSE 只是声明，实际端口以 server.js 中监听的 process.env.PORT 为准
EXPOSE 3000

# 启动命令
CMD ["node", "src/server.js"]
