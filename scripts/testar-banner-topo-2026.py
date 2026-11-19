#!/usr/bin/env python3
"""Real generated HTML checks after applying frozen release patches.

No photographs or R2 are involved. This is a source-level regression,
not a browser screenshot. No server or database credentials required.
"""
from pathlib import Path
from html.parser import HTMLParser

class Capture(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements=[]
        self.stack=[]
        self.links=[]
        self.images=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        self.elements.append((tag,d))
        if tag=='a':self.links.append(d)
        if tag=='img':self.images.append(d)

for store,slug,expected,categories in [
    ("mb-dryfit","dryfit","MODA ESPORTIVA MASCULINA",("Camisas","Bermudas","Conjuntos")),
    ("mb-for-her","forher","MODA FITNESS FEMININA",("Tops","Leggings","Conjuntos"))
]:
    root=Path("stores")/store/"worker"
    content=(root/"storefront.html").read_text(encoding="utf-8")
    parser=Capture()
    parser.feed(content)
    sections=[attrs for tag,attrs in parser.elements if tag=="section" and attrs.get("class")=="mbh"]
    assert len(sections)==1 and sections[0]["data-store"]==slug,store+" hero not replaced"
    assert expected in content
    for name in categories:
        assert any(x.get("data-category")==name for x in parser.links),store+" missing category "+name
    assert not any(x.get("class")=="mbh-person" for x in parser.images),store+" includes unwanted person image"
    assert "mbh-art-word" in content,store+" missing purely CSS/HTML visual"
    assert "hero-dryfit.webp" not in content and "hero-forher.webp" not in content
    assert not any(tag=="video" and ("mbw" in str(a) or "hero" in str(a)) for tag,a in parser.elements)
    for discarded in ['class="mbw-hero"','class="mbw-art"','class="mbw-sweep"','class="mbw-fabric"',
                      'class="mbw-media"','class="mbw-dots"']:
        assert discarded not in content,store+" outdated hero remains: "+discarded
    assert "mbh-band" in content and "mbh-wash" in content and "html[data-theme=dark] .mbh" in content
    assert 'data-contact-vendors' in content and 'data-my-orders' in content and 'data-open-cart' in content
    assert "Poppins:ital,wght" in content
    assert "mbh_slide_" not in content and "mbh-dots" not in content
    owner=(root/"appearance-editor.js").read_text(encoding="utf-8")
    validator=(root/"appearance.js").read_text(encoding="utf-8")
    assert "mbh_kicker" in owner and "mbh_title_accent" in owner and "mbh_cat_1" in owner
    assert "mbh_kicker" in validator and "mbh_cat_3" in validator
    print(store+": semantic HTML hero without photos, responsive CSS and owner text/category controls OK")
