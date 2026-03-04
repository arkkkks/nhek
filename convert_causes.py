import glob
import os
import re

# utility functions

def convert_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'shuffleArray' in content:
        return False  # already dynamic

    # find all verse anchors
    verses = []
    for match in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>([^<]*)</a>', content):
        href, txt = match.groups()
        txt = txt.strip()
        if href and txt:
            verses.append({'href': href, 'text': txt})
    if not verses:
        # nothing to convert
        return False
    # build verses array JS string
    verse_items = [f'{{ href: "{v["href"]}", text: "{v["text"]}" }}' for v in verses]
    verses_js = "[\n            " + ",\n            ".join(verse_items) + "\n        ]"

    # replace existing verse-container with dynamic version
    new_verse_html = '<button class="refresh-btn" onclick="refreshVerses()">&#8635; Get New Verses</button>\n    <div class="verse-container" id="verseContainer"></div>'
    content = re.sub(r'<div class="verse-container".*?</div>', new_verse_html, content, flags=re.DOTALL)

    # add script before </body>
    script = f"""
    <script>
        const verses = {verses_js};

        function shuffleArray(array) {{
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {{
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }}
            return newArray;
        }}

        function displayVerses() {{
            const container = document.getElementById('verseContainer');
            const shuffled = shuffleArray(verses);
            const selected = shuffled.slice(0, 9);
            container.innerHTML = selected.map(verse => 
                `<a href="${{verse.href}}" class="verse-button">${{verse.text}}</a>`
            ).join('');
        }}

        function refreshVerses() {{
            displayVerses();
        }}

        displayVerses();
    </script>
"""
    if '</body>' in content:
        content = content.replace('</body>', script + '\n</body>')
    else:
        content += script

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True

# scan directories
base = r"c:\Users\MGB\Desktop\nhek"
# include a list of folders to process
folders = [
    "Cause of angry",
    "cause of excited",
    "cause of guilt",
    "cause of tired",
    "Cause of Regret",
    "Cause of nervous",
    "Cause of worried",
    "Cause of stress",
    # maybe additional directories
]

converted = []
skipped = []
for f in folders:
    folder_path = os.path.join(base, f)
    if not os.path.isdir(folder_path):
        continue
    for html in glob.glob(os.path.join(folder_path, '*.html')):
        ok = convert_file(html)
        if ok:
            converted.append(html)
        else:
            skipped.append(html)

print('converted', converted)
print('skipped', skipped)
