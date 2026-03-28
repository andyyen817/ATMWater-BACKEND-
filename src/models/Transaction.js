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
    allowNull: true,  // 允许null：物理卡独立消费（未绑定App用户）时userId为null
    comment: '用户ID（外键，物理卡独立消费时为null）',
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
    type: DataTypes.ENUM('topup', 'dispense', 'withdrawal', 'refund', 'referral_reward'),
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

  pulseCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '脉冲数（PWM）'
  },

  inputTds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '进水TDS值'
  },

  outputTds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '纯水TDS值'
  },

  waterTemp: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '水温（摄氏度）'
  },

  recordId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '硬件记录ID（RE字段）'
  },

  dispensingTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '放水时间（秒）'
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

  // ========== 水币来源追踪 ==========
  balanceType: {
    type: DataTypes.ENUM('APP_BACKED', 'PHYSICAL_BACKED'),
    defaultValue: 'APP_BACKED',
    allowNull: false,
    comment: '水币来源类型: APP_BACKED=App充值, PHYSICAL_BACKED=物理卡'
  },

  originCardId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '物理卡ID（若来源为物理卡）',
    references: {
      model: 'physical_cards',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },

  // ========== 分账信息 ==========
  profitShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '是否已分账'
  },

  stationRevenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false,
    comment: '站点分润金额'
  },

  rpRevenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false,
    comment: 'RP区域代理分润金额'
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
    { fields: ['created_at'] },
    { fields: ['balance_type'] },
    { fields: ['profit_shared'] },
    { fields: ['origin_card_id'] }
  ]
});

module.exports = Transaction;

