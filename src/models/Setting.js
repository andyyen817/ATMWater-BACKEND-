const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Setting = sequelize.define('Setting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        defaultValue: 'water_pricing'
    },
    // 售水分润比例 (JSON)
    ratios: {
        type: DataTypes.JSON,
        defaultValue: {
            airkop: 40,
            rp: 40,
            steward: 15,
            growthFund: 5
        }
    },
    // 云广告收益分润 (JSON)
    adRatios: {
        type: DataTypes.JSON,
        defaultValue: {
            airkop: 70,
            rp: 10,
            steward: 10,
            growthFund: 10
        }
    },
    // 维护费阶梯设置 (JSON)
    maintenanceFees: {
        type: DataTypes.JSON,
        defaultValue: {
            standard: 500000,
            enhanced: 800000,
            tdsThreshold: 300,
            phThreshold: 6.5
        }
    },
    // 软件使用费
    softwareFee: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 200000
    },
    // 水价设置 (JSON)
    prices: {
        type: DataTypes.JSON,
        defaultValue: {
            pure: 400,
            mineral: 500
        }
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'settings',
    timestamps: true
});

module.exports = Setting;
