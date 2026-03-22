// ATMWater-BACKEND/src/models/AppContent.js
// 静态内容模型：存储条款/隐私政策/关于我们/帮助中心的多语言文本
// key 格式：{type}_{lang}，如 terms_zh, privacy_id, about_en, help_zh

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AppContent = sequelize.define('AppContent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '内容键名，格式：{type}_{lang}，如 terms_zh'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
    comment: '内容正文（纯文本或Markdown）'
  },
  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '最后修改的管理员用户ID'
  }
}, {
  tableName: 'app_contents',
  timestamps: true,
  underscored: true
});

module.exports = AppContent;
