const mongoose = require('mongoose');

// Singleton connection state
let isConnected = false;

/**
 * 数据库连接配置 (采用 MongoDB Stable API V1 标准)
 * 实现单例模式，防止重复连接耗尽 Socket 资源
 */
const connectDB = async () => {
    // 如果已经连接，直接返回，避免重复建立 Socket 连接 (P1-INF-002)
    if (isConnected) {
        console.log('ℹ️ Using existing MongoDB connection');
        return true;
    }

    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
        console.error('❌ DATABASE ERROR: MONGODB_URI is not defined in environment variables.');
        return false; 
    }

    try {
        // 使用您提供的 Stable API 推荐配置进行连接
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, // 5秒探测超时
            // 以下为 MongoDB V1 稳定版 API 配置
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true,
            }
        });

        isConnected = true;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return true;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        console.log('💡 Tip: Please ensure 0.0.0.0/0 is whitelisted in MongoDB Atlas Network Access.');
        isConnected = false;
        return false;
    }
};

module.exports = connectDB;

