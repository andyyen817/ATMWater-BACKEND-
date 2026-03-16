const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UpgradeTask = sequelize.define('UpgradeTask', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firmwareVersionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'firmware_versions',
      key: 'id'
    }
  },
  unitId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'units',
      key: 'id'
    }
  },
  deviceId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '设备ID'
  },
  status: {
    type: DataTypes.ENUM('Pending', 'InProgress', 'Completed', 'Failed', 'Cancelled'),
    defaultValue: 'Pending',
    allowNull: false
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '升级进度(0-100)'
  },
  currentPacket: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '当前传输包序号'
  },
  totalPackets: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总包数'
  },
  versionBefore: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '升级前版本'
  },
  versionAfter: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '升级后版本'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  initiatedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'upgrade_tasks',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['firmware_version_id'] },
    { fields: ['unit_id'] },
    { fields: ['device_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = UpgradeTask;
