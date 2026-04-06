// 检查所有注册的路由
const express = require('express');
const app = express();

// 加载固件路由
const firmwareRoutesModule = require('./src/routes/firmwareRoutes');

// 注册路由
app.use('/api/firmware', firmwareRoutesModule);

// 获取所有路由
function getRoutes(app) {
  const routes = [];
  
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // 直接路由
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // 路由器中间件
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const basePath = middleware.regexp.source
            .replace('\/?', '')
            .replace('(?=\/|$)', '')
            .replace(/\\//g, '/')
            .replace('^', '');
          
          routes.push({
            path: basePath + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  return routes;
}

console.log('📋 检查固件路由注册情况...\n');

const allRoutes = getRoutes(app);
const firmwareRoutesFiltered = allRoutes.filter(r => r.path.includes('firmware'));

console.log(`找到 ${firmwareRoutesFiltered.length} 个固件相关路由：\n`);

firmwareRoutesFiltered.forEach(route => {
  console.log(`${route.methods.map(m => m.toUpperCase()).join(', ')} ${route.path}`);
});

console.log('\n🔍 检查关键路由：');
const upgradeRoute = firmwareRoutesFiltered.find(r => r.path === '/api/firmware/upgrade' && r.methods.includes('post'));
console.log(`POST /api/firmware/upgrade: ${upgradeRoute ? '✅ 存在' : '❌ 不存在'}`);

const upgradeBatchRoute = firmwareRoutesFiltered.find(r => r.path === '/api/firmware/upgrade/batch' && r.methods.includes('post'));
console.log(`POST /api/firmware/upgrade/batch: ${upgradeBatchRoute ? '✅ 存在' : '❌ 不存在'}`);
