const axios = require('axios');

const BASE_URL = 'https://atmwater-backend.zeabur.app';
const PHONE = '081234567891';
const PASSWORD = 'admin123';

async function debugUpgrade() {
  try {
    // 1. 登录
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login-password`, {
      phoneNumber: PHONE,
      password: PASSWORD
    });
    const token = loginRes.data.token;
    
    // 2. 测试不同的参数格式
    console.log('测试 1: 使用 deviceId 字符串数组');
    try {
      const res1 = await axios.post(`${BASE_URL}/api/firmware/upgrade`, {
        firmwareId: 1,
        unitIds: ["898608311123900885420001"]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ 成功:', res1.data);
    } catch (e) {
      console.log('❌ 失败:', e.response?.data);
    }
    
    console.log('\n测试 2: 使用数字 ID');
    try {
      const res2 = await axios.post(`${BASE_URL}/api/firmware/upgrade`, {
        firmwareId: 1,
        unitIds: [3]  // unit.id = 3
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ 成功:', res2.data);
    } catch (e) {
      console.log('❌ 失败:', e.response?.data);
    }
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

debugUpgrade();
