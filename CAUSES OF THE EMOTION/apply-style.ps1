# PowerShell script to remove inline <style> blocks and insert link to cause-style.css
Get-ChildItem -Path . -Filter "Cause of *.html" | ForEach-Object {
    $path = $_.FullName
    $text = Get-Content $path -Raw
    # replace inline style with stylesheet link
    $new = $text -replace '(?s)<style>.*?</style>', '<link rel="stylesheet" href="cause-style.css">'

    # ensure fade-out/navigation script exists
    $script = @"
<script>
    // arrange in circle and animate for navigation
    const causes = document.querySelectorAll('.cause');
    const total = causes.length;
    const centerX = 300;
    const centerY = 300;
    const radius = 270;

    causes.forEach((cause, i) => {
        const angle = (2 * Math.PI * i) / total - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle) - 90;
        const y = centerY + radius * Math.sin(angle) - 50;
        cause.style.left = `${x}px`;
        cause.style.top = `${y}px`;

        cause.addEventListener('click', e => {
            e.preventDefault();
            document.body.classList.add('fade-out');
            const href = cause.href;
            setTimeout(() => window.location.href = href, 500);
        });
    });
</script>
"@
    if ($new -notmatch [regex]::Escape('<script>') ) {
        $new = $new -replace '(?=</body>)', "$script`n"
    }

    if ($new -ne $text) {
        Set-Content -Path $path -Value $new
        Write-Host "Updated $path"
    } else {
        Write-Host "No changes needed for $path" -ForegroundColor Yellow
    }
}
