// ATMWater-BACKEND/src/models/DeviceSettings.js
// 设备参数配置模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeviceSettings = sequelize.define('DeviceSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  deviceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '设备ID'
  },

  // ========== 净水参数 (UF - Ultra Filtration) ==========
  A1: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 18.9,
    comment: '净水放水量(升/桶)'
  },

  A2: {
    type: DataTypes.INTEGER,
    defaultValue: 93,
    comment: '净水放水时间(秒/桶)'
  },

  A3: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 4.0,
    comment: '净水每桶价格(元)'
  },

  // ========== RO水参数 (Reverse Osmosis) ==========
  B1: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 18.9,
    comment: 'RO放水量(升/桶)'
  },

  B2: {
    type: DataTypes.INTEGER,
    defaultValue: 103,
    comment: 'RO放水时间(秒/桶)'
  },

  B3: {
    type: DataTypes.DECIMAL(5, 1),
    defaultValue: 8.0,
    comment: 'RO每桶价格(元)'
  },

  // ========== 设备控制参数 ==========
  C1: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: '臭氧开始工作(分钟)'
  },

  C2: {
    type: DataTypes.INTEGER,
    defaultValue: 120,
    comment: '臭氧工作时间(秒)'
  },

  C3: {
    type: DataTypes.INTEGER,
    defaultValue: 8,
    comment: '广告灯开启时间(小时)'
  },

  C4: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    comment: '广告灯关闭时间(小时)'
  },

  // ========== 密码（不通过TCP传输，仅设备本地使用） ==========
  P0: {
    type: DataTypes.INTEGER,
    defaultValue: 231,
    comment: '设备设置密码'
  },

  updatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '最后更新人ID'
  }
}, {
  tableName: 'device_settings',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'], unique: true }
  ]
});

module.exports = DeviceSettings;
