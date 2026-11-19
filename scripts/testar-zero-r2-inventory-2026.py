#!/usr/bin/env python3
"""R2 photo purge preview: only exact backed-up model photos may qualify."""
import importlib.util
from pathlib import Path

source=Path("catalogos-atuais/scripts/mb-zero-r2-inventory-2026.py")
if not source.is_file():
    source=Path("scripts/mb-zero-r2-inventory-2026.py")
spec=importlib.util.spec_from_file_location("mb_r2",source)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

for store in ("dryfit","her"):
    db={"store":store,"r2":{"possible_deletion_candidates":["photos/product-old-abc"]}}
    manifest={"store":store,"created_at":"2026-11-19T00:00:00Z","objects":[
        {"key":"photos/product-old-abc","size":100,"sha256":"a"*64},
        {"key":"branding/store-banner","size":200,"sha256":"b"*64},
        {"key":"photos/customer-portrait","size":300,"sha256":"c"*64}
    ]}
    r=module.compare(db,manifest)
    assert r["product_photo_candidates_in_backup"]==1,r
    assert r["r2_objects_preserved"]==2,r
    assert r["purge_ready"] is False
    assert r["objects_to_remove_only_after_new_approval"]==["photos/product-old-abc"]
    try:
        module.compare({"store":"her" if store=="dryfit" else "dryfit","r2":db["r2"]},manifest)
        raise AssertionError("Cross-store backup accepted")
    except ValueError:
        pass
    try:
        module.compare(db,{**manifest,"objects":manifest["objects"]*2})
        raise AssertionError("Duplicated R2 backup keys accepted")
    except ValueError:
        pass
    print(store+": verified manifest-only candidates, banner/customer media protected")
