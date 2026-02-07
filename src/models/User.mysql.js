// ATMWater-BACKEND/src/models/User.mysql.js
// MySQL 版本的用户模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // ========== 基本信息 ==========
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: '手机号（唯一标识）'
  },
  
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码（bcrypt加密）'
  },
  
  pin: {
    type: DataTypes.STRING(4),
    allowNull: true,
    comment: '4位数字PIN码（用于设备刷卡）'
  },
  
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '用户姓名'
  },
  
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱'
  },
  
  // ========== 钱包余额 ==========
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    allowNull: false,
    comment: '钱包余额（印尼盾）'
  },
  
  // ========== RFID 卡信息 ==========
  virtualRfid: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: '虚拟RFID（扫码出水时使用手机号）'
  },
  
  // ========== 推荐人信息 ==========
  referralCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: '我的推荐码'
  },
  
  referredBy: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '推荐人的推荐码'
  },
  
  // ========== 状态字段 ==========
  role: {
    type: DataTypes.ENUM('User', 'Admin', 'Steward'),
    defaultValue: 'User',
    allowNull: false,
    comment: '用户角色'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: '账号是否激活'
  },
  
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '手机号是否验证'
  },
  
  // ========== 时间戳 ==========
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后登录时间'
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { fields: ['phone'], unique: true },
    { fields: ['virtualRfid'], unique: true },
    { fields: ['referralCode'], unique: true },
    { fields: ['role'] }
  ]
});

// ========== 实例方法 ==========

// 验证密码
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 验证PIN码
User.prototype.comparePin = function(candidatePin) {
  return this.pin === candidatePin;
};

// ========== 钩子函数 ==========

// 保存前加密密码
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
  
  // 自动生成虚拟RFID（使用手机号）
  if (!user.virtualRfid && user.phone) {
    user.virtualRfid = `VIRT_${user.phone}`;
  }
  
  // 自动生成推荐码
  if (!user.referralCode) {
    user.referralCode = `REF_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
});

// 更新前加密密码
User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

module.exports = User;

