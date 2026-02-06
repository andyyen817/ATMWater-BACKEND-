const { generateSignature } = require('./src/utils/signature');

// 模拟文档中的示例
const testParams = {
    appid: 'test_appid_123',
    nonce_str: 'abcde12345',
    device_no: '90000001',
    cash: 100
};

const testAppKey = '123456789';

const sign = generateSignature(testParams, testAppKey);

console.log('--- 签名算法测试 ---');
console.log('待签名参数:', testParams);
console.log('使用 AppKey:', testAppKey);
console.log('生成签名 (Sign):', sign);
console.log('--------------------');

// 验证逻辑：
// 1. 排序: appid, cash, device_no, nonce_str
// 2. 拼接: appid=test_appid_123&cash=100&device_no=90000001&nonce_str=abcde12345
// 3. 加盐: appid=test_appid_123&cash=100&device_no=90000001&nonce_str=abcde12345&appkey=123456789
// 4. MD5 并大写

