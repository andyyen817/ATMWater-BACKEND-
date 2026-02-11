// ATMWater-BACKEND/src/models/Permission.mysql.js
// MySQL 版本的权限模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  functionKey: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '功能键（唯一标识）'
  },

  label: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '功能标签'
  },

  // 权限矩阵：存储为 JSON
  // 例如: { "GM": true, "Finance": false, "Super-Admin": true }
  permissions: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '权限矩阵（角色 -> 布尔值）'
  }
}, {
  tableName: 'permissions',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['functionKey']
    }
  ]
});

// 实例方法：获取权限（兼容 Mongoose 的 Map.get()）
Permission.prototype.getPermission = function(role) {
  return this.permissions && this.permissions[role] === true;
};

module.exports = Permission;
