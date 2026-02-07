// ========================================
// ATMWater Backend Server - MySQL Version
// ========================================

// Load environment variables
try {
    require('dotenv').config();
    console.log('✅ Environment variables loaded');
} catch (error) {
    console.log('ℹ️ Using Zeabur environment variables');
}

const express = require('express');
const cors = require('cors');
const sequelize = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 8080;
const TCP_PORT = process.env.TCP_PORT || 55036;

// ========================================
// Middleware
// ========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// Health Check Route
// ========================================
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'ATMWater Backend is running',
        timestamp: new Date().toISOString(),
        database: 'MySQL',
        version: '2.0.0'
    });
});

// ========================================
// Routes (暂时注释，等模型创建完成后再启用)
// ========================================
// app.use('/api/auth', require('./src/routes/authRoutes'));
// app.use('/api/wallet', require('./src/routes/walletRoutes'));
// app.use('/api/iot', require('./src/routes/iotRoutes'));
// app.use('/api/users', require('./src/routes/userRoutes'));

// ========================================
// Error Handler
// ========================================
app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========================================
// Start Server
// ========================================
const startServer = async () => {
    try {
        // 1. 测试 MySQL 连接
        await sequelize.authenticate();
        console.log('[MySQL] ✅ Connection established');

        // 2. 同步数据库表结构（开发环境）
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            console.log('[MySQL] ✅ Database synchronized');
        }

        // 3. 启动 HTTP 服务器
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[HTTP] ✅ Server running on port ${PORT}`);
            console.log(`[HTTP] 🌍 Health check: http://localhost:${PORT}/api/health`);
        });

        // 4. 启动 TCP 服务器
        const tcpServer = require('./src/services/tcpServer');
        tcpServer.start();

        // 5. 优雅关闭
        process.on('SIGTERM', async () => {
            console.log('[Server] SIGTERM signal received: closing servers');
            server.close(() => {
                sequelize.close();
                console.log('[Server] ✅ Servers closed gracefully');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('[Server] ❌ Startup error:', error.message);
        console.error('[Server] Stack:', error.stack);

        // 即使数据库连接失败，也启动 HTTP 服务器（用于 Zeabur 健康检查）
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[HTTP] ⚠️ Server running on port ${PORT} (database connection failed)`);
        });
    }
};

startServer();
