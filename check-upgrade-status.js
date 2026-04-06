const axios = require('axios');

const BASE_URL = 'https://atmwater-backend.zeabur.app';
const PHONE = '081234567891';
const PASSWORD = 'admin123';

async function checkUpgradeStatus() {
  try {
    // 1. 登录获取 token
    console.log('正在登录...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login-password`, {
      phoneNumber: PHONE,
      password: PASSWORD
    });
    
    const token = loginRes.data.token;
    console.log('✅ 登录成功\n');
    
    // 2. 获取升级任务列表
    console.log('正在获取升级任务列表...');
    const tasksRes = await axios.get(`${BASE_URL}/api/firmware/upgrade/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const tasks = tasksRes.data.data;
    console.log(`\n找到 ${tasks.length} 个升级任务：\n`);
    
    // 3. 显示最近的任务
    tasks.slice(0, 5).forEach((task, index) => {
      console.log(`任务 ${index + 1}:`);
      console.log(`  ID: ${task.id}`);
      console.log(`  设备 ID: ${task.deviceId}`);
      console.log(`  版本: ${task.versionBefore} → ${task.versionAfter}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  进度: ${task.progress}%`);
      console.log(`  创建时间: ${task.createdAt}`);
      console.log(`  更新时间: ${task.updatedAt}`);
      console.log('');
    });
    
    // 4. 统计状态
    const statusCount = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('状态统计:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} 个任务`);
    });
    
  } catch (error) {
    console.error('错误:', error.response?.data || error.message);
  }
}

checkUpgradeStatus();
