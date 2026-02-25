const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
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
        }
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userRole: {
        type: DataTypes.STRING,
        allowNull: true
    },
    module: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'e.g., Settings, Withdrawals, Units, Partners'
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'e.g., UPDATE_PRICE, APPROVE_WITHDRAWAL, LOCK_DEVICE'
    },
    details: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '记录修改前后的值，或操作备注'
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Success', 'Failed'),
        defaultValue: 'Success'
    }
}, {
    tableName: 'audit_logs',
    timestamps: true
});

module.exports = AuditLog;

