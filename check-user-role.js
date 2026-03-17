// 查询并更新用户角色
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkAndUpdateUser() {
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

    // 先查看表结构
    console.log('📋 查看 users 表结构...\n');
    const [columns] = await connection.query('SHOW COLUMNS FROM users');
    console.log('表字段：');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // 查询所有管理员角色的账号
    console.log('\n📋 查询管理员账号...\n');
    const [admins] = await connection.query(
      `SELECT * FROM users WHERE role IN ('Super-Admin', 'GM', 'Admin') LIMIT 10`
    );

    if (admins.length > 0) {
      console.log(`找到 ${admins.length} 个管理员账号：\n`);
      admins.forEach(admin => {
        console.log(`ID: ${admin.id}`);
        console.log(`手机号: ${admin.phone}`);
        console.log(`姓名: ${admin.name || '未设置'}`);
        console.log(`角色: ${admin.role}`);
        console.log('---');
      });
    } else {
      console.log('❌ 没有找到管理员账号');
    }

    // 查询 081234567891 账号信息
    console.log('\n📋 查询账号 081234567891 的信息...\n');
    const [user] = await connection.query(
      `SELECT * FROM users WHERE phone = '081234567891'`
    );

    if (user.length > 0) {
      console.log('当前账号信息：');
      console.log(`ID: ${user[0].id}`);
      console.log(`手机号: ${user[0].phone}`);
      console.log(`姓名: ${user[0].name || '未设置'}`);
      console.log(`当前角色: ${user[0].role}`);

      if (user[0].role === 'Steward') {
        console.log('\n⚠️ 该账号当前是 Steward 角色，需要升级为管理员角色');
        console.log('\n是否要将该账号升级为 Super-Admin？');
        console.log('如需升级，请运行: node update-user-role.js');
      }
    } else {
      console.log('❌ 未找到该账号');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

checkAndUpdateUser();
