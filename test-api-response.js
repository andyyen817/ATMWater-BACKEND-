// 测试实际 API 响应
const https = require('https');

// 从环境变量获取 token（你需要先登录获取）
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwicm9sZSI6IlN1cGVyLUFkbWluIiwiaWF0IjoxNzQyNDY5NjI3LCJleHAiOjE3NDMwNzQ0Mjd9.Ql-Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8Qs8'; // 这是示例，需要实际的 token

const options = {
  hostname: 'atmwater-backend.zeabur.app',
  port: 443,
  path: '/api/firmware/list',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('📋 测试 API: GET /api/firmware/list\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`状态码: ${res.statusCode}\n`);
    console.log('响应头:');
    console.log(JSON.stringify(res.headers, null, 2));
    console.log('\n响应体:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      if (json.success && json.data) {
        console.log(`\n✅ 返回 ${json.data.length} 个固件版本`);
      } else {
        console.log('\n❌ 响应格式不正确');
      }
    } catch (e) {
      console.log(data);
      console.log('\n❌ 无法解析 JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
});

req.end();
