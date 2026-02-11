// 测试新添加的API端点
// 运行方式: node test-new-apis.js

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';
const TEST_USER = {
    phoneNumber: '081234567891',
    password: 'admin123'
};

let authToken = '';

async function login() {
    console.log('\n=== 1. 登录测试 ===');
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/login-password`, TEST_USER);
        if (response.data.success) {
            authToken = response.data.token;
            console.log('✅ 登录成功');
            console.log('用户:', response.data.user);
            return true;
        }
    } catch (error) {
        console.error('❌ 登录失败:', error.response?.data || error.message);
        return false;
    }
}

async function testGetUnits() {
    console.log('\n=== 2. 测试 GET /api/admin/units ===');
    try {
        const response = await axios.get(`${BASE_URL}/api/admin/units`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ API调用成功');
            console.log('设备数量:', response.data.count);
            console.log('返回数据格式:', {
                success: response.data.success,
                count: response.data.count,
                dataIsArray: Array.isArray(response.data.data),
                firstDevice: response.data.data[0] ? {
                    id: response.data.data[0].id,
                    deviceId: response.data.data[0].deviceId,
                    location: response.data.data[0].location,
                    status: response.data.data[0].status
                } : 'No devices'
            });
            return true;
        }
    } catch (error) {
        console.error('❌ API调用失败:', error.response?.data || error.message);
        return false;
    }
}

async function testGetPartnersTree() {
    console.log('\n=== 3. 测试 GET /api/partners/tree ===');
    try {
        const response = await axios.get(`${BASE_URL}/api/partners/tree`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            console.log('✅ API调用成功');
            console.log('合伙人数量:', response.data.data.length);
            console.log('返回数据格式:', {
                success: response.data.success,
                dataIsArray: Array.isArray(response.data.data),
                firstPartner: response.data.data[0] || 'No partners (这是正常的，因为数据库中没有RP用户)'
            });
            return true;
        }
    } catch (error) {
        console.error('❌ API调用失败:', error.response?.data || error.message);
        return false;
    }
}

async function runTests() {
    console.log('========================================');
    console.log('开始测试新添加的API端点');
    console.log('========================================');

    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ 登录失败，无法继续测试');
        return;
    }

    const test1 = await testGetUnits();
    const test2 = await testGetPartnersTree();

    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log('登录:', '✅');
    console.log('GET /api/admin/units:', test1 ? '✅' : '❌');
    console.log('GET /api/partners/tree:', test2 ? '✅' : '❌');
    console.log('========================================');

    if (test1 && test2) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n⚠️ 部分测试失败，请检查错误信息');
    }
}

runTests();
