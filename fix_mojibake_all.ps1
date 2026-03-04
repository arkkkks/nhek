$root = 'C:\Users\MGB\Desktop\nhek'
$pattern = '[\u00C0-\u00FF][\u0080-\u00BF]{1,3}'
$files = Get-ChildItem -Path $root -Recurse -Include *.html,*.htm -File
$updated=0
foreach($file in $files){
  $path=$file.FullName
  try{
    $orig = Get-Content -Path $path -Raw -Encoding UTF8
  } catch { $orig = Get-Content -Path $path -Raw }
  $new = [regex]::Replace($orig, $pattern, '')
  if($orig -ne $new){
    Copy-Item -Path $path -Destination ($path + '.bak') -Force
    Set-Content -Path $path -Value $new -Encoding UTF8
    Write-Output "UPDATED: $path"
    $updated++
  }
}
Write-Output "TOTAL_UPDATED: $updated"
