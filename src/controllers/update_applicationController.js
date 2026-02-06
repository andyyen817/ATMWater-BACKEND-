const Application = require('../models/Application');
const User = require('../models/User');

/**
 * @desc    获取所有申请列表 (Web 管理端使用)
 * @route   GET /api/admin/applications
 */
exports.getApplications = async (req, res) => {
    try {
        const { type, status } = req.query;
        const query = {};
        if (type) query.type = type;
        if (status) query.status = status;

        const applications = await Application.find(query)
            .populate('applicant', 'name phoneNumber role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: applications.length,
            data: applications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    审批申请 (通用)
 * @route   PUT /api/admin/applications/:id/approve
 */
exports.reviewApplication = async (req, res) => {
    try {
        const { status, comment, approvalType } = req.body; // approvalType: 'business', 'rp', 'gm'
        const application = await Application.findById(req.params.id);

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // 更新对应的审批阶段
        const updateData = {
            status: status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : 'Reviewing',
            [`approvals.${approvalType}Approval`]: {
                status,
                adminId: req.user.id,
                comment,
                updatedAt: Date.now()
            }
        };

        // 如果是最终批准，自动更改用户角色
        if (status === 'Approved') {
            // 这里可以根据业务逻辑决定是否立即生效
            // 例如：Steward 申请需要 Business + RP 双重批准
            // RP 申请需要 Business + GM 双重批准
            
            // 简单演示逻辑：直接提升角色
            await User.findByIdAndUpdate(application.applicant, { role: application.type });
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        res.status(200).json({
            success: true,
            data: updatedApplication
        });
    } catch (error) {
        console.error('Review Application Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    用户提交申请 (App 端使用)
 * @route   POST /api/user/apply
 */
exports.submitApplication = async (req, res) => {
    try {
        const { type, documents } = req.body;
        
        // 检查是否已有处理中的申请
        const existing = await Application.findOne({ 
            applicant: req.user.id, 
            type, 
            status: { $in: ['Pending', 'Reviewing'] } 
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'You already have a pending application' });
        }

        const application = await Application.create({
            applicant: req.user.id,
            type,
            documents
        });

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: application
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取我的申请状态 (App 端使用)
 * @route   GET /api/applications/my-status
 */
exports.getMyStatus = async (req, res) => {
    try {
        const applications = await Application.find({ applicant: req.user.id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: applications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};