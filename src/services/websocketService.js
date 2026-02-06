const WebSocket = require('ws');

/**
 * WebSocket服务 - 用于向前端实时推送设备数据更新
 */
class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Set();
    }

    /**
     * 初始化WebSocket服务器
     * @param {Object} server - HTTP服务器实例
     */
    initialize(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });

        this.wss.on('connection', (ws, req) => {
            console.log('[WebSocket] New client connected');

            // 添加客户端
            this.clients.add(ws);

            // 发送欢迎消息
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Connected to ATMWater Real-time Service',
                timestamp: new Date().toISOString()
            }));

            // 处理客户端消息
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('[WebSocket] Error parsing message:', error.message);
                }
            });

            // 处理断开连接
            ws.on('close', () => {
                console.log('[WebSocket] Client disconnected');
                this.clients.delete(ws);
            });

            // 处理错误
            ws.on('error', (error) => {
                console.error('[WebSocket] Client error:', error.message);
            });

            // 发送心跳
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });
        });

        // 心跳检测 - 每30秒检查一次
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        console.log('[WebSocket] Server initialized on path /ws');
    }

    /**
     * 处理客户端消息
     */
    handleClientMessage(ws, data) {
        switch (data.type) {
            case 'subscribe':
                // 客户端订阅特定设备更新
                ws.subscriptions = ws.subscriptions || new Set();
                if (data.deviceId) {
                    ws.subscriptions.add(data.deviceId);
                    console.log(`[WebSocket] Client subscribed to device: ${data.deviceId}`);
                }
                break;

            case 'unsubscribe':
                // 客户端取消订阅
                if (ws.subscriptions && data.deviceId) {
                    ws.subscriptions.delete(data.deviceId);
                    console.log(`[WebSocket] Client unsubscribed from device: ${data.deviceId}`);
                }
                break;

            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;

            default:
                console.log('[WebSocket] Unknown message type:', data.type);
        }
    }

    /**
     * 广播消息给所有客户端
     * @param {Object} data - 要发送的数据
     */
    broadcast(data) {
        const message = JSON.stringify({
            ...data,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    /**
     * 发送设备更新给订阅的客户端
     * @param {string} deviceId - 设备ID
     * @param {Object} data - 设备数据
     */
    sendDeviceUpdate(deviceId, data) {
        const message = JSON.stringify({
            type: 'device_update',
            deviceId: deviceId,
            data: data,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach((client) => {
            // 如果客户端订阅了特定设备，或者没有订阅限制
            if (client.readyState === WebSocket.OPEN &&
                (!client.subscriptions || client.subscriptions.size === 0 || client.subscriptions.has(deviceId))) {
                client.send(message);
            }
        });
    }

    /**
     * 发送系统通知
     * @param {string} level - 通知级别 (info, warning, error)
     * @param {string} message - 通知内容
     */
    sendNotification(level, message) {
        this.broadcast({
            type: 'notification',
            level: level,
            message: message
        });
    }

    /**
     * 发送交易更新
     * @param {Object} transaction - 交易数据
     */
    sendTransactionUpdate(transaction) {
        this.broadcast({
            type: 'transaction_update',
            data: transaction
        });
    }

    /**
     * 发送卡片余额更新
     * @param {string} cardNo - 卡号
     * @param {Object} cardData - 卡片数据
     */
    sendCardUpdate(cardNo, cardData) {
        this.broadcast({
            type: 'card_update',
            cardNo: cardNo,
            data: cardData
        });
    }

    /**
     * 获取连接的客户端数量
     */
    getClientCount() {
        return this.clients.size;
    }

    /**
     * 关闭WebSocket服务器
     */
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.wss) {
            this.wss.clients.forEach((client) => {
                client.close();
            });
            this.wss.close();
        }

        console.log('[WebSocket] Server closed');
    }
}

module.exports = new WebSocketService();
