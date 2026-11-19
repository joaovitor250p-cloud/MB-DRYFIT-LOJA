#!/usr/bin/env python3
"""Keep cancelled online orders visible to customers and the responsible staff.
Run after followup and cancellation scripts, on both frozen storefronts.
All read endpoints remain scoped to the authenticated viewer or staff role.
"""
from pathlib import Path

def one(text,before,after,label):
    n=text.count(before)
    if n!=1:raise RuntimeError(f"{label}: expected one anchor, found {n}")
    return text.replace(before,after,1)

for shop in ("mb-dryfit","mb-for-her"):
    root=Path("stores")/shop/"worker"

    history=root/"order-history.js"
    s=history.read_text(encoding="utf-8")
    s=one(s,
        "status:order.sale_batch_id?'done':'received',cancelled:order.status==='cancelled'",
        "status:order.status==='cancelled'?'cancelled':order.sale_batch_id?'done':'received',cancelled:order.status==='cancelled'",
        shop+" buyer status")
    s=one(s,
        "!['all','received','done'].includes(state)",
        "!['all','received','done','cancelled'].includes(state)",
        shop+" buyer filter")
    s=one(s,
        "state==='received'?' AND NOT EXISTS(SELECT 1 FROM shop_order_sales z WHERE z.order_id=o.id)':'';",
        "state==='received'?\" AND o.status!='cancelled' AND NOT EXISTS(SELECT 1 FROM shop_order_sales z WHERE z.order_id=o.id)\":state==='cancelled'?\" AND o.status='cancelled'\":'';",
        shop+" buyer query")
    history.write_text(s,encoding="utf-8")

    private=root/"storefront-orders.js"
    s=private.read_text(encoding="utf-8")
    s=one(s,
        '<button class="order-filter" data-customer-order-state="done">Feitos</button>',
        '<button class="order-filter" data-customer-order-state="done">Feitos</button><button class="order-filter" data-customer-order-state="cancelled">Cancelados</button>',
        shop+" buyer cancelled chip")
    s=one(s,
        "(state==='done'?'feitos':'recebidos')",
        "(state==='done'?'feitos':state==='cancelled'?'cancelados':'recebidos')",
        shop+" buyer cancelled section title")
    s=one(s,
        "section('received')+section('done')",
        "section('received')+section('done')+section('cancelled')",
        shop+" buyer cancelled card list")
    s=one(s,
        "(o.status==='done'?'FEITO':'RECEBIDO')",
        "(o.status==='cancelled'?'CANCELADO':o.status==='done'?'FEITO':'RECEBIDO')",
        shop+" buyer cancelled details")
    private.write_text(s,encoding="utf-8")

    api=root/"retail-operations.js"
    s=api.read_text(encoding="utf-8")
    s=one(s,
        "!['all','received','done'].includes(state)",
        "!['all','received','done','cancelled'].includes(state)",
        shop+" staff allowed status")
    marker="if(state==='received')clauses.push(\"o.status!='cancelled' AND NOT EXISTS(SELECT 1 FROM shop_order_sales z WHERE z.order_id=o.id)\");"
    s=one(s,marker,marker+"if(state==='cancelled')clauses.push(\"o.status='cancelled'\");",shop+" staff cancelled search")
    api.write_text(s,encoding="utf-8")

    staff=root/"staff-workspace.js"
    s=staff.read_text(encoding="utf-8")
    begin=s.index("async function renderOnlineOrders(offset=0){")
    end=s.index("\nasync function ",begin+10) if "\nasync function " in s[begin+10:] else len(s)
    # Do not edit unrelated staff functions.
    section=s[begin:end]
    tab=section.find('data-order-tab="done"')
    if tab<0:raise RuntimeError(shop+" staff completed orders tab not found")
    after=section.find('</button>',tab)
    if after<0:raise RuntimeError(shop+" staff completed tab closing tag not found")
    after+=len('</button>')
    extra="""<button data-order-tab="cancelled" class="'+(onlineOrderState==='cancelled'?'primary':'secondary')+'">Cancelados</button>"""
    section=section[:after]+extra+section[after:]
    section=one(section,
        "'Pesquisa em recebidos e feitos'",
        "'Pesquisa em todos os pedidos'",
        shop+" staff search label")
    s=s[:begin]+section+s[end:]
    staff.write_text(s,encoding="utf-8")
    print(shop+": cancelled history visible in private customer and staff panels")
