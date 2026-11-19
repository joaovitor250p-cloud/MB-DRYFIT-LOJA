#!/usr/bin/env python3
"""Idempotent MB v3 shell patch; run after all legacy UI/alert patches."""
from pathlib import Path
SOURCE=Path("catalogos-atuais/scripts") if Path("catalogos-atuais/scripts").is_dir() else Path("scripts")
js=(SOURCE/"mb-v3-shell.js").read_text(encoding="utf-8")
css=(SOURCE/"mb-v3-shell.css").read_text(encoding="utf-8")
marker="/* MB_V3_SHELL_INSTALLED */"

for store in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/store/"worker"
    page=root/"page.html"
    text=page.read_text(encoding="utf-8")
    if marker in text:
        print(store+": v3 shell already installed; skipping")
        continue
    anchor="function render(){"
    if text.count(anchor)!=1:
        raise RuntimeError(store+": render anchor changed; aborting")
    text=text.replace(anchor,marker+"\n"+js+"\n"+anchor+
        "if(page==='appearance')page=owner()?'overview':'sell';"
        "if(page==='mbPrinterOnly'&&staff()){nav();mbV3PrinterSettings();return}",1)
    css_anchor="</style>"
    if text.count(css_anchor)!=1:raise RuntimeError(store+": CSS closing tag changed")
    text=text.replace(css_anchor,"\n"+css+"\n"+css_anchor,1)
    # The customer storefront and its already-published banner stay untouched.
    # Only the administrative editor is removed from the bundled staff UI.
    appearance="/*__APPEARANCE_EDITOR__*/"
    if text.count(appearance)!=1:raise RuntimeError(store+": appearance editor injection changed")
    text=text.replace(appearance,"/* Banner editor removed from staff panel; public banner retained. */",1)
    page.write_text(text,encoding="utf-8")
    print(store+": compact responsive shell and appearance-editor removal installed")
