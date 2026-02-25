/**
 * 运行数据库迁移脚本
 * 创建 user_logs 表
 */

const sequelize = require('./src/config/database');
const UserLog = require('./src/models/UserLog');

async function runMigration() {
  try {
    console.log('🔄 开始数据库迁移...');

    // 同步 UserLog 模型（创建表）
    await UserLog.sync({ alter: true });

    console.log('✅ user_logs 表创建/更新成功！');
    console.log('📊 表结构:');
    console.log('  - id: INT (主键, 自增)');
    console.log('  - userId: INT (外键 -> users.id)');
    console.log('  - logs: LONGTEXT (日志内容)');
    console.log('  - deviceInfo: JSON (设备信息)');
    console.log('  - appVersion: VARCHAR(50) (APP版本)');
    console.log('  - uploadedAt: DATETIME (上传时间)');
    console.log('  - createdAt: DATETIME (创建时间)');
    console.log('  - updatedAt: DATETIME (更新时间)');

    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
