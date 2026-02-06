const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    functionKey: {
        type: String,
        required: true,
        unique: true
    },
    label: {
        type: String,
        required: true
    },
    // 权限矩阵：角色名 -> 是否有权限
    // 例如: { "GM": true, "Finance": false, ... }
    permissions: {
        type: Map,
        of: Boolean,
        default: {}
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Permission', permissionSchema);
