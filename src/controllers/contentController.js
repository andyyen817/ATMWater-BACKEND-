// ATMWater-BACKEND/src/controllers/contentController.js
// 静态内容管理：条款/隐私政策/关于我们/帮助中心

const { AppContent } = require('../models');

/**
 * @desc    获取单条内容（公开，用户App调用）
 * @route   GET /api/content/:key
 * @access  Public
 */
exports.getContent = async (req, res) => {
    try {
        const { key } = req.params;
        const content = await AppContent.findOne({ where: { key } });
        if (!content) {
            return res.status(404).json({ success: false, message: 'Content not found' });
        }
        res.status(200).json({ success: true, data: content });
    } catch (error) {
        console.error('[getContent] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    获取所有内容条目（管理员）
 * @route   GET /api/content
 * @access  Admin
 */
exports.listContents = async (req, res) => {
    try {
        const contents = await AppContent.findAll({
            order: [['key', 'ASC']]
        });
        res.status(200).json({ success: true, data: contents });
    } catch (error) {
        console.error('[listContents] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * @desc    更新内容（管理员）
 * @route   PUT /api/content/:key
 * @access  Admin
 */
exports.updateContent = async (req, res) => {
    try {
        const { key } = req.params;
        const { content } = req.body;
        if (!content && content !== '') {
            return res.status(400).json({ success: false, message: 'content field is required' });
        }
        const [updated] = await AppContent.upsert({
            key,
            content,
            updatedBy: req.user?.id || null
        });
        const result = await AppContent.findOne({ where: { key } });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[updateContent] Error:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
