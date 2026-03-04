$f='C:\Users\MGB\Desktop\nhek\Angry question\p2.html'
$matchobj = Select-String -Path $f -Pattern 'ð' -AllMatches | Select-Object -First 1
if(-not $matchobj){ Write-Output 'NO_MATCHLINE'; exit }
$line = $matchobj.Line
Write-Output "LINE: $line"
$pattern='[\u00F0-\u00F4][\u0080-\u00BF]{2,3}'
$ms = [regex]::Matches($line,$pattern)
if($ms.Count -eq 0){ Write-Output 'NO_REGEX_MATCH' ; exit }
foreach($m in $ms){ $t=$m.Value; $b=[System.Text.Encoding]::GetEncoding(28591).GetBytes($t); $g=[System.Text.Encoding]::UTF8.GetString($b); Write-Output "FOUND: $t => $g" }
