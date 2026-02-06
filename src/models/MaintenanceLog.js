const mongoose = require('mongoose');

const maintenanceLogSchema = new mongoose.Schema({
    unitId: {
        type: String,
        required: true,
        index: true
    },
    stewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [经度, 纬度]
            required: true
        },
        address: String
    },
    photoUrl: {
        type: String,
        required: [true, 'Maintenance photo is required']
    },
    checklist: {
        cleaned: { type: Boolean, default: false },
        filterChecked: { type: Boolean, default: false },
        leakageChecked: { type: Boolean, default: false }
    },
    tdsValue: Number,
    phValue: Number,
    status: {
        type: String,
        enum: ['Pending', 'Verified', 'Rejected'],
        default: 'Verified' // MVP 阶段自动通过
    }
}, {
    timestamps: true
});

// 为地理位置建立索引
maintenanceLogSchema.index({ location: '2dsphere' });

const MaintenanceLog = mongoose.model('MaintenanceLog', maintenanceLogSchema);

module.exports = MaintenanceLog;

