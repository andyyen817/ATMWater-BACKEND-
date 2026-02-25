const axios = require('axios');

/**
 * 消息通用适配器服务
 * 支持: WhatsApp (Meta/Twilio) 以及本地 Mock 测试
 */

/**
 * 将手机号标准化为 E.164 格式 (+62xxxxxxxxxx)
 * 支持输入: 0812xxx, 812xxx, 62812xxx, +62812xxx
 */
function normalizeToE164(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
    if (!cleaned.startsWith('62')) cleaned = '62' + cleaned;
    return '+' + cleaned;
}

// 1. WhatsApp - Meta 官方 API 实现
const sendMetaWhatsAppOTP = async (phoneNumber, otp) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'otp_verification';

    const formattedPhone = normalizeToE164(phoneNumber).replace('+', '');

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${phoneId}/messages`,
            {
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: "id" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: otp }
                            ]
                        }
                    ]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`[WhatsApp Meta] Sent successfully: ${response.data.messages[0].id}`);
        return { success: true, provider: 'meta_whatsapp', messageId: response.data.messages[0].id };
    } catch (error) {
        const errData = error.response?.data?.error;
        const errCode = errData?.code;
        console.error(`[WhatsApp Meta] Error (code: ${errCode}):`, errData || error.message);
        // 131026 = 号码未注册 WhatsApp
        if (errCode === 131026) {
            throw new Error('This phone number is not registered on WhatsApp');
        }
        throw new Error('Failed to send WhatsApp OTP via Meta');
    }
};

// 2. WhatsApp - Twilio 实现
const sendTwilioWhatsAppOTP = async (phoneNumber, otp) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken) throw new Error('Twilio credentials missing');

    let twilio;
    try {
        twilio = require('twilio');
    } catch (error) {
        throw new Error('Twilio module not installed. Run: npm install twilio');
    }
    const client = twilio(accountSid, authToken);

    const normalized = normalizeToE164(phoneNumber);

    try {
        const message = await client.messages.create({
            body: `Your ATMWater verification code is: ${otp}. Valid for 5 minutes.`,
            from: fromPhone,
            to: `whatsapp:${normalized}`
        });
        console.log(`[WhatsApp Twilio] Sent: ${message.sid}`);
        return { success: true, provider: 'twilio_whatsapp', messageId: message.sid };
    } catch (error) {
        console.error(`[WhatsApp Twilio] Error:`, error.message);
        throw new Error('Failed to send WhatsApp via Twilio');
    }
};

// 3. 本地 Mock 实现
const sendMockOTP = async (phoneNumber, otp) => {
    const normalized = normalizeToE164(phoneNumber);
    console.log(`\n================= WHATSAPP OTP MOCK ==================`);
    console.log(`To: ${normalized}`);
    console.log(`OTP: ${otp}`);
    console.log(`Channel: WhatsApp`);
    console.log(`======================================================\n`);
    return { success: true, provider: 'mock', channel: 'whatsapp' };
};

/**
 * 统一发送接口
 * 根据环境变量 MESSAGE_PROVIDER 决定使用哪个 WhatsApp 供应商
 */
exports.sendOTP = async (phoneNumber, otp) => {
    const provider = process.env.MESSAGE_PROVIDER || 'mock';

    switch (provider.toLowerCase()) {
        case 'meta':
        case 'meta_whatsapp':
            return await sendMetaWhatsAppOTP(phoneNumber, otp);
        case 'twilio':
        case 'twilio_whatsapp':
            return await sendTwilioWhatsAppOTP(phoneNumber, otp);
        case 'mock':
        default:
            return await sendMockOTP(phoneNumber, otp);
    }
};

exports.normalizeToE164 = normalizeToE164;
