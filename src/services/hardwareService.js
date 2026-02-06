const axios = require('axios');
const crypto = require('crypto');
const Unit = require('../models/Unit');

// 人人水站开放API配置
const HARDWARE_API_BASE = 'https://openapi.waterer.cn';
const APPID = process.env.HARDWARE_APPID || 'aba3e622b274fd0c';
const APPKEY = process.env.HARDWARE_APPKEY || '6f69164cc4134b54c7d8bae46866a0e0';

/**
 * 生成16位随机字符串
 */
function generateNonceStr(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 生成人人水站API签名
 * @param {Object} params - 请求参数
 * @returns {string} - 签名
 */
function generateSign(params) {
    // 1. 按字母顺序排序
    const sortedKeys = Object.keys(params).sort();

    // 2. 拼接参数 key=value&key2=value2
    const stringA = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');

    // 3. 追加appkey
    const stringSignTemp = `${stringA}&appkey=${APPKEY}`;

    // 4. MD5加密并转大写
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
}

/**
 * 人人水站开放API服务
 */
class HardwareService {
    constructor() {
        this.appid = APPID;
        this.appkey = APPKEY;
    }

    /**
     * 发送请求到人人水站API
     * @param {string} endpoint - 接口路径
     * @param {Object} data - 请求参数
     */
    async sendRequest(endpoint, data) {
        const params = {
            appid: this.appid,
            nonce_str: generateNonceStr(),
            ...data
        };

        // 生成签名
        params.sign = generateSign(params);

        try {
            const response = await axios.post(`${HARDWARE_API_BASE}${endpoint}`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [function (data) {
                    // 将对象转换为 application/x-www-form-urlencoded 格式
                    return Object.keys(data)
                        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
                        .join('&');
                }],
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error(`[Hardware API] Request failed [${endpoint}]:`, error.message);
            throw error;
        }
    }

    /**
     * 查询设备信息
     * @param {string} device_no - 设备号
     */
    async getDeviceInfo(device_no) {
        return await this.sendRequest('/device/info', { device_no });
    }

    /**
     * 设备打水
     * @param {string} device_no - 设备号
     * @param {string} card_no - 卡号
     * @param {number} cash - 金额(分)
     * @param {number} outlet - 出水口号
     * @param {string} out_trade_no - 订单号
     * @param {string} remark - 备注
     */
    async authorizeWater(device_no, card_no, cash, outlet = 1, out_trade_no, remark = '') {
        return await this.sendRequest('/device/water', {
            device_no,
            card_no,
            cash,
            outlet,
            sync_card: 1,
            out_trade_no,
            remark
        });
    }

    /**
     * 远程控制设备 (锁定/解锁)
     * @param {string} device_no - 设备号
     * @param {number} power - 0:关机(锁定), 1:开机(解锁)
     */
    async controlPower(device_no, power) {
        return await this.sendRequest('/device/control', {
            device_no,
            power
        });
    }

    /**
     * 从人人水站API同步设备信息到本地数据库
     * @param {string} device_no - 设备号
     */
    async syncDeviceToLocal(device_no) {
        try {
            const apiResponse = await this.getDeviceInfo(device_no);

            if (!apiResponse.success || apiResponse.code !== 0) {
                console.error(`[Hardware API] Failed to get device info for ${device_no}:`, apiResponse);
                return null;
            }

            const result = apiResponse.result;

            // 查找或创建本地设备记录
            let unit = await Unit.findOne({ unitId: device_no });

            if (!unit) {
                // 创建新设备
                unit = new Unit({
                    unitId: device_no,
                    locationName: `设备 ${device_no}`,
                    status: result.is_online ? 'Active' : 'Offline'
                });
            }

            // 更新设备信息
            unit.status = result.is_online ? 'Active' : 'Offline';
            unit.lastHeartbeat = new Date();

            // 更新传感器数据（从API获取到的数据）
            if (result.sensors) {
                unit.sensors = {
                    rawTDS: result.sensors.raw_tds || 0,
                    pureTDS: result.sensors.pure_tds || 0,
                    ph: result.sensors.ph || 7.0,
                    temp: result.sensors.temp || 25,
                    humidity: result.sensors.humidity || 50
                };
            }

            // 更新价格和速度信息
            if (result.price !== undefined) {
                unit.price = result.price;
            }
            if (result.speed !== undefined) {
                unit.speed = result.speed;
            }

            // 更新出水口信息
            if (result.outlets && Array.isArray(result.outlets)) {
                unit.outlets = result.outlets;
            }

            // 保存到数据库
            await unit.save();

            console.log(`[Hardware Sync] Device ${device_no} synced successfully`);

            return unit;
        } catch (error) {
            console.error(`[Hardware Sync] Error syncing device ${device_no}:`, error.message);
            return null;
        }
    }

    /**
     * 批量同步所有设备
     */
    async syncAllDevices() {
        try {
            // 获取所有本地设备
            const units = await Unit.find({});

            console.log(`[Hardware Sync] Starting sync for ${units.length} devices...`);

            const results = [];
            for (const unit of units) {
                const updated = await this.syncDeviceToLocal(unit.unitId);
                results.push({
                    unitId: unit.unitId,
                    success: !!updated
                });

                // 避免请求过快，延迟100ms
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return results;
        } catch (error) {
            console.error('[Hardware Sync] Error in syncAllDevices:', error.message);
            return [];
        }
    }
}

module.exports = new HardwareService();
