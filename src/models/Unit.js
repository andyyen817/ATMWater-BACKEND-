const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
    unitId: {
        type: String,
        required: [true, 'Unit ID is required'],
        unique: true,
        trim: true
    },
    locationName: {
        type: String,
        default: 'Unknown Location'
    },
    // [P3-INF-002] 地理位置索引，用于“查找附近水站”
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [106.8229, -6.1944] // 默认雅加达市中心
        }
    },
    rpOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    steward: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['Active', 'Locked', 'Maintenance', 'Offline'],
        default: 'Active'
    },
    // 实时传感器数据 (对齐硬件文档)
    sensors: {
        rawTDS: { type: Number, default: 0 },   // 原水 TDS
        pureTDS: { type: Number, default: 0 },  // 净水 TDS
        ph: { type: Number, default: 7.0 },     // pH 值
        temp: { type: Number, default: 25 },    // 温度
        humidity: { type: Number, default: 50 } // 湿度
    },
    // 订阅状态
    subscription: {
        lastPaidAt: { type: Date },
        overdueDays: { type: Number, default: 0 },
        isOverdue: { type: Boolean, default: false }
    },
    // 人人水站API数据
    price: { type: Number }, // 出水单价(分)
    speed: { type: Number }, // 出水速度(L/min)
    outlets: [{ // 出水口列表
        no: { type: Number }, // 出水口号
        price: { type: Number }, // 该出水口单价
        speed: { type: Number } // 该出水口速度
    }],
    preCash: { type: Number, default: 0 }, // 预扣金额(分)
    valid: { type: Boolean, default: true }, // 设备是否有效
    validDate: { type: Number }, // 有效期时间戳
    lastHeartbeat: {
        type: Date
    }
}, {
    timestamps: true
});

// [P3-INF-002] 创建地理位置索引
unitSchema.index({ location: '2dsphere' });
unitSchema.index({ status: 1 });
unitSchema.index({ rpOwner: 1 });

const Unit = mongoose.model('Unit', unitSchema);

module.exports = Unit;
