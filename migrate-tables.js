// 数据库表迁移脚本
// 在Zeabur MySQL服务器上创建maintenance_logs和water_quality_logs表

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Sequelize } = require('sequelize');
const fs = require('fs').promises;

// 使用.env中的Zeabur MySQL配置
const sequelize = new Sequelize({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: 'mysql',
    logging: false
});

async function migrateDatabase() {
    try {
        console.log('='.repeat(60));
        console.log('🔧 开始执行数据库迁移 (Zeabur MySQL)');
        console.log('='.repeat(60));
        console.log();

        // 测试连接
        console.log('📡 连接到Zeabur MySQL数据库...');
        console.log(`   主机: ${process.env.DB_HOST}`);
        console.log(`   端口: ${process.env.DB_PORT}`);
        console.log(`   数据库: ${process.env.DB_NAME}`);
        console.log();

        await sequelize.authenticate();
        console.log('✅ 数据库连接成功');
        console.log();

        // 检查现有表
        console.log('🔍 检查现有表结构...');
        const [tables] = await sequelize.query("SHOW TABLES LIKE '%logs%'");
        const existingTables = tables.map(row => Object.values(row)[0]);
        console.log(`   找到 ${existingTables.length} 个相关表: ${existingTables.join(', ') || '无'}`);
        console.log();

        // 读取SQL文件
        const maintenanceLogsSql = await fs.readFile(
            path.join(__dirname, 'migrations', 'create_maintenance_logs_table.sql'),
            'utf8'
        );

        const waterQualityLogsSql = await fs.readFile(
            path.join(__dirname, 'migrations', 'create_water_quality_logs_table.sql'),
            'utf8'
        );

        // 创建 maintenance_logs 表
        if (existingTables.includes('maintenance_logs')) {
            console.log('ℹ️  maintenance_logs 表已存在，跳过创建');
        } else {
            console.log('📝 创建 maintenance_logs 表...');
            await sequelize.query(maintenanceLogsSql);
            console.log('✅ maintenance_logs 表创建成功');
        }
        console.log();

        // 创建 water_quality_logs 表
        if (existingTables.includes('water_quality_logs')) {
            console.log('ℹ️  water_quality_logs 表已存在，跳过创建');
        } else {
            console.log('📝 创建 water_quality_logs 表...');
            await sequelize.query(waterQualityLogsSql);
            console.log('✅ water_quality_logs 表创建成功');
        }
        console.log();

        // 验证表结构
        console.log('🔍 验证表结构...');
        const [maintenanceColumns] = await sequelize.query('DESCRIBE maintenance_logs');
        console.log(`✅ maintenance_logs 表结构验证成功 (${maintenanceColumns.length} 个字段)`);

        const [waterQualityColumns] = await sequelize.query('DESCRIBE water_quality_logs');
        console.log(`✅ water_quality_logs 表结构验证成功 (${waterQualityColumns.length} 个字段)`);
        console.log();

        console.log('='.repeat(60));
        console.log('✅ 数据库迁移完成！');
        console.log('='.repeat(60));

        return true;

    } catch (error) {
        console.error('❌ 迁移失败:');
        console.error(`   ${error.message}`);
        console.log();

        if (error.name === 'SequelizeConnectionError') {
            console.log('💡 提示: 无法连接到Zeabur MySQL数据库');
            console.log('   - 检查网络连接');
            console.log('   - 检查 .env 文件中的数据库配置');
        } else if (error.name === 'SequelizeAccessDeniedError') {
            console.log('💡 提示: 数据库认证失败');
            console.log('   - 检查用户名和密码是否正确');
        }

        return false;

    } finally {
        await sequelize.close();
    }
}

// 执行迁移
migrateDatabase().then(success => {
    process.exit(success ? 0 : 1);
});
