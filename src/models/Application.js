const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    applicant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['Steward', 'RP', 'Super-Admin'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Reviewing', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    // 申请资料
    documents: {
        idCardUrl: String,      // 身份证照片
        salaryProofUrl: String, // 薪资证明 (针对 RP)
        businessLicenseUrl: String, // 营业执照 (针对 RP)
        additionalInfo: String  // 自述或其他补充
    },
    // 审批流记录
    approvals: {
        businessApproval: {
            status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
            adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            comment: String,
            updatedAt: Date
        },
        rpApproval: { // 仅针对 Steward 申请，由所在区域 RP 审批
            status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
            rpId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            comment: String,
            updatedAt: Date
        },
        gmApproval: { // 仅针对 RP 申请，由总经理最终审批
            status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
            adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            comment: String,
            updatedAt: Date
        },
        superAdminApproval: { // 仅针对 Super-Admin 申请，由现有 Super-Admin 审批
            status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
            adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            comment: String,
            updatedAt: Date
        }
    },
    // 线下面谈/考核记录
    assessmentNotes: String,
    rejectionReason: String
}, {
    timestamps: true
});

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
