const axios = require('axios');

/**
 * 消息通用适配器服务
 * 支持: WhatsApp (Meta/Twilio), SMS (Twilio), 以及本地 Mock 测试
 */

// 1. WhatsApp - Meta 官方 API 实现
const sendMetaWhatsAppOTP = async (phoneNumber, otp) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'otp_verification';

    const formattedPhone = phoneNumber.replace(/\D/g, '');

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
        console.error(`[WhatsApp Meta] Error:`, error.response?.data || error.message);
        throw new Error('Failed to send WhatsApp via Meta');
    }
};

// 2. WhatsApp - Twilio 实现
const sendTwilioWhatsAppOTP = async (phoneNumber, otp) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken) throw new Error('Twilio credentials missing');

    const client = require('twilio')(accountSid, authToken);
    
    try {
        const message = await client.messages.create({
            body: `Your ATMWater verification code is: ${otp}. Valid for 5 minutes.`,
            from: fromPhone,
            to: `whatsapp:${phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber}`
        });
        console.log(`[WhatsApp Twilio] Sent: ${message.sid}`);
        return { success: true, provider: 'twilio_whatsapp', messageId: message.sid };
    } catch (error) {
        console.error(`[WhatsApp Twilio] Error:`, error.message);
        throw new Error('Failed to send WhatsApp via Twilio');
    }
};

// 3. SMS - Twilio 实现 (应对 WhatsApp 权限问题)
const sendTwilioSMSOTP = async (phoneNumber, otp) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_SMS_FROM; // 您的 Twilio 购买的手机号

    if (!accountSid || !authToken || !fromPhone) {
        throw new Error('Twilio SMS credentials (SID, Token, or FROM number) missing');
    }

    const client = require('twilio')(accountSid, authToken);
    
    try {
        const message = await client.messages.create({
            body: `[AirKOP] Verification code: ${otp}. Do not share this with anyone.`,
            from: fromPhone,
            to: phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber
        });
        console.log(`[SMS Twilio] Sent successfully: ${message.sid}`);
        return { success: true, provider: 'twilio_sms', messageId: message.sid };
    } catch (error) {
        console.error(`[SMS Twilio] Error:`, error.message);
        throw new Error(`Failed to send SMS via Twilio: ${error.message}`);
    }
};

// 4. 本地 Mock 实现
const sendMockOTP = async (phoneNumber, otp, type = 'SMS/WhatsApp') => {
    console.log(`\n================= MESSAGE MOCK ==================`);
    console.log(`Type: ${type}`);
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: Your ATMWater OTP is: ${otp}`);
    console.log(`==================================================\n`);
    return { success: true, provider: 'mock' };
};

/**
 * 统一发送接口
 * 根据环境变量 MESSAGE_PROVIDER 决定使用哪个供应商和通道
 */
exports.sendOTP = async (phoneNumber, otp) => {
    const provider = process.env.MESSAGE_PROVIDER || process.env.WHATSAPP_PROVIDER || 'mock';

    switch (provider.toLowerCase()) {
        case 'meta':
        case 'meta_whatsapp':
            return await sendMetaWhatsAppOTP(phoneNumber, otp);
        case 'twilio':
        case 'twilio_whatsapp':
            return await sendTwilioWhatsAppOTP(phoneNumber, otp);
        case 'twilio_sms':
            return await sendTwilioSMSOTP(phoneNumber, otp);
        case 'mock':
        default:
            return await sendMockOTP(phoneNumber, otp);
    }
};