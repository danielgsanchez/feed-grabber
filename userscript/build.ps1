# Builds feed-grabber.user.js from the extension's source files.
# Run it after changing the extension:
#   Windows:       powershell -ExecutionPolicy Bypass -File userscript/build.ps1
#   Linux and Mac: pwsh userscript/build.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding $false

function Read-Source([string]$name) {
  ([IO.File]::ReadAllText((Join-Path $root $name), $utf8)) -replace "`r`n", "`n"
}

# Turns text into a JavaScript string literal. Done by hand because ConvertTo-Json escapes
# differently in Windows PowerShell and PowerShell 7, and the result must match on every system.
function To-JsString([string]$text) {
  $escaped = $text.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n').Replace("`t", '\t')
  "`"$escaped`""
}

$manifest = (Read-Source 'manifest.json') | ConvertFrom-Json

# The popup's page rules become rules for the panel inside its shadow root.
$panelCss = (Read-Source 'popup.css').Replace(':root {', ':host {').Replace('body {', '.igdl-panel {')
$panelCss += @'

:host {
  position: fixed;
  z-index: 2147483647;
  top: 16px;
  right: 16px;
}

:host([hidden]) {
  display: none;
}

.igdl-panel {
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.igdl-panel > button + button {
  margin-left: 8px;
}
'@

# Only the markup between <body> and the first <script> is needed.
$popupHtml = Read-Source 'popup.html'
$bodyStart = $popupHtml.IndexOf('<body>') + '<body>'.Length
$panelHtml = $popupHtml.Substring($bodyStart, $popupHtml.IndexOf('<script') - $bodyStart).Trim()

$output = Read-Source 'userscript/template.user.js'
$replacements = [ordered]@{
  '{{VERSION}}'      = $manifest.version
  '{{DESCRIPTION}}'  = $manifest.description
  '{{filename.js}}'  = Read-Source 'filename.js'
  '{{page-hook.js}}' = Read-Source 'page-hook.js'
  '{{content.css}}'  = To-JsString (Read-Source 'content.css')
  '{{content.js}}'   = Read-Source 'content.js'
  '{{popup.css}}'    = To-JsString $panelCss
  '{{popup.html}}'   = To-JsString $panelHtml
  '{{popup.js}}'     = Read-Source 'popup.js'
}
foreach ($key in $replacements.Keys) {
  if (-not $output.Contains($key)) { throw "Placeholder $key not found in the template" }
  $output = $output.Replace($key, [string]$replacements[$key])
}

$target = Join-Path $root 'feed-grabber.user.js'
[IO.File]::WriteAllText($target, $output, $utf8)
"Built $target (version $($manifest.version), $($output.Length) characters)"
