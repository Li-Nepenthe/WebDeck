$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectName = Split-Path -Leaf $projectRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDir = Join-Path $projectRoot 'packages'
$zipName = "$projectName-source-$timestamp.zip"
$zipPath = Join-Path $outputDir $zipName
$stagingDir = Join-Path $outputDir "$projectName-source-$timestamp"

$excludeDirs = @(
    '.git',
    '.idea',
    '.npm-cache',
    'node_modules',
    'dist',
    'packages'
)

$excludeFiles = @(
    'package-source.ps1'
)

function Test-ExcludedPath {
    param(
        [string]$RelativePath,
        [bool]$IsDirectory
    )

    $normalized = $RelativePath -replace '\\', '/'

    foreach ($dir in $excludeDirs) {
        if ($normalized -eq $dir -or $normalized.StartsWith("$dir/")) {
            return $true
        }
    }

    if (-not $IsDirectory) {
        foreach ($file in $excludeFiles) {
            if ($normalized -eq $file) {
                return $true
            }
        }
    }

    return $false
}

if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingDir | Out-Null

Get-ChildItem -LiteralPath $projectRoot -Force | ForEach-Object {
    $sourcePath = $_.FullName
    $relativePath = $_.Name

    if (Test-ExcludedPath -RelativePath $relativePath -IsDirectory $_.PSIsContainer) {
        return
    }

    $destinationPath = Join-Path $stagingDir $relativePath

    if ($_.PSIsContainer) {
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
    } else {
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    }
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingDir -Recurse -Force

Write-Host ''
Write-Host 'Source package created successfully:' -ForegroundColor Green
Write-Host $zipPath -ForegroundColor Cyan
Write-Host ''
Write-Host 'Included:' -ForegroundColor Yellow
Write-Host '- source code, slides, public assets, README, package files'
Write-Host 'Excluded:' -ForegroundColor Yellow
Write-Host '- .git, .idea, .npm-cache, node_modules, dist, packages'
Write-Host ''
Pause
