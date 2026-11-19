#!/usr/bin/env python3
"""PREPARE ONLY an all-history reset for either MB store from a restored D1 copy.

NEVER connects to Cloudflare, never edits the supplied database and never
removes R2 objects. Requires a complete, independently verified offsite
preclear backup and an owner-approved inventory BEFORE any SQL is run remotely.
The SQL is a candidate for isolated testing, NOT a deploy/migration script.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3

# Explicit child-before-parent order respects all FK and audit triggers.
DELETE_ORDER = (
    "shop_order_access", "shop_order_recovery", "order_status_events",
    "shop_order_sales", "order_short_numbers", "shop_order_items",
    "coupon_redemptions", "shop_orders", "shop_order_viewers",
    "sale_return_items", "sale_returns", "sales", "sale_batches",
    "cash_expenses", "cash_movements", "cash_sessions",
    "stock_receipt_lines", "stock_receipts",
    "nex_import_assets", "nex_import_items", "nex_import_batches", "nex_import_runs",
    "product_model_regroup_audit", "product_model_regroup_jobs",
    "normalized_variant_claims", "product_barcodes",
    "product_model_gallery_photo_index", "product_model_gallery",
    "model_change_events", "catalog_reset_events", "catalog_notifications",
    "customer_favorites", "sales_goals", "store_monthly_goals",
    "products",
)
PRESERVE = frozenset((
    "members", "invitations", "sales_agents", "sales_directory_bootstrap",
    "customer_accounts", "customer_sessions", "customer_challenges",
    "auth_throttles", "firebase_pending_profiles",
    "vendor_access", "vendor_access_bootstrap",
    "store_owner_access", "owner_access_sessions",
    "owner_access_setup_versions", "owner_password_resets",
    "staff_access_sessions", "staff_handoff_nonces",
    "inventory_preferences", "storefront_settings", "storefront_versions",
    "shop_coupons", "d1_migrations",
))
REQUIRED = frozenset(("products", "sales", "sale_batches", "shop_orders",
                      "shop_order_items", "cash_sessions", "customer_accounts",
                      "members", "sales_agents", "storefront_settings", "shop_coupons"))
IMAGE_RE = re.compile(r"(?:^|/)(?:api/)?photos/([a-zA-Z0-9-]{10,80})(?:$|[?#])")

def qname(name):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*",name):
        raise ValueError("Identificador SQL inválido")
    return '"' + name + '"'

def available_tables(con):
    return {x[0] for x in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%'"
    ) if not x[0].startswith("_cf_")}

def count(con, name):
    return con.execute("SELECT COUNT(*) FROM "+qname(name)).fetchone()[0]

def product_photos(con, tables):
    photos=set()
    if "products" in tables:
        for photo,main in con.execute("SELECT photo,main_photo FROM products"):
            for source in (photo,main):
                m=IMAGE_RE.search(str(source or ""))
                if m:photos.add("photos/"+m.group(1))
    if "product_model_gallery_photo_index" in tables:
        for (source,) in con.execute("SELECT photo FROM product_model_gallery_photo_index"):
            m=IMAGE_RE.search(str(source or ""))
            if m:photos.add("photos/"+m.group(1))
    # Do not infer removability for unreferenced R2 objects, customer images,
    # branded assets, banners, or temporary file names.
    protected=""
    for table in ("storefront_settings","storefront_versions","customer_accounts"):
        if table in tables:
            for row in con.execute("SELECT * FROM "+qname(table)):
                protected += " ".join(str(x or "") for x in row)+"\n"
    candidates=[p for p in sorted(photos) if p.split("/")[-1] not in protected]
    return {"linked_product_photo_keys":len(photos),
            "possible_deletion_candidates":candidates,
            "protected_referenced_or_ambiguous":len(photos)-len(candidates),
            "warning":"Candidates are not an authorization or instruction to delete R2."}

def plan(source, store):
    # Read-only SQLite connection, including against a local restored backup.
    con=sqlite3.connect("file:"+str(source.resolve())+"?mode=ro&immutable=1",uri=True)
    try:
        if con.execute("PRAGMA integrity_check").fetchone()[0]!="ok":
            raise RuntimeError("O banco de teste não passou na verificação de integridade")
        tables=available_tables(con)
        missing=sorted(REQUIRED-tables)
        if missing:raise RuntimeError("Esquema incompleto: "+", ".join(missing))
        unknown=sorted(tables-set(DELETE_ORDER)-PRESERVE)
        if unknown:raise RuntimeError("Novas tabelas sem classificação: "+", ".join(unknown))
        clears=[x for x in DELETE_ORDER if x in tables]
        counts={t:count(con,t) for t in sorted(tables)}
        # Fail closed if a preserved table has FK references to deleted rows.
        for table in sorted(PRESERVE & tables):
            for fk in con.execute("PRAGMA foreign_key_list("+qname(table)+")"):
                if fk[2] in clears and count(con,table):
                    raise RuntimeError("Tabela preservada depende dos dados a excluir: "+table)
        cols={x[1] for x in con.execute("PRAGMA table_info(products)")}
        models=con.execute(
            "SELECT COUNT(DISTINCT COALESCE(NULLIF(model_id,''),lower(name))) FROM products"
        ).fetchone()[0] if "model_id" in cols else count(con,"products")
        by_status={}
        if {"archived_at","published"} <= cols:
            archived,published=con.execute(
                "SELECT SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END),"
                "SUM(CASE WHEN published=1 THEN 1 ELSE 0 END) FROM products"
            ).fetchone()
            by_status={"archived_variants":archived or 0,
                       "published_variants":published or 0}
        media=product_photos(con,tables)
        report={
            "store":store,"source":"local restored D1 copy (read-only)",
            "live_cleanup_performed":False,"r2_deletions_performed":False,
            "cleared_tables":{t:counts[t] for t in clears},
            "preserved_tables":{t:counts[t] for t in sorted(PRESERVE & tables)},
            "models":models,"total_variants":counts["products"],
            "all_archived_and_published_included":True,
            **by_status,"r2":media,
        }
        # Every count is rechecked inside the future single transaction.
        sql=["-- PROPOSTA SOMENTE. NAO EXECUTAR SEM BACKUP VERIFICADO E RELATORIO APROVADO.",
             "-- Exclui arquivados E publicados. Preserva equipe, clientes e configuracoes.",
             "PRAGMA foreign_keys=ON;","BEGIN IMMEDIATE;"]
        for table in sorted(tables & (set(clears)|PRESERVE)):
            sql.append("SELECT json_extract('MB_RESET_STALE_PLAN_ABORT','$') "
                       "WHERE (SELECT COUNT(*) FROM "+qname(table)+") != "+str(counts[table])+";")
        for table in clears:
            sql.append("DELETE FROM "+qname(table)+";")
        # Configured coupon definitions persist, usage counters reflect empty history.
        sql.append('UPDATE "shop_coupons" SET used_count=0;')
        # Keep colors, logos, banners, catalog options and visibility toggles,
        # but clear variation-specific discounts targeting deleted product IDs.
        sql.append(
            'UPDATE "storefront_settings" SET '
            'draft=json_set(draft,\'$.variants\',json(\'{}\')),'
            'published=json_set(published,\'$.variants\',json(\'{}\')) '
            "WHERE id='mb_variant_promotions_2026' "
            "AND json_valid(draft) AND json_valid(published);"
        )
        if "order_short_numbers" in tables and con.execute(
            "SELECT name FROM sqlite_master WHERE name='sqlite_sequence'"
        ).fetchone():
            sql.append("DELETE FROM sqlite_sequence WHERE name='order_short_numbers';")
        for table in clears:
            sql.append("SELECT json_extract('MB_RESET_FAILED_NONEMPTY','$') "
                       "WHERE (SELECT COUNT(*) FROM "+qname(table)+") != 0;")
        sql.extend([
            "SELECT json_extract('MB_RESET_FK_ABORT','
        report["plan_sha256"]=hashlib.sha256(
            "\n".join(sql).encode("utf-8")).hexdigest()
        return report,"\n".join(sql)+"\n"
    finally:
        con.close()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--database",required=True,type=Path,
                        help="Restored D1 SQLite copy; NEVER production or online URL")
    parser.add_argument("--store",choices=("dryfit","her"),required=True)
    parser.add_argument("--output-dir",required=True,type=Path)
    args=parser.parse_args()
    if not args.database.is_file():
        parser.error("Local restored SQLite file required")
    args.output_dir.mkdir(parents=True,exist_ok=True)
    report,sql=plan(args.database,args.store)
    (args.output_dir/(args.store+"-reset-preview.json")).write_text(
        json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
    (args.output_dir/(args.store+"-reset-DRAFT-DO-NOT-RUN.sql")).write_text(
        sql,encoding="utf-8")
    print(json.dumps({"store":args.store,"models":report["models"],
                      "variants":report["total_variants"],
                      "photo_candidates":len(report["r2"]["possible_deletion_candidates"]),
                      "preview_only":True},ensure_ascii=False))
if __name__=="__main__":
    main()
) WHERE EXISTS (SELECT 1 FROM pragma_foreign_key_check);",
            "COMMIT;"
        ])
        report["plan_sha256"]=hashlib.sha256(
            "\n".join(sql).encode("utf-8")).hexdigest()
        return report,"\n".join(sql)+"\n"
    finally:
        con.close()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--database",required=True,type=Path,
                        help="Restored D1 SQLite copy; NEVER production or online URL")
    parser.add_argument("--store",choices=("dryfit","her"),required=True)
    parser.add_argument("--output-dir",required=True,type=Path)
    args=parser.parse_args()
    if not args.database.is_file():
        parser.error("Local restored SQLite file required")
    args.output_dir.mkdir(parents=True,exist_ok=True)
    report,sql=plan(args.database,args.store)
    (args.output_dir/(args.store+"-reset-preview.json")).write_text(
        json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
    (args.output_dir/(args.store+"-reset-DRAFT-DO-NOT-RUN.sql")).write_text(
        sql,encoding="utf-8")
    print(json.dumps({"store":args.store,"models":report["models"],
                      "variants":report["total_variants"],
                      "photo_candidates":len(report["r2"]["possible_deletion_candidates"]),
                      "preview_only":True},ensure_ascii=False))
if __name__=="__main__":
    main()
