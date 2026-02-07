# ========================================
# ATMWater Backend - Zeabur 初始化脚本
# 在 Zeabur 终端运行此脚本
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Zeabur Database Initialization" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在 Zeabur 环境
if ($env:ZEABUR -eq $null) {
    Write-Host "⚠️  Warning: Not running in Zeabur environment" -ForegroundColor Yellow
    Write-Host "This script is designed to run in Zeabur Terminal" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

# 显示环境信息
Write-Host "[INFO] Environment Variables:" -ForegroundColor Cyan
Write-Host "  DB_HOST: $env:DB_HOST"
Write-Host "  DB_PORT: $env:DB_PORT"
Write-Host "  DB_NAME: $env:DB_NAME"
Write-Host "  DB_USER: $env:DB_USER"
Write-Host ""

# 运行初始化脚本
Write-Host "[1/1] Running database initialization..." -ForegroundColor Cyan
node scripts/initDatabase.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Database initialized successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Test Data Created:" -ForegroundColor Cyan
    Write-Host "  👤 User: 081234567890 (Password: password123, PIN: 1234)" -ForegroundColor White
    Write-Host "  🔧 Device: DEVICE001 (Password: pudow)" -ForegroundColor White
    Write-Host "  💳 RFID Card: RFID001" -ForegroundColor White
    Write-Host "  💳 Virtual RFID: VIRT_081234567890" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Run local test: python test_tcp_client.py" -ForegroundColor White
    Write-Host "  2. Or run: ./test_all.bat (Windows) or ./test_all.sh (Linux/Mac)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Database initialization failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible reasons:" -ForegroundColor Yellow
    Write-Host "  1. Database connection failed" -ForegroundColor White
    Write-Host "  2. Environment variables not set correctly" -ForegroundColor White
    Write-Host "  3. MySQL service not running" -ForegroundColor White
    Write-Host ""
    Write-Host "Please check Zeabur logs for more details" -ForegroundColor Yellow
    Write-Host ""
}

