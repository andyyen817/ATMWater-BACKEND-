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
    type: DataTypes.ENUM('Active', 'Inactive', 'Lost', 'Damaged', 'Linked'),
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
  
  // ========== 发卡人信息 (v2新增) ==========
  issuedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '发卡人ID（售水站管理者）',
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },

  // ========== 卡片余额 ==========
  initialValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false,
    comment: '卡片初始面值（水币）'
  },

  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false,
    comment: '卡片当前余额（水币）'
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
  underscored: true,
  indexes: [
    { fields: ['rfid'], unique: true },
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['batch_id'] }
  ]
});

module.exports = PhysicalCard;

