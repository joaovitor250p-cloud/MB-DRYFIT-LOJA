#!/usr/bin/env python3
"""Post-patch static and syntax checks for the exact release Worker sources."""
from pathlib import Path
import re
import subprocess
import tempfile

for store in ("mb-dryfit","mb-for-her"):
    folder=Path("stores")/store/"worker"
    s=(folder/"page.html").read_text(encoding="utf-8")
    assert s.count("/* mb redesign release 2026-11-20 */")==1,store+": duplicated patch"
    for feature in ["function mbShell()","mbGroups=()=>","function mbRSave(","#mbTopActions","mb-size-pill","mb-restock-page"]:
        assert feature in s,(store,feature)
    assert s.count('id="mbNavPending"')==1,(store,"menu badge must have single id")
    assert "if(!owner()&&!mbAllowedSeller.has(page))" in s
    assert "if(page==='appearance'||page==='lojaOnline')" in s
    js=(folder/"owner-commerce.js").read_text(encoding="utf-8")
    assert "link.querySelectorAll('.mb-order-count').forEach(el=>el.remove())" in js
    assert "const chip=document.getElementById('mbNavPending')" in js
    api=(folder/"api.js").read_text(encoding="utf-8")
    assert api.count("if(u.pathname==='/api/model-sizes')")==1
    assert "if(u.pathname==='/api/stock-receipts'){\nif(!staff)" in api
    assert "LEFT JOIN members m ON m.id=r.owner_id" in api
    assert "if(u.pathname==='/api/products'&&req.method==='POST'){if(!staff)" in api
    assert "if(m){if(!owner)return json({error:'Acesso restrito ao dono.'}" in api
    assert "env.DB.batch(statements)" in api
    for file in ["api.js","owner-commerce.js","retail-operations.js"]:
        result=subprocess.run(["node","--check",str(folder/file)],text=True,capture_output=True)
        if result.returncode:
            raise RuntimeError(store+" "+file+": "+result.stderr)
    scripts=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S|re.I)
    with tempfile.TemporaryDirectory() as tmp:
        for index,code in enumerate(scripts):
            if not code.strip():continue
            file=Path(tmp)/("panel-"+str(index)+".js")
            file.write_text(code,encoding="utf-8")
            result=subprocess.run(["node","--check",str(file)],text=True,capture_output=True)
            if result.returncode:
                raise RuntimeError(store+" inline script "+str(index)+": "+result.stderr)
    print(store+": PATCH 1x; badge 1x; owner/seller routes; D1 batch; JavaScript syntax OK")
