/**
 * UserLog Model
 * 用户日志模型 - 存储用户上传的错误日志
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserLog = sequelize.define('UserLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: '用户ID'
  },
  logs: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: '日志内容（JSON字符串）'
  },
  deviceInfo: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '设备信息'
  },
  appVersion: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'APP版本号'
  },
  uploadedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '上传时间'
  }
}, {
  tableName: 'user_logs',
  timestamps: true,
  indexes: [
    {
      name: 'idx_userId',
      fields: ['userId']
    },
    {
      name: 'idx_uploadedAt',
      fields: ['uploadedAt']
    }
  ]
});

module.exports = UserLog;
