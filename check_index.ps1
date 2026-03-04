$f = 'C:\Users\MGB\Desktop\nhek\Angry question\p2.html'
$s = Get-Content -Path $f -Raw
Write-Output ($s.IndexOf('ð'))
Write-Output $s.Substring(90,20)
