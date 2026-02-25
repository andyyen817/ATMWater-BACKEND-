const { Op } = require('sequelize');
const Application = require('../models/Application');
const User = require('../models/User');

/**
 * @desc    获取所有申请列表 (Web 管理端使用)
 * @route   GET /api/admin/applications
 */
exports.getApplications = async (req, res) => {
    try {
        const { type, status } = req.query;
        const where = {};
        if (type) where.type = type;
        if (status) where.status = status;

        const applications = await Application.findAll({
            where,
            include: [{ model: User, as: 'applicant', attributes: ['id', 'name', 'phoneNumber', 'email', 'role'] }],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            count: applications.length,
            data: applications
        });
    } catch (error) {
        console.error('Get Applications Error:', error);
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
        const application = await Application.findByPk(req.params.id, {
            include: [{ model: User, as: 'applicant', attributes: ['id', 'name', 'phoneNumber', 'email', 'role'] }]
        });

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        let approvalType;
        if (application.type === 'Super-Admin') {
            if (req.user.role !== 'Super-Admin') {
                return res.status(403).json({ success: false, message: 'Only Super-Admin can review Super-Admin applications' });
            }
            approvalType = 'superAdmin';
        } else if (application.type === 'RP') {
            approvalType = 'gm';
        } else if (application.type === 'Steward') {
            approvalType = 'business';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid application type' });
        }

        const newStatus = status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : 'Reviewing';
        const approvals = application.approvals || {};
        approvals[`${approvalType}Approval`] = { status, adminId: req.user.id, comment, updatedAt: new Date() };

        const updateData = { status: newStatus, approvals };
        if (status === 'Rejected') {
            updateData.rejectionReason = comment || 'Application rejected';
        }

        if (status === 'Approved') {
            if (application.type === 'Super-Admin' || application.type === 'Admin') {
                const existing = await User.findOne({ where: { role: application.type } });
                if (existing && existing.id !== application.applicantId) {
                    return res.status(400).json({ success: false, message: `Only one ${application.type} is allowed` });
                }
            }
            await User.update({ role: application.type }, { where: { id: application.applicantId } });
        }

        await application.update(updateData);
        await application.reload({ include: [{ model: User, as: 'applicant', attributes: ['id', 'name', 'phoneNumber', 'email', 'role'] }] });

        res.status(200).json({
            success: true,
            message: `Application ${status.toLowerCase()} successfully`,
            data: application
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
        const { type, documents, fullName, idNumber, address, experience, motivation } = req.body;

        const appType = type || 'Steward';
        if (!['Steward', 'RP', 'Super-Admin'].includes(appType)) {
            return res.status(400).json({ success: false, message: 'Invalid application type' });
        }

        if (appType === 'Super-Admin' && req.user.role !== 'RP') {
            return res.status(403).json({ success: false, message: 'Only RP users can apply for Super-Admin role' });
        }

        const existing = await Application.findOne({
            where: { applicantId: req.user.id, type: appType, status: { [Op.in]: ['Pending', 'Reviewing'] } }
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'You already have a pending application' });
        }

        const application = await Application.create({
            applicantId: req.user.id,
            type: appType,
            documents: documents || { fullName, idNumber, address, experience, motivation }
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
        const applications = await Application.findAll({
            where: { applicantId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: applications
        });
    } catch (error) {
        console.error('Get My Status Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取待审核的申请数量 (Web 端通知使用)
 * @route   GET /api/applications/admin/pending-count
 */
exports.getPendingCount = async (req, res) => {
    try {
        const where = { status: { [Op.in]: ['Pending', 'Reviewing'] } };

        if (req.user.role === 'Super-Admin') {
            // 不限制类型
        } else if (req.user.role === 'GM') {
            where.type = 'RP';
        } else if (req.user.role === 'Business') {
            where.type = 'Steward';
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const count = await Application.count({ where });

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
