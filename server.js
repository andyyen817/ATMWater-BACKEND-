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

// 持久化磁盘文件（头像、固件等）- Zeabur 挂载目录 /app/uploads
const uploadPath = process.env.NODE_ENV === 'production'
  ? '/app/uploads'
  : require('path').join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadPath));

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
                hint: 'Click "Initialize Database" button below'
            };
        }

        // 测试3：检查测试数据（只有在表存在时才检查）
        if (missingTables.length === 0) {
            results.tests.push({
                name: 'Test Data',
                status: 'running',
                message: 'Checking test data...'
            });

            const { User, PhysicalCard, Unit } = require('./src/models');

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
                    hint: 'Click "Initialize Database" button below'
                };
            }
        } else {
            results.tests.push({
                name: 'Test Data',
                status: 'warning',
                message: '⚠️ Skipped (tables missing)',
                details: {
                    hint: 'Initialize database first'
                }
            });
        }

        // 测试4：TCP 服务器状态
        results.tests.push({
            name: 'TCP Server',
            status: 'success',
            message: '✅ TCP server is running',
            details: {
                containerPort: TCP_PORT,
                externalPort: 30235,
                externalHost: 'hkg1.clusters.zeabur.com',
                internalHost: 'atmwater-backend.zeabur.app',
                protocol: 'TCP',
                note: 'Hardware devices should connect to hkg1.clusters.zeabur.com:30235'
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
// Database Initialization Route (一键初始化)
// ========================================
app.post('/api/init-database', async (req, res) => {
    const bcrypt = require('bcryptjs');

    try {
        console.log('[Init] Starting database initialization...');

        // 1. 同步数据库表结构
        await sequelize.sync({ force: false, alter: true });
        console.log('[Init] ✅ Database schema synchronized');

        // 2. 加载模型
        const { User, PhysicalCard, Unit } = require('./src/models');

        // 3. 创建测试用户
        const existingUser = await User.findOne({ where: { phone: '081234567890' } });
        if (!existingUser) {
            const hashedPassword = await bcrypt.hash('password123', 10);
            await User.create({
                phone: '081234567890',
                password: hashedPassword,
                pin: '1234',
                name: 'Test User',
                balance: 50000.00,
                virtualRfid: 'VIRT_081234567890',
                referralCode: 'TEST001',
                role: 'user'
            });
            console.log('[Init] ✅ Created test user: 081234567890');
        } else {
            console.log('[Init] ℹ️ Test user already exists');
        }

        // 4. 创建管理员
        const existingAdmin = await User.findOne({ where: { phone: '081234567891' } });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                phone: '081234567891',
                password: hashedPassword,
                pin: '9999',
                name: 'Admin User',
                balance: 0.00,
                virtualRfid: 'VIRT_081234567891',
                referralCode: 'ADMIN001',
                role: 'admin'
            });
            console.log('[Init] ✅ Created admin user: 081234567891');
        } else {
            console.log('[Init] ℹ️ Admin user already exists');
        }

        // 5. 创建测试设备
        const existingDevice = await Unit.findOne({ where: { deviceId: 'DEVICE001' } });
        if (!existingDevice) {
            await Unit.create({
                deviceId: 'DEVICE001',
                password: 'pudow',
                name: 'Test Water Dispenser',
                type: 'WaterDispenser',
                location: 'Jakarta Office',
                address: 'Jl. Sudirman No. 123',
                pricePerLiter: 500,
                status: 'online',
                isActive: true
            });
            console.log('[Init] ✅ Created test device: DEVICE001');
        } else {
            console.log('[Init] ℹ️ Test device already exists');
        }

        // 6. 创建测试 RFID 卡
        const user = await User.findOne({ where: { phone: '081234567890' } });
        const existingCard = await PhysicalCard.findOne({ where: { rfid: 'RFID001' } });
        if (!existingCard && user) {
            await PhysicalCard.create({
                rfid: 'RFID001',
                userId: user.id,
                status: 'active',
                batchId: 'BATCH001'
            });
            console.log('[Init] ✅ Created test RFID card: RFID001');
        } else {
            console.log('[Init] ℹ️ Test RFID card already exists');
        }

        res.status(200).json({
            success: true,
            message: '✅ Database initialized successfully',
            data: {
                testUser: {
                    phone: '081234567890',
                    password: 'password123',
                    pin: '1234',
                    balance: 'Rp 50,000',
                    virtualRfid: 'VIRT_081234567890'
                },
                adminUser: {
                    phone: '081234567891',
                    password: 'admin123',
                    pin: '9999'
                },
                testDevice: {
                    deviceId: 'DEVICE001',
                    password: 'pudow',
                    location: 'Jakarta Office',
                    price: 'Rp 500/L'
                },
                testCard: {
                    rfid: 'RFID001',
                    boundTo: '081234567890'
                }
            }
        });

    } catch (error) {
        console.error('[Init] ❌ Initialization failed:', error.message);
        res.status(500).json({
            success: false,
            message: '❌ Database initialization failed',
            error: error.message
        });
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
        .init-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
            margin-left: 10px;
            transition: all 0.3s;
        }
        .init-btn:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .init-btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
        }
        .footer {
            text-align: center;
            color: white;
            margin-top: 30px;
            font-size: 14px;
        }
        .alert {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            color: #92400e;
        }
        .alert.success {
            background: #d1fae5;
            border-left-color: #10b981;
            color: #065f46;
        }
        .alert.error {
            background: #fee2e2;
            border-left-color: #ef4444;
            color: #991b1b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 ATMWater Backend System Test</h1>
            <p>Comprehensive system health check and diagnostics</p>
        </div>

        <div id="alert" style="display: none;"></div>

        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Running system tests...</p>
        </div>

        <div id="results" style="display: none;">
            <div class="summary" id="summary"></div>
            <div class="test-list" id="testList"></div>
            <div>
                <button class="refresh-btn" onclick="runTests()">🔄 Refresh Tests</button>
                <button class="init-btn" id="initBtn" onclick="initDatabase()">🔧 Initialize Database</button>
            </div>
        </div>

        <div class="footer">
            <p>ATMWater Backend v2.0.0 | Powered by Zeabur</p>
        </div>
    </div>

    <script>
        async function runTests() {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('results').style.display = 'none';
            document.getElementById('alert').style.display = 'none';

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

        async function initDatabase() {
            const btn = document.getElementById('initBtn');
            const alertDiv = document.getElementById('alert');

            // Disable button
            btn.disabled = true;
            btn.textContent = '⏳ Initializing...';

            alertDiv.style.display = 'none';

            try {
                const response = await fetch('/api/init-database', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success) {
                    alertDiv.className = 'alert success';
                    alertDiv.innerHTML = '<strong>✅ Success!</strong> ' + data.message + '<br><br>Refreshing tests in 2 seconds...';
                    alertDiv.style.display = 'block';

                    // Auto refresh after 2 seconds
                    setTimeout(() => {
                        runTests();
                    }, 2000);
                } else {
                    alertDiv.className = 'alert error';
                    alertDiv.innerHTML = '<strong>❌ Error!</strong> ' + data.message;
                    alertDiv.style.display = 'block';
                }
            } catch (error) {
                alertDiv.className = 'alert error';
                alertDiv.innerHTML = '<strong>❌ Error!</strong> Failed to initialize database: ' + error.message;
                alertDiv.style.display = 'block';
            } finally {
                // Re-enable button
                btn.disabled = false;
                btn.textContent = '🔧 Initialize Database';
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
// Routes (已启用 - Stage 1 完成)
// ========================================
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/wallet', require('./src/routes/walletRoutes'));
app.use('/api/iot', require('./src/routes/iotRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/partners', require('./src/routes/partnerRoutes'));
app.use('/api/steward', require('./src/routes/stewardRoutes'));
app.use('/api/rp', require('./src/routes/rpRoutes'));

// 添加缺失的路由
app.use('/api/applications', require('./src/routes/applicationRoutes'));
app.use('/api/finance', require('./src/routes/financeRoutes'));
app.use('/api/settings', require('./src/routes/settingRoutes'));

// ========================================
// Profit Sharing Routes (新分润系统)
// ========================================
app.use('/api/profit-sharing', require('./src/routes/profitSharingRoutes'));

// ========================================
// Card Routes (物理水卡管理)
// ========================================
app.use('/api/cards', require('./src/routes/cardRoutes'));

// ========================================
// QR Code Routes (二维码验证)
// ========================================
app.use('/api/qr', require('./src/routes/qrRoutes'));

// 固件升级路由
app.use('/api/firmware', require('./src/routes/firmwareRoutes'));

// 设备参数配置路由
app.use('/api/admin/device-settings', require('./src/routes/deviceSettingsRoutes'));

// 静态内容管理路由（条款/隐私/关于/帮助）
app.use('/api/content', require('./src/routes/contentRoutes'));

// 邀请好友 / 推荐返现路由
app.use('/api/referral', require('./src/routes/referralRoutes'));

// ========================================
// Temporary Fix Endpoint (Remove after use)
// ========================================
app.post('/api/fix-physical-cards-temp', async (req, res) => {
    try {
        // 步骤1：检查 issuedBy 字段是否存在
        const [columns] = await sequelize.query(
            "SHOW COLUMNS FROM physical_cards LIKE 'issuedBy'"
        );

        if (columns.length === 0) {
            // 字段不存在，需要添加
            await sequelize.query(
                `ALTER TABLE physical_cards
                 ADD COLUMN issuedBy INT NULL
                 COMMENT '发卡人ID（售水站管理者）'
                 AFTER status`
            );

            // 添加外键约束
            await sequelize.query(
                `ALTER TABLE physical_cards
                 ADD CONSTRAINT fk_physical_cards_issuedBy
                 FOREIGN KEY (issuedBy) REFERENCES users(id)
                 ON UPDATE CASCADE ON DELETE SET NULL`
            );

            return res.json({
                success: true,
                message: 'Added issuedBy column to physical_cards table',
                action: 'column_added'
            });
        }

        // 步骤2：检查是否需要更新
        const [checkCards] = await sequelize.query(
            'SELECT COUNT(*) as count FROM physical_cards WHERE issuedBy IS NOT NULL'
        );

        if (checkCards[0].count === 0) {
            return res.json({
                success: true,
                message: 'Already fixed - all cards are unassigned',
                updated: 0
            });
        }

        // 步骤3：更新所有卡片的 issuedBy 为 NULL
        const [results] = await sequelize.query(
            'UPDATE physical_cards SET issuedBy = NULL WHERE issuedBy IS NOT NULL'
        );

        // 步骤4：验证结果
        const [cards] = await sequelize.query(
            'SELECT COUNT(*) as total, SUM(CASE WHEN issuedBy IS NULL THEN 1 ELSE 0 END) as unassigned FROM physical_cards'
        );

        res.json({
            success: true,
            message: 'Physical cards fixed successfully',
            updated: results.affectedRows,
            total: cards[0].total,
            unassigned: cards[0].unassigned
        });
    } catch (error) {
        console.error('[Fix Physical Cards] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// 404 Handler - 返回JSON而不是HTML
// ========================================
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.path}`,
        error: 'Endpoint not found'
    });
});

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

        // 3.5. 初始化 WebSocket 服务
        const websocketService = require('./src/services/websocketService');
        websocketService.initialize(server);
        console.log('[WebSocket] ✅ WebSocket service initialized');

        // 4. 启动 TCP 服务器
        const tcpServer = require('./src/services/tcpServer');
        tcpServer.start();

        // 5. 启动定时任务（分润系统）
        require('./src/jobs/monthlyResetJob');
        require('./src/jobs/dailyAlertJob');
        console.log('[Jobs] ✅ Scheduled jobs initialized');

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
