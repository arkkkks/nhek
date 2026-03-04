$root = 'C:\Users\MGB\Desktop\nhek'
$bakFiles = Get-ChildItem -Path $root -Recurse -Include *.bak -File
$decoded=0
foreach($bak in $bakFiles){
  $bakPath = $bak.FullName
  $origPath = $bakPath.Substring(0,$bakPath.Length - 4) # remove .bak
  if (-not (Test-Path $origPath)) { continue }
  try{
    $bytes = [System.IO.File]::ReadAllBytes($bakPath)
    $as1252 = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
  } catch {
    Write-Output ("SKIP (read error): " + $bakPath)
    continue
  }
  if ($as1252 -notmatch 'â|Â|Ã|ð|ðŸ|âœ') { continue }
  # Re-encode the CP1252-produced string bytes and decode as UTF8
  $bytes2 = [System.Text.Encoding]::GetEncoding(1252).GetBytes($as1252)
  $fixed = [System.Text.Encoding]::UTF8.GetString($bytes2)
  if ($fixed -and $fixed -ne $as1252) {
    # create a safe pre-decode backup of current (possibly stripped) file
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
