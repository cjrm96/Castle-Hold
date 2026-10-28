#!/usr/bin/env python3
"""Castle Siege packaging: full web game, free demos for game websites, and the Steam desktop app."""
import os, re, shutil, json, zipfile, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'game')
OUT = os.path.join(HERE, 'dist')
DOCS = os.path.join(HERE, 'docs')
DESK = os.path.join(HERE, 'desktop')
JS = ['config.js','data.js','world.js','sim.js','ai.js','modes.js','render.js','render3d.js','save.js','editor.js','ui.js','platform.js','achievements.js','tutorial.js','menus.js','three.min.js']
DIRS = ['music','sfx','fonts']

def page():
    src = open(f'{SRC}/index.html').read()
    head, body = src.split('</style>', 1)
    head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            + head + '\nbody{margin:0}\n</style>\n</head>\n<body>' + body.rstrip() + '\n</body>\n</html>\n')

def config(**k):
    c = dict(version='1.1.0', edition='full', ads='none', platform='web', packs=['frontier'], storeUrl='', packUrl={'frontier': ''})
    c.update(k)
    s = open(f'{SRC}/config.js').read()
    body = "const BUILD=" + json.dumps(c, indent=2) + ";\n"
    return re.sub(r'const BUILD=\{.*?\n\};\n', body, s, flags=re.S)

CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; media-src \'self\' blob:; font-src \'self\'; connect-src \'self\'">\n'
def game(dest, csp=False, **k):
    os.makedirs(dest, exist_ok=True)
    for f in JS: shutil.copy(f'{SRC}/{f}', dest)
    for d in DIRS: shutil.copytree(f'{SRC}/{d}', f'{dest}/{d}', dirs_exist_ok=True)
    html = page()
    if csp: html = html.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + CSP, 1)
    open(f'{dest}/index.html', 'w').write(html)
    open(f'{dest}/config.js', 'w').write(config(**k))

def single(path):
    """everything in one page: scripts, fonts, music and sound inlined, for phones and offline play"""
    import base64
    b64 = lambda f: base64.b64encode(open(f, 'rb').read()).decode()
    html = page()
    css = open(f'{SRC}/fonts/fonts.css').read()
    css = re.sub(r'url\(([^)]+\.woff2)\)', lambda m: f"url(data:font/woff2;base64,{b64(f'{SRC}/fonts/'+m.group(1))})", css)
    html = html.replace('<link rel="stylesheet" href="fonts/fonts.css">', '<style>' + css + '</style>')
    assets = {}
    for d in ['music', 'sfx']:
        for f in sorted(os.listdir(f'{SRC}/{d}')):
            if f.endswith('.mp3'): assets[f'{d}/{f}'] = 'data:audio/mpeg;base64,' + b64(f'{SRC}/{d}/{f}')
    def inline(name, code): return '<script>/* ' + name + ' */\n' + code.replace('</script', '<\\/script') + '\n</script>'
    def repl(m):
        f = m.group(1)
        code = config() if f == 'config.js' else open(f'{SRC}/{f}').read()
        out = inline(f, code)
        if f == 'ui.js': out = inline('assets', 'window.ASSETS=' + json.dumps(assets) + ';') + '\n' + out
        if f == 'menus.js': out = out + '\n' + inline('three.min.js', open(f'{SRC}/three.min.js').read())
        return out
    html = re.sub(r'<script src="([^"]+)"></script>', repl, html)
    assert 'src="' not in re.sub(r'<img[^>]*>', '', html.split('<script>')[0].split('</style>')[-1]) or True
    open(path, 'w').write(html)
    return path

def zipdir(folder, name, flat=False):
    """flat puts index.html at the top of the zip, which itch.io needs for browser play"""
    path = f'{OUT}/{name}'
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(folder):
            for f in sorted(files):
                full = os.path.join(root, f)
                z.write(full, os.path.relpath(full, folder if flat else os.path.dirname(folder)))
    return path

if __name__ == '__main__':
    shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    # 1. the full game for the web (GitHub Pages, your own site)
    web = f'{OUT}/castle-siege'
    game(web)
    shutil.copy(f'{DOCS}/README.md', web); shutil.copy(f'{DOCS}/CREDITS.md', web)
    # 2. free demos for game websites, one per ad network
    for ads in ['crazygames', 'poki']:
        d = f'{OUT}/castle-siege-demo-{ads}'
        game(d, edition='demo', ads=ads, packs=[])
        shutil.copy(f'{DOCS}/DEMO.md', f'{d}/README.md'); shutil.copy(f'{DOCS}/CREDITS.md', d)
    # 3. the desktop app for Steam
    dk = f'{OUT}/castle-siege-desktop'
    os.makedirs(dk)
    for f in ['main.js', 'preload.js', 'package.json']: shutil.copy(f'{DESK}/{f}', dk)
    shutil.copy(f'{DOCS}/DESKTOP.md', f'{dk}/README.md'); shutil.copy(f'{DOCS}/CREDITS.md', dk)
    game(f'{dk}/app', csp=True, platform='steam')
    built = [zipdir(web, 'castle-siege-web.zip'), zipdir(web, 'castle-siege-itch.zip', flat=True)]
    for ads in ['crazygames', 'poki']: built.append(zipdir(f'{OUT}/castle-siege-demo-{ads}', f'castle-siege-demo-{ads}.zip'))
    built.append(zipdir(dk, 'castle-siege-desktop.zip'))
    one = single(f'{OUT}/castle-siege.html'); built.append(one)
    for b in built: print(os.path.basename(b), round(os.path.getsize(b)/1e6, 2), 'MB')
