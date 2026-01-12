# Script pour démarrer le backend et tester toutes les routes
$ErrorActionPreference = "Continue"

Write-Host "🚀 Démarrage du backend..." -ForegroundColor Cyan

# Démarrer le backend en arrière-plan
$backend = Start-Process powershell -ArgumentList "-Command", "cd '$PSScriptRoot'; npx ts-node src/server.ts" -PassThru -WindowStyle Hidden

Write-Host "⏳ Attente démarrage backend (10 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "🧪 Lancement des tests..." -ForegroundColor Green
npx ts-node test-all-routes.ts

Write-Host "`n✅ Tests terminés - Backend toujours actif (PID: $($backend.Id))" -ForegroundColor Green
Write-Host "Pour arrêter le backend: Stop-Process -Id $($backend.Id)" -ForegroundColor Yellow
