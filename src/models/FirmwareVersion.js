const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FirmwareVersion = sequelize.define('FirmwareVersion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  version: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '固件版本号 (e.g., PDP2COMR04.01_210512.bin)'
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '原始文件名'
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '服务器存储路径'
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '文件大小(字节)'
  },
  crc32: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'CRC32校验码(整个文件)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '版本说明'
  },
  uploadedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: '上传者用户ID'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否可用'
  }
}, {
  tableName: 'firmware_versions',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['version'], unique: true },
    { fields: ['is_active'] }
  ]
});

module.exports = FirmwareVersion;
