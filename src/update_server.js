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
const { seedSettings } = require('./controllers/settingController'); // P1-WEB-001

const PORT = process.env.PORT || 3000;

// 启动服务器
const startServer = async () => {
    try {
        // 1. 先尝试连接数据库 (P1-INF-001 核心要求)
        // 增加 10 秒超时限制，防止连接数据库挂死整个启动流程
        await Promise.race([
            connectDB(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout')), 10000))
        ]);

        // 2. 初始化设置
        await seedSettings();

        // 3. 初始化订阅费定时检查任务 (P2-API-005)
        SubscriptionService.initScheduler();

    } catch (error) {
        console.error('⚠️ Server initialization warning:', error.message);
        console.log('Server will start but some database-dependent features may fail.');
    }

    // 3. 无论数据库是否成功连接，都监听端口，确保 Zeabur 健康检查通过
    app.listen(PORT, () => {
        console.log(`🚀 Server started on port ${PORT}`);
        console.log(`🌍 Health check: http://localhost:${PORT}/api/health`);
    });
};

startServer();
