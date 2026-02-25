const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Application = sequelize.define('Application', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    applicantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('Steward', 'RP', 'Super-Admin'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Reviewing', 'Approved', 'Rejected'),
        defaultValue: 'Pending'
    },
    // 申请资料 (JSON)
    documents: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    // 审批流记录 (JSON)
    approvals: {
        type: DataTypes.JSON,
        defaultValue: {
            businessApproval: { status: 'Pending' },
            rpApproval: { status: 'Pending' },
            gmApproval: { status: 'Pending' },
            superAdminApproval: { status: 'Pending' }
        }
    },
    // 线下面谈/考核记录
    assessmentNotes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'applications',
    timestamps: true
});

module.exports = Application;
