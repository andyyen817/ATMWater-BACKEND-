const axios = require('axios');
const crypto = require('crypto');

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
 */
function generateSign(params) {
    const sortedKeys = Object.keys(params).sort();
    const stringA = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');
    const stringSignTemp = `${stringA}&appkey=${APPKEY}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
}

/**
 * 人人水站开放API服务 - 完整版
 */
class RenrenWaterService {
    constructor() {
        this.appid = APPID;
        this.appkey = APPKEY;
    }

    /**
     * 发送请求到人人水站API
     */
    async sendRequest(endpoint, data = {}) {
        // 合并参数
        const rawParams = {
            appid: this.appid,
            nonce_str: generateNonceStr(),
            ...data
        };

        // 打印原始参数（调试用）
        console.log(`[RenrenWater API] Raw params for ${endpoint}:`, rawParams);

        // 过滤掉空值参数（undefined, null, 空字符串）- 但保留数字 0
        const params = Object.keys(rawParams)
            .filter(key => {
                const val = rawParams[key];
                return val !== undefined && val !== null && val !== '';
            })
            .reduce((obj, key) => {
                obj[key] = rawParams[key];
                return obj;
            }, {});

        console.log(`[RenrenWater API] Filtered params for ${endpoint}:`, params);

        // 生成签名
        params.sign = generateSign(params);

        try {
            const response = await axios.post(`${HARDWARE_API_BASE}${endpoint}`, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [function (data) {
                    return Object.keys(data)
                        .map(key => `${key}=${data[key]}`)
                        .join('&');
                }],
                timeout: 15000
            });

            return response.data;
        } catch (error) {
            console.error(`[RenrenWater API] Request failed [${endpoint}]:`, error.message);
            if (error.response) {
                console.error(`[RenrenWater API] Response:`, error.response.data);
            }
            throw error;
        }
    }

    // ==================== 设备相关接口 ====================

    /**
     * 查询设备信息
     */
    async getDeviceInfo(device_no) {
        return await this.sendRequest('/device/info', { device_no });
    }

    /**
     * 查询设备状态（含传感器数据）
     */
    async getDeviceStatus(device_no, outlet = null) {
        const params = { device_no };
        if (outlet !== null) params.outlet = outlet;
        return await this.sendRequest('/device/status', params);
    }

    /**
     * 查询滤芯状态
     */
    async getDeviceFilters(device_no) {
        return await this.sendRequest('/device/filters', { device_no });
    }

    /**
     * 设备打水
     */
    async deviceWater(device_no, card_no, cash, outlet = 1, out_trade_no, remark = '') {
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
     * 更新设备信息
     */
    async updateDeviceInfo(device_no, options = {}) {
        const params = { device_no };
        if (options.pre_cash !== undefined) params.pre_cash = options.pre_cash;
        if (options.price !== undefined) params.price = options.price;
        if (options.speed !== undefined) params.speed = options.speed;
        if (options.ozone !== undefined) params.ozone = options.ozone;
        if (options.lock !== undefined) params.lock = options.lock;
        return await this.sendRequest('/device/update', params);
    }

    /**
     * 更新出水口信息
     */
    async updateOutletInfo(device_no, outlet_no, options = {}) {
        return await this.sendRequest('/device/outlet/update', {
            device_no,
            outlet_no,
            price: options.price || 0,
            price_card: options.price_card || 0,
            price_slot: options.price_slot || 0,
            speed: options.speed || 0,
            pre_cash: options.pre_cash || 0
        });
    }

    /**
     * 设备电源控制
     */
    async controlPower(device_no, power) {
        return await this.sendRequest('/device/ctrl/power', { device_no, power });
    }

    /**
     * 重置滤芯
     */
    async resetFilter(device_no, filter_level) {
        return await this.sendRequest('/device/ctrl/reset_filter', { device_no, filter_level });
    }

    // ==================== 卡片相关接口 ====================

    /**
     * 查询卡片信息
     */
    async getCardInfo(card_no) {
        return await this.sendRequest('/card/get', { card_no });
    }

    /**
     * 新建卡片
     */
    async createCard(card_no, cash, present_cash, days, user_name, user_phone, remark, group_id) {
        return await this.sendRequest('/card/new', {
            card_no,
            cash,
            present_cash,
            days,
            user_name,
            user_phone,
            remark,
            group_id
        });
    }

    /**
     * 批量新建卡片
     */
    async batchCreateCards(start_card_no, num, cash, present_cash, days, remark, group_id) {
        return await this.sendRequest('/card/batch_new', {
            start_card_no,
            num,
            cash,
            present_cash,
            days,
            remark,
            group_id
        });
    }

    /**
     * 卡充值
     */
    async chargeCard(out_trade_no, card_no, cash, present_cash, days, remark) {
        return await this.sendRequest('/card/charge', {
            out_trade_no,
            card_no,
            cash,
            present_cash,
            days,
            remark
        });
    }

    /**
     * 更新卡片信息
     */
    async updateCard(card_no, user_name, user_phone, remark, group_id) {
        return await this.sendRequest('/card/update', {
            card_no,
            user_name,
            user_phone,
            remark,
            group_id
        });
    }

    /**
     * 注销/恢复卡片
     */
    async dismissCard(card_no, valid) {
        return await this.sendRequest('/card/dismiss', { card_no, valid });
    }

    /**
     * 设置黑名单
     */
    async setBlackCard(card_no) {
        return await this.sendRequest('/card/set_black', { card_no });
    }

    /**
     * 绑定实体卡
     */
    async bindEcard(card_no, ecard_no, device_no, balance, user_name, remark) {
        return await this.sendRequest('/card/bind_ecard', {
            card_no,
            ecard_no,
            device_no,
            balance,
            user_name,
            remark
        });
    }

    /**
     * 解绑实体卡
     */
    async unbindEcard(card_no) {
        return await this.sendRequest('/card/unbind_ecard', { card_no });
    }

    /**
     * 查询卡片交易记录
     */
    async getCardRecords(card_no, page = 1, size = 20) {
        return await this.sendRequest('/card/card_record_list', {
            card_no,
            page,
            size
        });
    }

    // ==================== 电子卡相关接口 ====================

    /**
     * 查询电子卡
     */
    async getEcardInfo(card_no) {
        return await this.sendRequest('/ecard/get', { card_no });
    }

    /**
     * 新建电子卡
     */
    async createEcard(card_no, device_no, cash, present_cash, days, user_name, remark, group_id) {
        return await this.sendRequest('/ecard/new', {
            card_no,
            device_no,
            cash,
            present_cash,
            days,
            user_name,
            remark,
            group_id
        });
    }

    /**
     * 电子卡充值
     */
    async chargeEcard(out_trade_no, card_no, cash, present_cash, days, remark) {
        return await this.sendRequest('/ecard/charge', {
            out_trade_no,
            card_no,
            cash,
            present_cash,
            days,
            remark
        });
    }

    /**
     * 重置电子卡
     */
    async resetEcard(card_no, balance) {
        return await this.sendRequest('/ecard/reset', { card_no, balance });
    }

    // ==================== 批量查询接口 ====================

    /**
     * 批量查询设备信息
     */
    async getMultipleDeviceInfo(deviceNos) {
        const promises = deviceNos.map(device_no => this.getDeviceInfo(device_no));
        return await Promise.allSettled(promises);
    }

    /**
     * 批量查询卡片信息
     */
    async getMultipleCardInfo(cardNos) {
        const promises = cardNos.map(card_no => this.getCardInfo(card_no));
        return await Promise.allSettled(promises);
    }
}

module.exports = new RenrenWaterService();
