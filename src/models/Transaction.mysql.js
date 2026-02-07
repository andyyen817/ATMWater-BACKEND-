// ATMWater-BACKEND/src/models/Transaction.mysql.js
// MySQL 版本的交易模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // ========== 用户信息 ==========
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '用户ID（外键）',
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  
  // ========== 设备信息 ==========
  unitId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '设备ID（外键）',
    references: {
      model: 'units',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  
  deviceId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '设备ID（冗余字段，便于查询）'
  },
  
  // ========== 交易类型 ==========
  type: {
    type: DataTypes.ENUM('TopUp', 'WaterPurchase', 'Withdrawal', 'Refund'),
    allowNull: false,
    comment: '交易类型'
  },
  
  // ========== 金额信息 ==========
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '交易金额（印尼盾）'
  },
  
  balanceBefore: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '交易前余额'
  },
  
  balanceAfter: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '交易后余额'
  },
  
  // ========== 出水信息（仅 WaterPurchase 类型）==========
  volume: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '出水量（升）'
  },
  
  pricePerLiter: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '每升价格（印尼盾）'
  },
  
  // ========== RFID 信息 ==========
  rfid: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'RFID卡号（实体卡或虚拟卡）'
  },
  
  cardType: {
    type: DataTypes.ENUM('Physical', 'Virtual'),
    allowNull: true,
    comment: '卡片类型'
  },
  
  // ========== 交易状态 ==========
  status: {
    type: DataTypes.ENUM('Pending', 'Completed', 'Failed', 'Cancelled'),
    defaultValue: 'Pending',
    allowNull: false,
    comment: '交易状态'
  },
  
  // ========== 第三方支付信息 ==========
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '支付方式（Xendit, Manual等）'
  },
  
  externalId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '第三方交易ID'
  },
  
  // ========== 备注 ==========
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '交易描述'
  },
  
  // ========== 时间戳 ==========
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '完成时间'
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['unit_id'] },
    { fields: ['device_id'] },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['rfid'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Transaction;

