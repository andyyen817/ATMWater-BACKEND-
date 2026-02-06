const AuditLog = require('../models/AuditLog');

/**
 * @desc    获取审计日志列表 (带分页)
 * @route   GET /api/admin/audit-logs
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, module } = req.query;
        const query = module ? { module } : {};

        const logs = await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await AuditLog.countDocuments(query);

        res.status(200).json({
            success: true,
            data: logs,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

