// MaintenanceLog Sequelize模型
// 用于MySQL数据库的维护日志模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaintenanceLog = sequelize.define('MaintenanceLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    // 设备关联
    unitId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'unit_id',
        comment: '关联的设备ID (units表)'
    },
    deviceId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'device_id',
        comment: '设备编号'
    },

    // 管家关联
    stewardId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'steward_id',
        comment: '执行维护的管家ID (users表)'
    },

    // 位置信息
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
    address: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '地址描述'
    },

    // 维护照片
    photoUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'photo_url',
        comment: '维护照片URL'
    },

    // 检查清单
    cleaned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '是否已清洁'
    },
    filterChecked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'filter_checked',
        comment: '是否已检查滤芯'
    },
    leakageChecked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'leakage_checked',
        comment: '是否已检查漏水'
    },

    // 水质数据
    tdsValue: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'tds_value',
        comment: 'TDS值 (PPM)'
    },
    phValue: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        field: 'ph_value',
        comment: 'pH值'
    },

    // 审核状态
    status: {
        type: DataTypes.ENUM('Pending', 'Verified', 'Rejected'),
        defaultValue: 'Verified',
        comment: '审核状态'
    },

    // 时间戳
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'maintenance_logs',
    underscored: true,
    timestamps: true,
    indexes: [
        { fields: ['unit_id'] },
        { fields: ['device_id'] },
        { fields: ['steward_id'] },
        { fields: ['created_at'] }
    ]
});

module.exports = MaintenanceLog;
