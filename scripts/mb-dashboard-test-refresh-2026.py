#!/usr/bin/env python3
"""Align dashboard regression tests with the compact, still-actionable navigation."""
from pathlib import Path

for store in ("mb-dryfit","mb-for-her"):
    path=Path("stores")/store/"tests"/"operations-workspace.test.mjs"
    text=path.read_text(encoding="utf-8")
    changes=[
        ("assert.equal(document.querySelectorAll('.operations-shortcuts button').length,8);",
         "assert.equal(document.querySelectorAll('.operations-shortcuts button').length,0);assert.equal(document.querySelectorAll('.operations-quick-pos button').length,2);"),
        ("assert.equal(document.querySelectorAll('.operations-shortcuts button').length,9);",
         "assert.equal(document.querySelectorAll('.operations-shortcuts button').length,0);assert.equal(document.querySelectorAll('.operations-quick-pos button').length,2);")
    ]
    for before,after in changes:
        if text.count(before)!=1:raise RuntimeError(f"{store}: unexpected operations shortcut test fixture")
        text=text.replace(before,after,1)
    path.write_text(text,encoding="utf-8")
    print(store+": tests still verify create/store click handlers, metrics and compact quick-actions")
