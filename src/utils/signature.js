const crypto = require('crypto');

/**
 * 硬件平台 MD5 签名生成工具
 * @param {Object} params - 需要参与签名的参数对象
 * @param {string} appKey - 平台分配的 appkey
 * @returns {string} - 生成的大写签名字符串
 */
const generateSignature = (params, appKey) => {
    // 1. 过滤掉 sign 和空值
    const filteredParams = Object.keys(params)
        .filter(key => key !== 'sign' && params[key] !== '' && params[key] !== null && params[key] !== undefined)
        .reduce((obj, key) => {
            obj[key] = params[key];
            return obj;
        }, {});

    // 2. 将发送的参数按照参数名 ASCII 码字典升序排序
    const sortedKeys = Object.keys(filteredParams).sort();
    
    // 3. 拼接成 key=value&key2=value2 格式
    const stringA = sortedKeys
        .map(key => `${key}=${filteredParams[key]}`)
        .join('&');
    
    // 4. 拼接 appkey 并进行 MD5 加密
    const stringSignTemp = `${stringA}&appkey=${appKey}`;
    
    // 5. 全部转换为大写
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
};

/**
 * 验证回调签名的正确性
 * @param {Object} params - 接收到的所有参数（包含 sign）
 * @param {string} appKey - 平台分配的 appkey
 * @returns {boolean}
 */
const verifySignature = (params, appKey) => {
    const { sign, ...rest } = params;
    if (!sign) return false;
    
    const calculatedSign = generateSignature(rest, appKey);
    return calculatedSign === sign;
};

module.exports = {
    generateSignature,
    verifySignature
};

