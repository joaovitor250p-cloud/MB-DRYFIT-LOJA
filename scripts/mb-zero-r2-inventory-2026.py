#!/usr/bin/env python3
"""READ ONLY: reconcile proposed archived/published product photo purge with
an independently verified offsite R2 backup manifest. Never deletes objects.

For accuracy use the manifest *extracted from a downloaded, authenticated and
successfully restore-tested* preclear .mbbak archive, not a live R2 listing.
"""
import argparse
import json
from pathlib import Path

def compare(plan,manifest):
    if plan.get("store")!=manifest.get("store"):
        raise ValueError("Relatório D1 e backup R2 são de lojas diferentes")
    entries=manifest.get("objects")
    if not isinstance(entries,list) or not entries:
        # 0 objects is possible, but still a valid explicit empty array.
        if entries!=[]:raise ValueError("Manifest não possui inventário completo do R2")
    all_keys={}
    for row in entries:
        key=row.get("key")
        if not isinstance(key,str) or key in all_keys or row.get("size",0)<0:
            raise ValueError("Cópia R2 contém chave inválida ou repetida")
        if not isinstance(row.get("sha256"),str) or len(row["sha256"])!=64:
            raise ValueError("Cópia R2 ainda não possui hash completo de todos os objetos")
        all_keys[key]=row
    candidates=plan.get("r2",{}).get("possible_deletion_candidates",[])
    if not isinstance(candidates,list) or len(set(candidates))!=len(candidates):
        raise ValueError("Plano D1 possui candidatos inválidos")
    # A candidate missing in R2 is harmless only after manual reconciliation.
    eligible=[key for key in candidates if key in all_keys]
    missing=[key for key in candidates if key not in all_keys]
    remain=len(all_keys)-len(eligible)
    return {
        "store":plan["store"],"mode":"INVENTARIO_SOMENTE_SEM_DELETAR",
        "backup_created_at":manifest.get("created_at"),
        "source_r2_objects":len(all_keys),
        "product_photo_candidates_in_backup":len(eligible),
        "product_photo_references_missing_in_r2":missing,
        "r2_objects_preserved":remain,
        "purge_ready":False,
        "objects_to_remove_only_after_new_approval":eligible,
        "note":"Protege banners, fotos de clientes e imagens não vinculadas a produtos. Não executa DELETE."
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--db-preview",type=Path,required=True)
    parser.add_argument("--verified-backup-manifest",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    a=parser.parse_args()
    plan=json.loads(a.db_preview.read_text(encoding="utf-8"))
    manifest=json.loads(a.verified_backup_manifest.read_text(encoding="utf-8"))
    report=compare(plan,manifest)
    a.out.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items()
                      if k not in ("objects_to_remove_only_after_new_approval",
                                   "product_photo_references_missing_in_r2")},
                     ensure_ascii=False))
if __name__=="__main__":main()
