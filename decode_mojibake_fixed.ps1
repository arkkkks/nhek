$root = 'C:\Users\MGB\Desktop\nhek'
$bakFiles = Get-ChildItem -Path $root -Recurse -Include *.bak -File
$decoded = 0
foreach ($bak in $bakFiles) {
  $bakPath = $bak.FullName
  $origPath = $bakPath.Substring(0, $bakPath.Length - 4) # remove .bak
  if (-not (Test-Path $origPath)) { continue }
  try {
    $bytes = [System.IO.File]::ReadAllBytes($bakPath)
    # Interpret raw bytes using CP1252 so mojibake chars appear as-is
    $as1252 = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
  } catch {
    Write-Output ("SKIP (read error): " + $bakPath)
    continue
  }
  # Detect common mojibake signatures
  if ($as1252 -notmatch "(\u00E2|\u00C2|\u00C3|\u00EF|\u00F0)") { continue }
  # Convert CP1252-interpreted bytes back into UTF8
  $bytes2 = [System.Text.Encoding]::GetEncoding(1252).GetBytes($as1252)
  $fixed = [System.Text.Encoding]::UTF8.GetString($bytes2)
  if ($fixed -and $fixed -ne $as1252) {
    $preBackup = $origPath + '.predecode.bak'
    if (-not (Test-Path $preBackup)) { Copy-Item -Path $origPath -Destination $preBackup -Force }
    Set-Content -Path $origPath -Value $fixed -Encoding UTF8
    Write-Output ("DECODED: " + $origPath)
    $decoded++
  } else {
    Write-Output ("NO_CHANGE: " + $origPath)
  }
}
Write-Output ("TOTAL_DECODED: " + $decoded)
