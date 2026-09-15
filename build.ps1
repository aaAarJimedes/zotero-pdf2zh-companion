param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = Join-Path $projectRoot "src"
$manifest = Get-Content -LiteralPath (Join-Path $sourceDir "manifest.json") -Raw | ConvertFrom-Json
if (!$Version) { $Version = $manifest.version }
if ($Version -ne $manifest.version) { throw "Build version must match manifest.version" }
foreach ($field in 'id', 'update_url', 'strict_max_version') {
    if (!$manifest.applications.zotero.$field) { throw "Missing applications.zotero.$field" }
}
$buildDir = Join-Path $projectRoot "dist"
$zipPath = Join-Path $buildDir "pdf2zh-companion-$Version.zip"
$xpiPath = Join-Path $buildDir "pdf2zh-companion-$Version.xpi"

if (Test-Path -LiteralPath $buildDir) {
    $resolved = (Resolve-Path -LiteralPath $buildDir).Path
    if ($resolved -ne (Join-Path $projectRoot 'dist') -or
        ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Unsafe build directory"
    }
    Remove-Item -Recurse -Force -LiteralPath $buildDir
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

$sourceItems = Get-ChildItem -Force -LiteralPath $sourceDir |
    Where-Object { $_.Name -ne "local-config.json" }
Compress-Archive -LiteralPath $sourceItems.FullName -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -LiteralPath $zipPath -Destination $xpiPath

$hash = (Get-FileHash -LiteralPath $xpiPath -Algorithm SHA256).Hash.ToLowerInvariant()
$update = @{
    addons = @{
        $manifest.applications.zotero.id = @{
            updates = @(@{
                version = $Version
                update_link = "https://github.com/aaAarJimedes/zotero-pdf2zh-companion/releases/download/v$Version/pdf2zh-companion-$Version.xpi"
                update_hash = "sha256:$hash"
                applications = @{ zotero = @{
                    strict_min_version = $manifest.applications.zotero.strict_min_version
                    strict_max_version = $manifest.applications.zotero.strict_max_version
                } }
            })
        }
    }
}
$update | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $buildDir 'updates.json') -Encoding UTF8

Write-Output $xpiPath
