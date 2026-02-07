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

# 暴露端口
EXPOSE 8080 55036

# 启动命令（使用根目录的 server.js）
CMD ["node", "server.js"]
