$filepath = 'C:\Users\MGB\Desktop\nhek\Angry question\p2.html'
$s = Get-Content -Path $filepath -Raw
$pattern = '[\u00F0-\u00F4][\u0080-\u00BF]{2,3}'
$matches = [regex]::Matches($s,$pattern)
if ($matches.Count -eq 0) { Write-Output 'NO_MATCHES'; exit }
$seen = @{}
foreach ($m in $matches) {
  $t = $m.Value
  if (-not $seen.ContainsKey($t)) {
    $seen[$t] = $true
    $b = [System.Text.Encoding]::GetEncoding(28591).GetBytes($t)
    $g = [System.Text.Encoding]::UTF8.GetString($b)
    Write-Output "MATCH: $t  =>  $g"
  }
}
