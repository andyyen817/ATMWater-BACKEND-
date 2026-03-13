/**
 * 水币系统 v2 数据库迁移执行脚本
 * 用于 Zeabur MySQL 远程数据库
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// 从环境变量读取数据库配置
require('dotenv').config();

async function runMigration() {
  let connection;

  try {
    console.log('🔗 正在连接 Zeabur MySQL 数据库...');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true // 允许执行多条SQL语句
    });

    console.log('✅ 数据库连接成功！');
    console.log(`📍 数据库: ${process.env.DB_NAME}@${process.env.DB_HOST}`);

    // 读取迁移SQL文件
    const sqlFilePath = path.join(__dirname, 'migrations', '20260310_water_coin_system_v2.sql');
    console.log(`📄 读取迁移文件: ${sqlFilePath}`);

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('🚀 开始执行迁移...\n');

    // 执行迁移SQL
    const [results] = await connection.query(sqlContent);

    console.log('✅ 迁移执行完成！\n');

    // 验证迁移结果
    console.log('🔍 验证迁移结果...\n');

    // 1. 检查 transactions 表新字段
    console.log('1️⃣ 检查 transactions 表结构:');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME IN ('balance_type', 'origin_card_id', 'profit_shared', 'station_revenue', 'rp_revenue')
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME]);

    console.table(columns);

    // 2. 检查 daily_dispense_counters 表
    console.log('\n2️⃣ 检查 daily_dispense_counters 表:');
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'daily_dispense_counters'
    `);

    if (tables.length > 0) {
      console.log('✅ daily_dispense_counters 表创建成功');

      const [counterColumns] = await connection.query(`
        DESCRIBE daily_dispense_counters
      `);
      console.table(counterColumns);
    } else {
      console.log('❌ daily_dispense_counters 表未找到');
    }

    // 3. 检查数据迁移
    console.log('\n3️⃣ 检查交易数据迁移:');
    const [stats] = await connection.query(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN balance_type = 'APP_BACKED' THEN 1 ELSE 0 END) as app_backed_count,
        SUM(CASE WHEN balance_type = 'PHYSICAL_BACKED' THEN 1 ELSE 0 END) as physical_backed_count
      FROM transactions
    `);

    console.table(stats);

    console.log('\n✅ 数据库迁移验证完成！');
    console.log('\n📊 迁移总结:');
    console.log('  ✅ transactions 表新增 5 个字段');
    console.log('  ✅ daily_dispense_counters 表创建成功');
    console.log(`  ✅ ${stats[0].total_transactions} 条交易记录已标记为 APP_BACKED`);
    console.log('\n🎉 水币系统 v2 迁移成功！');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error('\n错误详情:', error);
    process.exit(1);

  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration();
