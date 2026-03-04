$folders = @(
    "C:\Users\MGB\Desktop\nhek\Cause of angry",
    "C:\Users\MGB\Desktop\nhek\cause of excited",
    "C:\Users\MGB\Desktop\nhek\cause of guilt",
    "C:\Users\MGB\Desktop\nhek\cause of tired"
)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) { continue }
    Get-ChildItem -Path $folder -Filter *.html | ForEach-Object {
        $path = $_.FullName
        $content = Get-Content -Path $path -Raw
        if ($content -match "shuffleArray") { return }
        # find anchors
        $anchors = [regex]::Matches($content,'<a[^>]*href="([^"]+)"[^>]*>([^<]*)</a>')
        if ($anchors.Count -eq 0) { return }
        $verseLines = @()
        foreach ($m in $anchors) {
            $href = $m.Groups[1].Value
            $text = $m.Groups[2].Value.Trim()
            if ($href -and $text) {
                $verseLines += "{ href: `"$href`", text: `"$text`" }"
            }
        }
        if ($verseLines.Count -eq 0) { return }
        $versesJs = "[\r\n            " + ($verseLines -join ",\r\n            ") + "\r\n        ]"
        $newVerseHtml = '<button class="refresh-btn" onclick="refreshVerses()">&#8635; Get New Verses</button>`r`n    <div class="verse-container" id="verseContainer"></div>'
        $content = [regex]::Replace($content,'<div class="verse-container".*?</div>',$newVerseHtml,'Singleline')
        $script = "`r`n    <script>`r`n        const verses = $versesJs;`r`n`r`n        function shuffleArray(array) {`r`n            const newArray = [...array];`r`n            for (let i = newArray.length - 1; i > 0; i--) {`r`n                const j = Math.floor(Math.random() * (i + 1));`r`n                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];`r`n            }`r`n            return newArray;`r`n        }`r`n`r`n        function displayVerses() {`r`n            const container = document.getElementById('verseContainer');`r`n            const shuffled = shuffleArray(verses);`r`n            const selected = shuffled.slice(0, 9);`r`n            container.innerHTML = selected.map(verse => `
                `<a href="${{verse.href}}" class="verse-button">${{verse.text}}</a>``r`n            ).join('');`r`n        }`r`n`r`n        function refreshVerses() {`r`n            displayVerses();`r`n        }`r`n`r`n        displayVerses();`r`n    </script>`r`n"
        if ($content -match '</body>') {
            $content = $content -replace '</body>', $script + '</body>'
        } else {
            $content += $script
        }
        Set-Content -Path $path -Value $content -Encoding utf8
    }
}
Write-Output "Conversion script complete."
