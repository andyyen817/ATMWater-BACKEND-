// 更新用户角色为 Super-Admin
require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateUserRole() {
  let connection;

  try {
    console.log('🔌 连接到数据库...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ 数据库连接成功\n');

    // 查询当前角色
    console.log('📋 查询账号 081234567891 当前信息...\n');
    const [before] = await connection.query(
      `SELECT id, phone, name, role FROM users WHERE phone = '081234567891'`
    );

    if (before.length === 0) {
      console.log('❌ 未找到该账号');
      return;
    }

    console.log('更新前：');
    console.log(`ID: ${before[0].id}`);
    console.log(`手机号: ${before[0].phone}`);
    console.log(`姓名: ${before[0].name}`);
    console.log(`当前角色: ${before[0].role}`);

    // 更新角色为 Super-Admin
    console.log('\n🔄 正在更新角色为 Super-Admin...\n');
    await connection.query(
      `UPDATE users SET role = 'Super-Admin' WHERE phone = '081234567891'`
    );

    // 查询更新后的信息
    const [after] = await connection.query(
      `SELECT id, phone, name, role FROM users WHERE phone = '081234567891'`
    );

    console.log('✅ 更新成功！\n');
    console.log('更新后：');
    console.log(`ID: ${after[0].id}`);
    console.log(`手机号: ${after[0].phone}`);
    console.log(`姓名: ${after[0].name}`);
    console.log(`新角色: ${after[0].role}`);

    console.log('\n🎉 账号 081234567891 已升级为 Super-Admin！');
    console.log('现在可以使用该账号访问固件管理功能了。');

  } catch (error) {
    console.error('❌ 更新失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

updateUserRole();
