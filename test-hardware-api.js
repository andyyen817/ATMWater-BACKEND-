const hardwareService = require('./src/services/hardwareService');

const testHardwareAPI = async () => {
    console.log('=== Testing Renren Water Station API ===\n');

    // 测试1: 查询设备信息
    console.log('[Test 1] Querying device info for 86362857...');
    try {
        const deviceInfo = await hardwareService.getDeviceInfo('86362857');
        console.log('Response:', JSON.stringify(deviceInfo, null, 2));

        if (deviceInfo.success && deviceInfo.code === 0) {
            console.log('\n✅ API Test PASSED!');
            console.log('Device Info:');
            console.log('  - Online:', deviceInfo.result.is_online ? 'Yes' : 'No');
            console.log('  - Price:', deviceInfo.result.price, 'fen');
            console.log('  - Speed:', deviceInfo.result.speed, 'L/min');

            // 测试2: 同步到本地数据库
            console.log('\n[Test 2] Syncing device to local database...');
            const synced = await hardwareService.syncDeviceToLocal('86362857');
            if (synced) {
                console.log('✅ Device synced successfully!');
                console.log('Local Device ID:', synced.unitId);
                console.log('Local Status:', synced.status);
            } else {
                console.log('❌ Sync failed');
            }
        } else {
            console.log('\n❌ API Test FAILED!');
            console.log('Error:', deviceInfo.error || 'Unknown error');
            console.log('Code:', deviceInfo.code);
        }
    } catch (error) {
        console.error('❌ API Request Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }

    console.log('\n=== Test Complete ===');
    process.exit(0);
};

testHardwareAPI();
