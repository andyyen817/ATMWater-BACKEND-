const axios = require('axios');

const BASE_URL = 'https://atmwater-backend.zeabur.app';
const PHONE = '081234567891';
const PASSWORD = 'admin123';

async function checkConnection() {
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login-password`, {
      phoneNumber: PHONE,
      password: PASSWORD
    });
    const token = loginRes.data.token;
    
    const unitsRes = await axios.get(`${BASE_URL}/api/admin/units`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const device = unitsRes.data.data[0];
    console.log('设备信息:');
    console.log(`  设备 ID: ${device.deviceId}`);
    console.log(`  设备名称: ${device.deviceName}`);
    console.log(`  数据库状态: ${device.status}`);
    console.log(`  最后心跳: ${device.lastHeartbeatAt}`);
    console.log(`  当前版本: ${device.firmwareVersion}`);
    
    const now = new Date();
    const lastHeartbeat = new Date(device.lastHeartbeatAt);
    const diffMinutes = Math.floor((now - lastHeartbeat) / 1000 / 60);
    
    console.log(`\n心跳时间差: ${diffMinutes} 分钟前`);
    
    if (diffMinutes < 3) {
      console.log('✅ 设备在线（心跳正常）');
    } else {
      console.log('⚠️  设备可能离线（心跳超时）');
    }
    
    console.log('\n注意: TCP 连接状态和数据库状态可能不同');
    console.log('如果设备刚重启，TCP 连接可能还未建立');
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

checkConnection();
