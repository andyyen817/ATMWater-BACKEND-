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
 * @route   PUT /api/applications/admin/:id/review
 */
exports.reviewApplication = async (req, res) => {
    try {
        const { status, comment } = req.body;
        const application = await Application.findById(req.params.id)
            .populate('applicant', 'name phoneNumber role');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // 根据申请类型确定审批类型
        let approvalType;
        if (application.type === 'Super-Admin') {
            // Super-Admin申请只能由现有Super-Admin审批
            if (req.user.role !== 'Super-Admin') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Only Super-Admin can review Super-Admin applications' 
                });
            }
            approvalType = 'superAdmin';
        } else if (application.type === 'RP') {
            approvalType = 'gm'; // RP申请由GM审批
        } else if (application.type === 'Steward') {
            approvalType = 'business'; // Steward申请由Business审批
        } else {
            return res.status(400).json({ success: false, message: 'Invalid application type' });
        }

        // 更新对应的审批阶段
        const updateData = {
            status: status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : 'Reviewing',
            [`approvals.${approvalType}Approval`]: {
                status,
                adminId: req.user.id,
                comment,
                updatedAt: new Date()
            }
        };

        // 如果是拒绝，记录拒绝原因
        if (status === 'Rejected') {
            updateData.rejectionReason = comment || 'Application rejected';
        }

        // 如果是最终批准，自动更改用户角色
        if (status === 'Approved') {
            // 检查是否已经有该角色的用户（Super-Admin和Admin只能有一个）
            if (application.type === 'Super-Admin' || application.type === 'Admin') {
                const existing = await User.findOne({ role: application.type });
                if (existing && existing._id.toString() !== application.applicant._id.toString()) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Only one ${application.type} is allowed in the system` 
                    });
                }
            }
            
            await User.findByIdAndUpdate(application.applicant, { role: application.type });
        }

        const updatedApplication = await Application.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).populate('applicant', 'name phoneNumber role');

        res.status(200).json({
            success: true,
            message: `Application ${status.toLowerCase()} successfully`,
            data: updatedApplication
        });
    } catch (error) {
        console.error('Review Application Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    用户提交申请 (App 端使用)
 * @route   POST /api/applications/apply
 */
exports.submitApplication = async (req, res) => {
    try {
        const { type, documents } = req.body;

        // 验证申请类型
        if (!['Steward', 'RP', 'Super-Admin'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid application type' });
        }

        // 只有RP可以申请Super-Admin
        if (type === 'Super-Admin' && req.user.role !== 'RP') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only RP users can apply for Super-Admin role' 
            });
        }

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
        console.error('Submit Application Error:', error);
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

/**
 * @desc    获取待审核的申请数量 (Web 端通知使用)
 * @route   GET /api/applications/admin/pending-count
 */
exports.getPendingCount = async (req, res) => {
    try {
        // 根据用户角色返回不同的待审核数量
        let query = { status: { $in: ['Pending', 'Reviewing'] } };
        
        // Super-Admin可以看到所有类型的待审核申请
        // 其他管理员只能看到对应类型的申请
        if (req.user.role === 'Super-Admin') {
            // 不限制类型
        } else if (req.user.role === 'GM') {
            query.type = 'RP'; // GM只能看到RP申请
        } else if (req.user.role === 'Business') {
            query.type = 'Steward'; // Business只能看到Steward申请
        } else {
            // 其他角色无权查看
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const count = await Application.countDocuments(query);
        
        res.status(200).json({
            success: true,
            count,
            data: { count }
        });
    } catch (error) {
        console.error('Get Pending Count Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
