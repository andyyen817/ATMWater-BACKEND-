// Only load .env file if it exists (for local development)
try {
    const result = require('dotenv').config();
    if (result.error) {
        console.log('ℹ️ Dotenv could not load .env file:', result.error.message);
    } else {
        console.log('✅ .env file loaded successfully');
        console.log('ℹ️ MONGODB_URI starts with:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'undefined');
    }

    // 强制设置硬件密钥（如果 .env 中没有）
    if (!process.env.HARDWARE_APPID) {
        process.env.HARDWARE_APPID = 'aba3e622b274fd0c';
        process.env.HARDWARE_APPKEY = '6f69164cc4134b54c7d8bae46866a0e0';
    }
} catch (error) {
    console.log('ℹ️ No .env file found - using environment variables');
}
const app = require('./app');
const connectDB = require('./config/db');
const SubscriptionService = require('./services/subscriptionService');
const { seedSettings } = require('./controllers/settingController');
const websocketService = require('./services/websocketService');
const completeDataSyncService = require('./services/completeDataSyncService');
const http = require('http');

const PORT = process.env.PORT || 5000;

// 启动服务器
const startServer = async () => {
    try {
        // 1. 先尝试连接数据库
        await Promise.race([
            connectDB(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 10000))
        ]);

        // 2. 初始化设置
        await seedSettings();

        // 3. 初始化订阅费定时检查任务
        SubscriptionService.initScheduler();

    } catch (error) {
        console.error('⚠️ Server initialization warning:', error.message);
        console.log('Server will start but some database-dependent features may fail.');
    }

    // 4. 创建HTTP服务器
    const server = http.createServer(app);

    // 5. 初始化WebSocket服务
    websocketService.initialize(server);

    // 6. 启动完整数据同步服务（替换旧的设备同步服务）
    completeDataSyncService.start();

    // 7. 监听端口
    server.listen(PORT, () => {
        console.log(`🚀 Server started on port ${PORT}`);
        console.log(`🌍 Health check: http://localhost:${PORT}/api/health`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
        console.log(`🔄 Data Sync: Running (Devices: 30s, Cards: 5min, Transactions: 10min, Filters: 1h)`);
        console.log(`📡 Webhook: http://localhost:${PORT}/api/webhook/*`);
    });

    // 8. 优雅关闭
    process.on('SIGTERM', () => {
        console.log('[Server] SIGTERM received, shutting down gracefully...');
        completeDataSyncService.stop();
        websocketService.close();
        server.close(() => {
            console.log('[Server] Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('[Server] SIGINT received, shutting down gracefully...');
        completeDataSyncService.stop();
        websocketService.close();
        server.close(() => {
            console.log('[Server] Server closed');
            process.exit(0);
        });
    });
};

startServer();
