# ========================================
# ATMWater Backend - 快速测试脚本
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 ATMWater Backend Quick Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤1：测试健康检查
Write-Host "[1/3] Testing health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://atmwater-backend.zeabur.app/api/health" -Method Get
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "   Database: $($response.database)" -ForegroundColor White
    Write-Host "   Version: $($response.version)" -ForegroundColor White
    Write-Host "   Timestamp: $($response.timestamp)" -ForegroundColor White
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 步骤2：提示初始化数据库
Write-Host "[2/3] Database Initialization" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Please run this command in Zeabur Terminal:" -ForegroundColor White
Write-Host ""
Write-Host "  node scripts/initDatabase.js" -ForegroundColor Green
Write-Host ""
Write-Host "Expected output:" -ForegroundColor White
Write-Host "  ✅ Created user: 081234567890" -ForegroundColor Gray
Write-Host "  ✅ Created device: DEVICE001" -ForegroundColor Gray
Write-Host "  ✅ Created RFID card: RFID001" -ForegroundColor Gray
Write-Host ""
$continue = Read-Host "Have you completed the initialization? (y/n)"
if ($continue -ne "y") {
    Write-Host "Please initialize the database first, then run this script again." -ForegroundColor Yellow
    exit 0
}
Write-Host ""

# 步骤3：测试 TCP 连接
Write-Host "[3/3] Testing TCP connection..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
if (Test-Path "test_tcp_client.py") {
    python test_tcp_client.py
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ All tests completed successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Test Summary:" -ForegroundColor Cyan
        Write-Host "  ✅ Health check: PASSED" -ForegroundColor White
        Write-Host "  ✅ Database: CONNECTED" -ForegroundColor White
        Write-Host "  ✅ TCP server: RUNNING" -ForegroundColor White
        Write-Host "  ✅ Device authentication: SUCCESS" -ForegroundColor White
        Write-Host "  ✅ Water dispensing: SUCCESS" -ForegroundColor White
        Write-Host ""
        Write-Host "🎯 Server Info:" -ForegroundColor Cyan
        Write-Host "  HTTP: https://atmwater-backend.zeabur.app" -ForegroundColor White
        Write-Host "  TCP: atmwater-backend.zeabur.app:55036" -ForegroundColor White
        Write-Host "  Device ID: DEVICE001" -ForegroundColor White
        Write-Host "  Password: pudow" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ TCP test failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible reasons:" -ForegroundColor Yellow
        Write-Host "  1. Database not initialized" -ForegroundColor White
        Write-Host "  2. TCP port 55036 not exposed in Zeabur" -ForegroundColor White
        Write-Host "  3. Device or user not created" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host "❌ test_tcp_client.py not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

