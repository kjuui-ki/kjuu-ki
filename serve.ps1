$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Port = 8080

Write-Host ""
Write-Host "========================================"
Write-Host " Maher Academy - local site server"
Write-Host "========================================"
Write-Host ""
Write-Host "Open in browser:"
Write-Host "  http://localhost:$Port/login.html"
Write-Host "  http://localhost:$Port/index.html"
Write-Host ""
Write-Host "Press Ctrl+C to stop."
Write-Host ""

if (Get-Command py -ErrorAction SilentlyContinue) {
    py -3 -m http.server $Port
    exit
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server $Port
    exit
}

if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx --yes serve -l $Port
    exit
}

Write-Host "ERROR: Install Python 3 or Node.js, then run serve.bat"
Read-Host "Press Enter to close"
