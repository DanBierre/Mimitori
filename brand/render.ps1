# Renders the brand PNGs into public/ with a headless Chromium (Edge, Chrome or Playwright's). Run after editing an SVG:
#   powershell -ExecutionPolicy Bypass -File brand\render.ps1
$ErrorActionPreference = "Stop"
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) + @(Get-ChildItem "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-*\*\chrome-headless-shell.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName) |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "No Chromium browser found. Install Edge or Chrome, or run: npx playwright install chromium" }

$brand = $PSScriptRoot
$public = Join-Path (Split-Path $brand) "public"

function Shot($source, $out, $w, $h, [switch]$transparent) {
  $url = ([System.Uri](Join-Path $brand $source)).AbsoluteUri
  $flags = @("--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--virtual-time-budget=4000", "--window-size=$w,$h", "--screenshot=$(Join-Path $public $out)")
  if ($transparent) { $flags += "--default-background-color=00000000" }
  $ErrorActionPreference = "Continue" # Chromium prints progress on stderr; don't treat it as failure
  & $edge @flags $url 2>$null | Out-Null
  Write-Host "$out ($w x $h)"
}

# Small sizes (tab icon, app header) use the simplified mark; everything 180px and up uses the full one.
Copy-Item (Join-Path $brand "mark-small.svg") (Join-Path $public "favicon.svg")
Shot "mark-small.svg" "favicon-32.png" 32 32 -transparent
Shot "mark.svg" "icon-192.png" 192 192 -transparent
Shot "mark.svg" "icon-512.png" 512 512 -transparent
Shot "mark-full.svg" "apple-touch-icon.png" 180 180
Shot "mark-full.svg" "icon-maskable-512.png" 512 512
Shot "og.html" "og.png" 1200 630
