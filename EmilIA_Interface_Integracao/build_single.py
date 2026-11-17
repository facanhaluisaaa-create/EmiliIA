# Monta o arquivo único do artefato a partir de apps/web/dist-demo (mesmo formato da versão publicada).
import base64, glob, os, re, sys
web='/home/user/EmiliIA/apps/web'
dist=f'{web}/dist-demo'
out=sys.argv[1]
css=open(glob.glob(f'{dist}/assets/*.css')[0],encoding='utf-8').read()
js=open(glob.glob(f'{dist}/assets/*.js')[0],encoding='utf-8').read()
assert '</script' not in js.lower(), 'js contém </script>'
brand={}
for f in ['logo','logo-light','mark','mark-light']:
    brand[f]='data:image/png;base64,'+base64.b64encode(open(f'{web}/public/brand/{f}.png','rb').read()).decode()
import json
html=f'''<title>emilIA Demonstração</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {{ --bg: #F5F5F0; --fg: #1D2924; color-scheme: light; }}
:root[data-theme="dark"], :root:not([data-theme="light"]) {{ color-scheme: light; }}
html, body {{ background: var(--bg); color: var(--fg); margin: 0; padding: 0; }}
#root {{ min-height: 100vh; }}
{css}
</style>
<div id="root"></div>
<script>window.__EMILIIA_BRAND__ = {json.dumps(brand)};</script>
<script type="module">
{js}
</script>
'''
open(out,'w',encoding='utf-8').write(html)
print(out, os.path.getsize(out))
