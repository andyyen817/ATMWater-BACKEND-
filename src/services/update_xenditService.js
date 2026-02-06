const { Xendit } = require('xendit-node');
const dotenv = require('dotenv');

dotenv.config();

const xenditClient = new Xendit({
    secretKey: process.env.XENDIT_SECRET_KEY || 'xnd_development_...', 
});

/**
 * 创建 Xendit 发票 (Invoice)
 * @param {string} externalId 外部交易ID (唯一)
 * @param {number} amount 金额 (印尼盾)
 * @param {string} payerEmail 支付人邮箱 (可选)
 * @param {string} description 描述
 */
const createInvoice = async (externalId, amount, payerEmail, description) => {
    try {
        const response = await xenditClient.Invoice.createInvoice({
            data: {
                externalId,
                amount,
                payerEmail,
                description,
                shouldSendEmail: !!payerEmail,
                currency: 'IDR',
                reminderTime: 1, // 1 hour reminder
            }
        });
        return { success: true, data: response };
    } catch (error) {
        console.error('[Xendit Service] Create Invoice Error:', error);
        return { success: false, message: error.message };
    }
};

/**
 * 验证 Webhook 回调签名 (可选，增强安全性)
 * @param {string} xenditSignature 
 */
const verifyWebhookToken = (token) => {
    return token === process.env.XENDIT_WEBHOOK_TOKEN;
};

module.exports = {
    createInvoice,
    verifyWebhookToken
};