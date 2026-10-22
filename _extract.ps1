$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Rasheed\.cline\data\workspaces\chat\seeds-academics-hub'
$c = Get-Content (Join-Path $root 'app.js') -Raw
$out = New-Object System.Collections.Generic.List[string]

function Add-Cat([string]$name, [string]$pattern) {
  $script:out.Add("### $name")
  foreach ($m in [regex]::Matches($script:c, $pattern)) {
    $v = $m.Groups[1].Value.Trim()
    if ($v -and $v -notmatch '\$' -and $v -notmatch '<') { $script:out.Add($v) }
  }
}

Add-Cat 'TH' '<th[^>]*>([^<{]*)</th>'
Add-Cat 'H2' '<h2[^>]*>([^<{]*)</h2>'
Add-Cat 'H3' '<h3[^>]*>([^<{]*)</h3>'
Add-Cat 'PAGEHEADING' "pageHeading\('([^']*)',\s*'([^']*)',\s*'([^']*)'"
Add-Cat 'METRIC' "metric\('([^']*)'"
Add-Cat 'FIELD' "field\('[^']*',\s*'([^']*)'"
Add-Cat 'BUTTON' '<button[^>]*>([^<{]*)</button>'

$script:out | Sort-Object -Unique | Set-Content (Join-Path $root '_catalog.txt') -Encoding UTF8
Write-Output ('lines: ' + $script:out.Count)
