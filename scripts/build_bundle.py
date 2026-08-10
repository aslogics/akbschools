"""Bundle the AKB Fee Collection app into a single self-contained HTML file.

Inlines CSS + all JS + the seed data, and converts the four business logos to
base64 data URIs, so the output runs from a double-click (file://), any static
host, or an embedded page — with no external requests.

Usage:  python3 scripts/build_bundle.py
Output: dist/akb-fees-app.html
"""
import base64, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rd(p):
    return open(os.path.join(ROOT, p), encoding='utf-8').read()


LOGOS = ['assets/img/logo-school.svg', 'assets/img/logo-school-full.svg', 'assets/img/logo-sports.svg',
         'assets/img/logo-co.svg', 'assets/img/logo-falcon.svg']
datauris = {p: 'data:image/svg+xml;base64,' + base64.b64encode(rd(p).encode()).decode('ascii') for p in LOGOS}

idx = rd('index.html')
markup = re.search(r'<body>(.*?)<!-- Seed data', idx, re.S).group(1).strip()
css = rd('assets/css/styles.css')
js_files = ['data/seed.js', 'assets/js/utils.js', 'assets/js/store.js', 'assets/js/auth.js',
            'assets/js/receipt.js', 'assets/js/views.js', 'assets/js/app.js']

parts = ['<style>\n' + css + '\n</style>', markup]
for f in js_files:
    parts.append('<script>\n' + rd(f) + '\n</script>')
html = '\n'.join(parts)

for path, uri in datauris.items():
    html = html.replace(path, uri)

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'akb-fees-app.html')
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, '(%.1f KB)' % (os.path.getsize(out) / 1024))
assert 'assets/img/' not in html, 'unreplaced asset path!'
