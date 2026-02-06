const express = require('express');  
const cors = require('cors');  
const helmet = require('helmet');  
const dotenv = require('dotenv');  
const rateLimit = require('express-rate-limit');
const path = require('path');  

dotenv.config();  

const app = express();  

// 1. [P1-INF-003] 最优先：极简健康检查 (在所有中间件之前，确保 Zeabur 健康检查秒通)
app.get('/api/health', (req, res) => {  
    res.status(200).send('OK');
});

// 2. 基础安全中间件
app.use(helmet({
    contentSecurityPolicy: false, // 禁用 CSP 以便加载外部图片/脚本（如果需要）
}));  
app.use(cors());  
app.use(express.json());  

// 3. [P1-INF-004] 全局限流：防止前端死循环耗尽 Socket/IP 资源
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分钟
  max: 100, // 每个 IP 限制 100 次请求
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter); // 只对 API 路径进行限流

// 4. 路由导入  
const authRoutes = require('./routes/authRoutes');  
const testRoutes = require('./routes/testRoutes');  
const iotRoutes = require('./routes/iotRoutes');  
const adminRoutes = require('./routes/adminRoutes');  
const walletRoutes = require('./routes/walletRoutes');  
const maintenanceRoutes = require('./routes/maintenanceRoutes');  
const rpRoutes = require('./routes/rpRoutes');  
const withdrawalRoutes = require('./routes/withdrawalRoutes');  
const partnerRoutes = require('./routes/partnerRoutes');  
const settingRoutes = require('./routes/settingRoutes');  
const referralRoutes = require('./routes/referralRoutes');  
const adRoutes = require('./routes/adRoutes');  
const auditRoutes = require('./routes/auditRoutes');  
const financeRoutes = require('./routes/financeRoutes');  
const userRoutes = require('./routes/userRoutes');  
const cardRoutes = require('./routes/cardRoutes');  
const applicationRoutes = require('./routes/applicationRoutes');  

// 5. API 路由注册
app.use('/api/auth', authRoutes);  
app.use('/api/test', testRoutes);  
app.use('/api/iot', iotRoutes);  
app.use('/api/admin', adminRoutes);  
app.use('/api/wallet', walletRoutes);  
app.use('/api/maintenance', maintenanceRoutes);  
app.use('/api/rp', rpRoutes);  
app.use('/api/withdrawals', withdrawalRoutes);  
app.use('/api/partners', partnerRoutes);  
app.use('/api/settings', settingRoutes);  
app.use('/api/referral', referralRoutes);  
app.use('/api/ads', adRoutes);  
app.use('/api/audit', auditRoutes);  
app.use('/api/finance', financeRoutes);  
app.use('/api/user', userRoutes);  
app.use('/api/cards', cardRoutes);  
app.use('/api/applications', applicationRoutes);  

// 6. 根路由 - API 欢迎页面  
app.get('/', (req, res) => {  
    res.status(200).json({  
        status: 'OK',  
        message: 'ATMWater Backend API',  
        version: '1.0.0',  
        environment: process.env.NODE_ENV || 'development',  
        timestamp: new Date(),  
        endpoints: {  
            health: '/api/health',  
            auth: '/api/auth',  
            test: '/api/test',  
            iot: '/api/iot',  
            admin: '/api/admin',  
            wallet: '/api/wallet',  
            maintenance: '/api/maintenance',  
            rp: '/api/rp',  
            withdrawals: '/api/withdrawals',  
            partners: '/api/partners',  
            settings: '/api/settings',  
            referral: '/api/referral',  
            ads: '/api/ads',  
            audit: '/api/audit',  
            finance: '/api/finance',  
            user: '/api/user'  
        }  
    });  
});  

// 7. 静态资源托管
app.use('/app', express.static(path.join(__dirname, '../../ATMWater-APP/UI_Design/prototypes')));  
app.use('/web', express.static(path.join(__dirname, '../../ATMWater-WEB/UI_Design/prototypes')));  

module.exports = app;  