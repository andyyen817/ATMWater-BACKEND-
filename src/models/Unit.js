// ATMWater-BACKEND/src/models/Unit.mysql.js
// MySQL 版本的设备模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Unit = sequelize.define('Unit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // ========== 设备基本信息 ==========
  deviceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '设备ID（唯一标识）'
  },
  
  deviceName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '设备名称'
  },
  
  deviceType: {
    type: DataTypes.STRING(50),
    defaultValue: 'WaterDispenser',
    allowNull: false,
    comment: '设备类型'
  },
  
  // ========== 设备认证 ==========
  password: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '设备密码（用于TCP认证）'
  },
  
  // ========== 位置信息 ==========
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '设备位置'
  },
  
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    comment: '纬度'
  },
  
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    comment: '经度'
  },
  
  // ========== 设备状态 ==========
  status: {
    type: DataTypes.ENUM('Online', 'Offline', 'Maintenance', 'Error'),
    defaultValue: 'Offline',
    allowNull: false,
    comment: '设备状态'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: '是否启用'
  },
  
  // ========== 水质参数 ==========
  tdsValue: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'TDS值（水质指标）'
  },
  
  temperature: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '水温（摄氏度）'
  },
  
  // ========== 计费配置 ==========
  pricePerLiter: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 500.00,
    allowNull: false,
    comment: '每升价格（印尼盾）'
  },

  pulsePerLiter: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 1.0,
    allowNull: false,
    comment: '每升脉冲数（用于PWM转换为升）'
  },

  // ========== 硬件通信字段 ==========
  signalQuality: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '信号质量（CSQ，0-31）'
  },

  crcChecksum: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'CRC校验码'
  },

  imei: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'IMEI号（原始DId）'
  },

  // ========== 固件信息 ==========
  firmwareVersion: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '固件版本号'
  },

  // ========== 告警信息 ==========
  errorCodes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '告警代码（JSON数组）'
  },
  
  // ========== 管理员信息 ==========
  stewardId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '管理员ID（外键）',
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  
  // ========== 时间戳 ==========
  lastHeartbeatAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后心跳时间'
  },
  
  lastMaintenanceAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后维护时间'
  }
}, {
  tableName: 'units',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'], unique: true },
    { fields: ['status'] },
    { fields: ['steward_id'] },
    { fields: ['is_active'] }
  ]
});

module.exports = Unit;

