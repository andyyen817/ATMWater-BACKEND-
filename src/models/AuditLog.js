const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: String,
    userRole: String,
    module: {
        type: String, // e.g., 'Settings', 'Withdrawals', 'Units', 'Partners'
        required: true
    },
    action: {
        type: String, // e.g., 'UPDATE_PRICE', 'APPROVE_WITHDRAWAL', 'LOCK_DEVICE'
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed // 记录修改前后的值，或操作备注
    },
    ipAddress: String,
    status: {
        type: String,
        enum: ['Success', 'Failed'],
        default: 'Success'
    }
}, {
    timestamps: true
});

// 设置日志保留 90 天，过期自动清理 (TTL)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;

