const AuditLog = require('../models/AuditLog');

/**
 * 记录系统审计日志的通用辅助函数
 */
const logAction = async (req, module, action, details, status = 'Success') => {
    try {
        await AuditLog.create({
            userId: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            module,
            action,
            details,
            ipAddress: req.ip || req.connection.remoteAddress,
            status
        });
    } catch (error) {
        console.error('Audit Logging Failed:', error);
    }
};

module.exports = { logAction };

