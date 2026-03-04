import os
import re

# snippet to insert
css_snippet = '''
        /* Back and Home Buttons */
        .icon-btn {
            position: fixed;
            top: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 230, 245, 0.95));
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24px;
            cursor: pointer;
            z-index: 20;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(254, 197, 229, 0.4);
            border: 2px solid rgba(254, 197, 229, 0.5);
            text-decoration: none;
        }

        .back {
            left: 20px;
        }

        .home {
            right: 20px;
        }

        .icon-btn:hover {
            background: linear-gradient(135deg, #ff1493, #ff69b4);
            transform: scale(1.15) rotate(10deg);
            box-shadow: 0 12px 35px rgba(255, 20, 147, 0.6);
            border-color: rgba(255, 20, 147, 0.8);
            color: white;
        }

        .icon-btn:active {
            transform: scale(1.05) rotate(10deg);
        }
'''

body_buttons = '''
    <!-- BACK BUTTON -->
    <a class="icon-btn back" href="file:///C:/Users/MGB/Desktop/nhek/EMOTION%20CIRCLES.html">&#8592;</a>

    <!-- HOME BUTTON -->
    <a class="icon-btn home" href="file:///C:/Users/MGB/Desktop/nhek/Program%20Mental%20Health.html">&#127968;</a>
'''

root = os.path.abspath(os.path.dirname(__file__))

for dirpath, dirnames, filenames in os.walk(root):
    for fname in filenames:
        if fname.lower().endswith('.html'):
            path = os.path.join(dirpath, fname)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'class="icon-btn back"' in content:
                continue  # already has navigation

            # insert CSS snippet inside existing <style> or create one
            if '<style' in content:
                # find closing </style> of first style block
                content = re.sub(r'(</style>)', css_snippet + '\1', content, count=1)
            else:
                # insert new style block just before </head>
                content = re.sub(r'(</head>)', '<style>' + css_snippet + '</style>\1', content, count=1)

            # insert body buttons after opening <body[^>]*>
            content = re.sub(r'(<body[^>]*>)', r'\1' + body_buttons, content, count=1)

            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated navigation in {path}")
