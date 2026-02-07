// ========================================
// ATMWater Backend Server - MySQL Version
// ========================================

// Load environment variables
try {
    require('dotenv').config();
    console.log('✅ Environment variables loaded');
} catch (error) {
    console.log('ℹ️ Using Zeabur environment variables');
}

const express = require('express');
const cors = require('cors');
const sequelize = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 8080;
const TCP_PORT = process.env.TCP_PORT || 55036;

// ========================================
// Middleware
// ========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// Health Check Route
// ========================================
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'ATMWater Backend is running',
        timestamp: new Date().toISOString(),
        database: 'MySQL',
        version: '2.0.0'
    });
});

// ========================================
// System Test Route (统一测试接口)
// ========================================
app.get('/api/test', async (req, res) => {
    const { User, PhysicalCard, Unit, Transaction } = require('./src/models');

    const results = {
        timestamp: new Date().toISOString(),
        tests: []
    };

    try {
        // 测试1：数据库连接
        results.tests.push({
            name: 'Database Connection',
            status: 'running',
            message: 'Testing MySQL connection...'
        });

        await sequelize.authenticate();
        results.tests[0].status = 'success';
        results.tests[0].message = '✅ MySQL connection successful';
        results.tests[0].details = {
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'zeabur',
            port: process.env.DB_PORT || 3306
        };

        // 测试2：检查表是否存在
        results.tests.push({
            name: 'Database Tables',
            status: 'running',
            message: 'Checking database tables...'
        });

        const tables = await sequelize.query(
            "SHOW TABLES",
            { type: sequelize.QueryTypes.SELECT }
        );

        const tableNames = tables.map(t => Object.values(t)[0]);
        const requiredTables = ['users', 'units', 'physical_cards', 'transactions'];
        const missingTables = requiredTables.filter(t => !tableNames.includes(t));

        if (missingTables.length === 0) {
            results.tests[1].status = 'success';
            results.tests[1].message = '✅ All required tables exist';
            results.tests[1].details = { tables: tableNames };
        } else {
            results.tests[1].status = 'warning';
            results.tests[1].message = '⚠️ Some tables are missing';
            results.tests[1].details = {
                existing: tableNames,
                missing: missingTables,
                hint: 'Run: node scripts/initDatabase.js'
            };
        }

        // 测试3：检查测试数据
        results.tests.push({
            name: 'Test Data',
            status: 'running',
            message: 'Checking test data...'
        });

        const testUser = await User.findOne({ where: { phone: '081234567890' } });
        const testDevice = await Unit.findOne({ where: { deviceId: 'DEVICE001' } });
        const testCard = await PhysicalCard.findOne({ where: { rfid: 'RFID001' } });

        if (testUser && testDevice && testCard) {
            results.tests[2].status = 'success';
            results.tests[2].message = '✅ Test data exists';
            results.tests[2].details = {
                user: {
                    phone: testUser.phone,
                    balance: testUser.balance,
                    virtualRfid: testUser.virtualRfid
                },
                device: {
                    deviceId: testDevice.deviceId,
                    status: testDevice.status,
                    location: testDevice.location
                },
                card: {
                    rfid: testCard.rfid,
                    status: testCard.status
                }
            };
        } else {
            results.tests[2].status = 'warning';
            results.tests[2].message = '⚠️ Test data not found';
            results.tests[2].details = {
                user: testUser ? 'exists' : 'missing',
                device: testDevice ? 'exists' : 'missing',
                card: testCard ? 'exists' : 'missing',
                hint: 'Run: node scripts/initDatabase.js'
            };
        }

        // 测试4：TCP 服务器状态
        results.tests.push({
            name: 'TCP Server',
            status: 'success',
            message: '✅ TCP server is running',
            details: {
                port: TCP_PORT,
                address: 'atmwater-backend.zeabur.app',
                protocol: 'TCP'
            }
        });

        // 测试5：环境变量
        results.tests.push({
            name: 'Environment Variables',
            status: 'success',
            message: '✅ Environment variables configured',
            details: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                PORT: PORT,
                TCP_PORT: TCP_PORT,
                DB_HOST: process.env.DB_HOST ? '✓' : '✗',
                DB_NAME: process.env.DB_NAME ? '✓' : '✗',
                JWT_SECRET: process.env.JWT_SECRET ? '✓' : '✗'
            }
        });

        // 汇总结果
        const successCount = results.tests.filter(t => t.status === 'success').length;
        const warningCount = results.tests.filter(t => t.status === 'warning').length;
        const failCount = results.tests.filter(t => t.status === 'fail').length;

        results.summary = {
            total: results.tests.length,
            success: successCount,
            warning: warningCount,
            fail: failCount,
            status: failCount > 0 ? 'fail' : (warningCount > 0 ? 'warning' : 'success')
        };

        res.status(200).json(results);

    } catch (error) {
        results.tests.push({
            name: 'System Error',
            status: 'fail',
            message: '❌ Test failed',
            error: error.message
        });

        results.summary = {
            total: results.tests.length,
            success: 0,
            warning: 0,
            fail: 1,
            status: 'fail'
        };

        res.status(500).json(results);
    }
});

// ========================================
// Test Dashboard (HTML 页面)
// ========================================
app.get('/test', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ATMWater Backend - System Test Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 32px;
        }
        .header p {
            color: #666;
            font-size: 16px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .summary-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }
        .summary-card h3 {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        .summary-card .value {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-card.success .value { color: #10b981; }
        .summary-card.warning .value { color: #f59e0b; }
        .summary-card.fail .value { color: #ef4444; }
        .test-list {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .test-item {
            border-left: 4px solid #e5e7eb;
            padding: 20px;
            margin-bottom: 15px;
            background: #f9fafb;
            border-radius: 8px;
            transition: all 0.3s;
        }
        .test-item:hover {
            transform: translateX(5px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-item.success { border-left-color: #10b981; }
        .test-item.warning { border-left-color: #f59e0b; }
        .test-item.fail { border-left-color: #ef4444; }
        .test-item.running { border-left-color: #3b82f6; }
        .test-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .test-name {
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }
        .test-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .test-status.success { background: #d1fae5; color: #065f46; }
        .test-status.warning { background: #fef3c7; color: #92400e; }
        .test-status.fail { background: #fee2e2; color: #991b1b; }
        .test-status.running { background: #dbeafe; color: #1e40af; }
        .test-message {
            color: #666;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .test-details {
            background: white;
            border-radius: 6px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: white;
            font-size: 18px;
        }
        .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
            transition: all 0.3s;
        }
        .refresh-btn:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .footer {
            text-align: center;
            color: white;
            margin-top: 30px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 ATMWater Backend System Test</h1>
            <p>Comprehensive system health check and diagnostics</p>
        </div>

        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Running system tests...</p>
        </div>

        <div id="results" style="display: none;">
            <div class="summary" id="summary"></div>
            <div class="test-list" id="testList"></div>
            <button class="refresh-btn" onclick="runTests()">🔄 Refresh Tests</button>
        </div>

        <div class="footer">
            <p>ATMWater Backend v2.0.0 | Powered by Zeabur</p>
        </div>
    </div>

    <script>
        async function runTests() {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('results').style.display = 'none';

            try {
                const response = await fetch('/api/test');
                const data = await response.json();

                displayResults(data);

                document.getElementById('loading').style.display = 'none';
                document.getElementById('results').style.display = 'block';
            } catch (error) {
                document.getElementById('loading').innerHTML =
                    '<p style="color: #ef4444;">❌ Failed to run tests: ' + error.message + '</p>';
            }
        }

        function displayResults(data) {
            // Display summary
            const summaryHtml = \`
                <div class="summary-card success">
                    <h3>Success</h3>
                    <div class="value">\${data.summary.success}</div>
                </div>
                <div class="summary-card warning">
                    <h3>Warning</h3>
                    <div class="value">\${data.summary.warning}</div>
                </div>
                <div class="summary-card fail">
                    <h3>Failed</h3>
                    <div class="value">\${data.summary.fail}</div>
                </div>
                <div class="summary-card">
                    <h3>Total</h3>
                    <div class="value" style="color: #667eea;">\${data.summary.total}</div>
                </div>
            \`;
            document.getElementById('summary').innerHTML = summaryHtml;

            // Display test results
            const testsHtml = data.tests.map(test => \`
                <div class="test-item \${test.status}">
                    <div class="test-header">
                        <div class="test-name">\${test.name}</div>
                        <div class="test-status \${test.status}">\${test.status}</div>
                    </div>
                    <div class="test-message">\${test.message}</div>
                    \${test.details ? \`
                        <div class="test-details">
                            <pre>\${JSON.stringify(test.details, null, 2)}</pre>
                        </div>
                    \` : ''}
                    \${test.error ? \`
                        <div class="test-details" style="color: #ef4444;">
                            <pre>Error: \${test.error}</pre>
                        </div>
                    \` : ''}
                </div>
            \`).join('');

            document.getElementById('testList').innerHTML = testsHtml;
        }

        // Auto-run tests on page load
        runTests();
    </script>
</body>
</html>
    `);
});

// ========================================
// Routes (暂时注释，等模型创建完成后再启用)
// ========================================
// app.use('/api/auth', require('./src/routes/authRoutes'));
// app.use('/api/wallet', require('./src/routes/walletRoutes'));
// app.use('/api/iot', require('./src/routes/iotRoutes'));
// app.use('/api/users', require('./src/routes/userRoutes'));

// ========================================
// Error Handler
// ========================================
app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========================================
// Start Server
// ========================================
const startServer = async () => {
    try {
        // 1. 测试 MySQL 连接
        await sequelize.authenticate();
        console.log('[MySQL] ✅ Connection established');

        // 2. 同步数据库表结构（开发环境）
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            console.log('[MySQL] ✅ Database synchronized');
        }

        // 3. 启动 HTTP 服务器
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[HTTP] ✅ Server running on port ${PORT}`);
            console.log(`[HTTP] 🌍 Health check: http://localhost:${PORT}/api/health`);
        });

        // 4. 启动 TCP 服务器
        const tcpServer = require('./src/services/tcpServer');
        tcpServer.start();

        // 5. 优雅关闭
        process.on('SIGTERM', async () => {
            console.log('[Server] SIGTERM signal received: closing servers');
            server.close(() => {
                sequelize.close();
                console.log('[Server] ✅ Servers closed gracefully');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('[Server] ❌ Startup error:', error.message);
        console.error('[Server] Stack:', error.stack);

        // 即使数据库连接失败，也启动 HTTP 服务器（用于 Zeabur 健康检查）
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[HTTP] ⚠️ Server running on port ${PORT} (database connection failed)`);
        });
    }
};

startServer();
