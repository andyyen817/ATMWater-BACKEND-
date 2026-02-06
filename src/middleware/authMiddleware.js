const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Permission = require('../models/Permission');

// 1. 基础验证中间件：确保请求者已登录 (持有有效 Token)
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 从 Header 中获取 Token: "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // 验证 Token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 将用户信息挂载到请求对象 req 上，供后续使用
            req.user = await User.findById(decoded.id).select('-otp -otpExpires');
            
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            next();
        } catch (error) {
            console.error('Auth Middleware Error:', error.message);
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// 2. 角色授权中间件：确保用户具备特定身份 (如 'Finance', 'Super-Admin')
// 传统的静态角色检查
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `User role [${req.user ? req.user.role : 'N/A'}] is not authorized to access this route` 
            });
        }
        next();
    };
};

// 3. 动态权限授权中间件：根据数据库中的权限矩阵检查 (P1-WEB-001)
const checkPermission = (functionKey) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        // DEBUG: 打印用户信息
        console.log(`[Permission Check] User: ${req.user.phoneNumber}, Role: ${req.user.role}, Function: ${functionKey}`);

        // Super-Admin 拥有所有权限
        if (req.user.role === 'Super-Admin') {
            console.log(`[Permission Check] ✅ Super-Admin bypass: ${req.user.phoneNumber}`);
            return next();
        }

        try {
            const permissionDoc = await Permission.findOne({ functionKey });
            
            if (!permissionDoc) {
                // 如果权限未定义，默认拒绝（安全起见）
                return res.status(403).json({ 
                    success: false, 
                    message: `Permission for [${functionKey}] not defined` 
                });
            }

            // Mongoose Map 使用 .get()
            const hasAccess = permissionDoc.permissions.get(req.user.role);

            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: `User role [${req.user.role}] is not authorized to perform: ${functionKey}` 
                });
            }

            next();
        } catch (error) {
            console.error('Check Permission Error:', error);
            res.status(500).json({ success: false, message: 'Server Error during permission check' });
        }
    };
};

module.exports = { protect, authorize, checkPermission };

