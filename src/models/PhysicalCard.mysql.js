// ATMWater-BACKEND/src/models/PhysicalCard.mysql.js
// MySQL 版本的实体卡模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PhysicalCard = sequelize.define('PhysicalCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // ========== RFID 卡信息 ==========
  rfid: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'RFID卡号（唯一标识）'
  },
  
  // ========== 用户绑定 ==========
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '绑定的用户ID（外键）',
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  
  // ========== 卡片状态 ==========
  status: {
    type: DataTypes.ENUM('Active', 'Inactive', 'Lost', 'Damaged'),
    defaultValue: 'Active',
    allowNull: false,
    comment: '卡片状态'
  },
  
  // ========== 批次信息 ==========
  batchId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '批次ID'
  },
  
  // ========== 时间戳 ==========
  activatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '激活时间'
  },
  
  boundAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '绑定时间'
  }
}, {
  tableName: 'physical_cards',
  timestamps: true,
  indexes: [
    { fields: ['rfid'], unique: true },
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['batchId'] }
  ]
});

module.exports = PhysicalCard;

