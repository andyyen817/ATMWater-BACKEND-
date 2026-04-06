const axios = require('axios');

const BASE_URL = 'https://atmwater-backend.zeabur.app';
const PHONE = '081234567891';
const PASSWORD = 'admin123';

async function testUpgrade() {
  try {
    // 1. 登录
    console.log('正在登录...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login-password`, {
      phoneNumber: PHONE,
      password: PASSWORD
    });
    const token = loginRes.data.token;
    console.log('✅ 登录成功\n');
    
    // 2. 获取设备列表
    console.log('正在获取设备列表...');
    const unitsRes = await axios.get(`${BASE_URL}/api/admin/units`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const devices = unitsRes.data.data;
    console.log(`找到 ${devices.length} 个设备\n`);
    
    if (devices.length === 0) {
      console.log('❌ 没有可用设备');
      return;
    }
    
    const device = devices[0];
    console.log(`测试设备: ${device.deviceId} (${device.deviceName})`);
    console.log(`当前版本: ${device.firmwareVersion}`);
    console.log(`设备状态: ${device.status}\n`);
    
    // 3. 创建升级任务
    console.log('正在创建升级任务...');
    const upgradeRes = await axios.post(`${BASE_URL}/api/firmware/upgrade`, {
      firmwareId: 1,
      unitIds: [device.deviceId]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ 升级任务创建成功\n');
    console.log('响应数据:');
    console.log(JSON.stringify(upgradeRes.data, null, 2));
    
    const { taskCount, sentCount, offlineCount } = upgradeRes.data.data;
    console.log(`\n任务统计:`);
    console.log(`  创建任务数: ${taskCount}`);
    console.log(`  已发送命令: ${sentCount}`);
    console.log(`  离线设备: ${offlineCount}`);
    
    if (sentCount > 0) {
      console.log('\n✅ 升级命令已发送到设备');
      console.log('设备应该会收到 UpgradeVer 命令并开始升级');
    } else if (offlineCount > 0) {
      console.log('\n⚠️  设备离线，升级命令将在设备上线时发送');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.response?.data || error.message);
  }
}

testUpgrade();
