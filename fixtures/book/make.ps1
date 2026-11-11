# Builds the sample book (our own drawings and sentences) into fixtures/:
#   powershell -ExecutionPolicy Bypass -File fixtures\book\make.ps1
# sample-book.cbz = three PNG pages; sample-book.pdf = page 1 real vertical text, page 2 an image (like a scan).
$ErrorActionPreference = "Stop"
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) + @(Get-ChildItem "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-*\*\chrome-headless-shell.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName) |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "No Chromium browser found. Install Edge or Chrome, or run: npx playwright install chromium" }

$here = $PSScriptRoot
$out = Split-Path $here
$ErrorActionPreference = "Continue" # Chromium prints progress on stderr; don't treat it as failure
function Chrome($flags, $source) {
  $url = ([System.Uri](Join-Path $here $source)).AbsoluteUri
  & $edge @("--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--virtual-time-budget=4000") @flags $url 2>$null | Out-Null
}

foreach ($n in 1..3) {
  Chrome @("--window-size=800,1200", "--screenshot=$(Join-Path $here "page$n.png")") "page$n.svg"
}
Chrome @("--no-pdf-header-footer", "--print-to-pdf=$(Join-Path $out 'sample-book.pdf')") "book.html"

$pngs = 1..3 | ForEach-Object { Join-Path $here "page$_.png" }
$zip = Join-Path $out "sample-book.zip"
Remove-Item $zip, (Join-Path $out "sample-book.cbz") -ErrorAction SilentlyContinue
Compress-Archive -Path $pngs -DestinationPath $zip
Move-Item $zip (Join-Path $out "sample-book.cbz")
Get-Item (Join-Path $out "sample-book.*") | Select-Object Name, Length
# page2.png stays: book.html needs it. It is git-ignored.
Remove-Item (Join-Path $here "page1.png"), (Join-Path $here "page3.png")
