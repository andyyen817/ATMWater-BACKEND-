// WaterQualityLog Sequelize模型
// 用于MySQL数据库的水质日志模型

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WaterQualityLog = sequelize.define('WaterQualityLog', {
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

    // 水质数据
    pureTds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'pure_tds',
        comment: '纯水TDS值 (PPM)'
    },
    rawTds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'raw_tds',
        comment: '原水TDS值 (PPM)'
    },
    ph: {
        type: DataTypes.DECIMAL(3, 1),
        defaultValue: 7.0,
        comment: 'pH值'
    },
    temperature: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        comment: '温度 (摄氏度)'
    },

    // 记录时间
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: '数据采集时间'
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
    tableName: 'water_quality_logs',
    underscored: true,
    timestamps: true,
    indexes: [
        { fields: ['unit_id'] },
        { fields: ['device_id'] },
        { fields: ['timestamp'] }
    ]
});

module.exports = WaterQualityLog;
