// ATMWater-BACKEND/src/config/database.js

const { Sequelize } = require('sequelize');

// 创建 Sequelize 实例
const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'zeabur',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  dialect: 'mysql',
  
  // 连接池配置
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  
  // 日志配置
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  
  // 时区配置（印尼时区）
  timezone: '+07:00',
  
  // 字符集配置
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: true,
    underscored: true  // 使用下划线命名（created_at 而不是 createdAt）
  }
});

// 测试连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('[MySQL] ✅ Connection established successfully');
    console.log(`[MySQL] 📊 Database: ${process.env.DB_NAME || 'zeabur'}`);
    console.log(`[MySQL] 🌐 Host: ${process.env.DB_HOST || 'localhost'}`);
  } catch (error) {
    console.error('[MySQL] ❌ Unable to connect:', error.message);
    process.exit(1);
  }
};

// 自动测试连接
testConnection();

module.exports = sequelize;

