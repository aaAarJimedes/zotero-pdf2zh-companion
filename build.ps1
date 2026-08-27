param(
    [string]$Version = "1.2.1"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = Join-Path $projectRoot "src"
$buildDir = Join-Path $projectRoot "dist"
$zipPath = Join-Path $buildDir "pdf2zh-companion-$Version.zip"
$xpiPath = Join-Path $buildDir "pdf2zh-companion-$Version.xpi"

if (Test-Path -LiteralPath $buildDir) {
    Remove-Item -Recurse -Force -LiteralPath $buildDir
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

$sourceItems = Get-ChildItem -Force -LiteralPath $sourceDir |
    Where-Object { $_.Name -ne "local-config.json" }
Compress-Archive -LiteralPath $sourceItems.FullName -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -LiteralPath $zipPath -Destination $xpiPath

Write-Output $xpiPath
