$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'src/manifest.json') -Raw | ConvertFrom-Json
$xpi = Join-Path $root "dist/pdf2zh-companion-$($manifest.version).xpi"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($xpi)
try {
    foreach ($name in 'manifest.json','bootstrap.js','prefs.js','content/icons/server.svg') {
        $entry = $zip.GetEntry($name)
        if (!$entry) { throw "Missing packaged file: $name" }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { $actual = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $expected = Get-Content (Join-Path $root "src/$name") -Raw
        if ($actual -cne $expected) { throw "Packaged source differs: $name" }
    }
    if ($zip.Entries.FullName -match 'local-config|\.git|\.log$|compare|translate') { throw 'Unexpected private/development/removed feature file' }
} finally { $zip.Dispose() }
$updates = Get-Content (Join-Path $root 'dist/updates.json') -Raw | ConvertFrom-Json
$entry = $updates.addons.'pdf2zh-companion@local'.updates[0]
if ($entry.version -ne $manifest.version) { throw 'Update version mismatch' }
if ($entry.update_hash -ne ('sha256:' + (Get-FileHash $xpi -Algorithm SHA256).Hash.ToLowerInvariant())) { throw 'Update hash mismatch' }
if ($entry.update_link -ne "https://github.com/aaAarJimedes/zotero-pdf2zh-companion/releases/download/v$($manifest.version)/pdf2zh-companion-$($manifest.version).xpi") { throw 'Unexpected update URL' }
Write-Output 'Packaged source, structure, version and update hash verified'
