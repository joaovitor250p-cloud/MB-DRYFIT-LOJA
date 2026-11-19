#!/usr/bin/env python3
"""Expose optional server-assigned short codes without changing UUID identities.
The actual D1 migration is deliberately separate and must run only after a verified backup.
Works with databases still lacking the column: My Orders falls back to UUID shorthand.
"""
from pathlib import Path

def swap(path, before, after):
    source=path.read_text(encoding="utf-8")
    found=source.count(before)
    if found!=1:
        raise RuntimeError(f"{path}: expected one anchor, got {found}: {before[:75]}")
    path.write_text(source.replace(before,after,1),encoding="utf-8")

for shop in ("mb-dryfit","mb-for-her"):
    w=Path("stores")/shop/"worker"
    # This response is authenticated and removes request_key and request_signature.
    # SELECT * remains compatible before and after the short_code migration.
    swap(w/"shop-commerce.js",
         "SELECT id,status,subtotal,discount,total,coupon_code,created_at FROM shop_orders WHERE account_id=?",
         "SELECT * FROM shop_orders WHERE account_id=?")
    swap(w/"storefront-account.js",
         "esc(order.id.slice(0,8).toUpperCase())",
         "esc(order.short_code||order.id.slice(0,8).toUpperCase())")
    # Legacy frozen owner-commerce renders coupons only; online orders render
    # in staff-workspace after the 2026 patches.
    owner_path=w/"owner-commerce.js"
    if "esc(order.id.slice(0,8).toUpperCase())" in owner_path.read_text(encoding="utf-8"):
        swap(owner_path,
             "esc(order.id.slice(0,8).toUpperCase())",
             "esc(order.short_code||order.id.slice(0,8).toUpperCase())")
    swap(w/"storefront-cart.js",
         "quote.id.slice(0,8).toUpperCase()",
         "(quote.short_code||quote.id.slice(0,8).toUpperCase())")
    # Once the server has assigned a public code, every WhatsApp message must
    # use it, including the direct seller link immediately after checkout.
    swap(w/"storefront-cart.js",
         "quote.id.toUpperCase()",
         "(quote.short_code||quote.id).toUpperCase()")
    print(shop+": customer history and WhatsApp prefer short_code, UUID remains internal")
