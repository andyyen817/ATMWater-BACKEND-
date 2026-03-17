// 查询数据库中的管理员账号
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkAdminAccounts() {
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

    // 查询所有管理员角色的账号
    console.log('📋 查询管理员账号...\n');
    const [admins] = await connection.query(
      `SELECT id, phone_number, name, role, is_active
       FROM users
       WHERE role IN ('Super-Admin', 'GM', 'Admin')
       ORDER BY role, id`
    );

    if (admins.length > 0) {
      console.log(`找到 ${admins.length} 个管理员账号：\n`);
      admins.forEach(admin => {
        console.log(`ID: ${admin.id}`);
        console.log(`手机号: ${admin.phone_number}`);
        console.log(`姓名: ${admin.name || '未设置'}`);
        console.log(`角色: ${admin.role}`);
        console.log(`状态: ${admin.is_active ? '激活' : '未激活'}`);
        console.log('---');
      });
    } else {
      console.log('❌ 没有找到管理员账号');
    }

    // 查询 081234567891 账号信息
    console.log('\n📋 查询账号 081234567891 的信息...\n');
    const [user] = await connection.query(
      `SELECT id, phone_number, name, role, is_active
       FROM users
       WHERE phone_number = '081234567891'`
    );

    if (user.length > 0) {
      console.log('当前账号信息：');
      console.log(`ID: ${user[0].id}`);
      console.log(`手机号: ${user[0].phone_number}`);
      console.log(`姓名: ${user[0].name || '未设置'}`);
      console.log(`当前角色: ${user[0].role}`);
      console.log(`状态: ${user[0].is_active ? '激活' : '未激活'}`);

      if (user[0].role !== 'Super-Admin' && user[0].role !== 'GM' && user[0].role !== 'Admin') {
        console.log('\n⚠️ 该账号角色不符合固件管理权限要求');
        console.log('需要角色: Super-Admin, GM, Admin');
        console.log(`当前角色: ${user[0].role}`);
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

checkAdminAccounts();
