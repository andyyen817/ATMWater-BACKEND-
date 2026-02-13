require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

console.log('🔄 开始数据库迁移...\n');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log
  }
);

async function runMigration() {
  try {
    // 测试连接
    console.log('📡 测试数据库连接...');
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 读取SQL文件
    const sqlFile = path.join(__dirname, 'migrations', 'add_unit_fields_20260212.sql');
    console.log('📄 读取迁移文件:', sqlFile);
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 分割SQL语句（按分号分割）
    // 移除注释行和空行
    const lines = sql.split('\n');
    const cleanedLines = lines
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });

    const cleanedSql = cleanedLines.join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // 过滤掉空语句和DESCRIBE/SELECT语句
        if (s.length === 0) return false;
        if (s.toUpperCase().startsWith('DESCRIBE')) return false;
        if (s.toUpperCase().startsWith('SELECT \'')) return false;
        return true;
      });

    console.log(`📝 找到 ${statements.length} 条SQL语句\n`);

    // 执行每条SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] 执行SQL:`);
      console.log(statement.substring(0, 100) + '...\n');

      try {
        await sequelize.query(statement);
        console.log('✅ 成功');
      } catch (error) {
        // 如果是字段已存在的错误，忽略
        if (error.message.includes('Duplicate column name') ||
            error.message.includes('already exists')) {
          console.log('⚠️  字段已存在，跳过');
        } else {
          console.error('❌ 错误:', error.message);
          throw error;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 数据库迁移完成！');
    console.log('='.repeat(60));

    // 验证新字段
    console.log('\n📊 验证新字段...\n');

    const [unitsFields] = await sequelize.query('DESCRIBE units');

    const newUnitsFields = ['signal_quality', 'crc_checksum', 'imei'];

    console.log('Units表新字段:');
    newUnitsFields.forEach(field => {
      const exists = unitsFields.some(f => f.Field === field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    });

    // 显示示例数据
    console.log('\n📊 示例数据（前5条）：\n');
    const [rows] = await sequelize.query(`
      SELECT device_id, imei, signal_quality, crc_checksum
      FROM units
      LIMIT 5
    `);

    if (rows.length > 0) {
      console.table(rows);
    } else {
      console.log('   (暂无数据)');
    }

    console.log('\n✅ 迁移验证完成！');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
