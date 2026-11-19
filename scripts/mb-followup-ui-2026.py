#!/usr/bin/env python3
"""Incremental UI adjustments for both frozen MB workers (no D1/R2 mutation).
Run AFTER all original frozen patches and speed optimizations, BEFORE build.
Never modifies approved colors or media.
"""
from pathlib import Path

def apply(path, operation):
    old = path.read_text(encoding="utf-8")
    new = operation(old)
    if new == old or len(new)<len(old)*0.95:
        raise RuntimeError(f"Patch did not apply safely: {path}")
    path.write_text(new,encoding="utf-8")

def one(s,old,new,label):
    count=s.count(old)
    if count!=1: raise RuntimeError(f"{label}: expected one anchor, got {count}")
    return s.replace(old,new,1)

for shop in ('mb-dryfit','mb-for-her'):
    root=Path('stores')/shop/'worker'
    def history(s):
        return one(s,'return {id:order.id,customer_name:order.customer_name',
                   'return {id:order.id,short_code:order.short_code||null,customer_name:order.customer_name',
                   'private receipt code')
    apply(root/'order-history.js',history)

    def buyer(s):
        # Trusted seller phone already comes from the private, authenticated receipt.
        fn="""function mbDirectSellerWhatsApp(o){
 const phone=String(o.agent_phone||'').replace(/[^0-9]/g,'');
 if(!/^55\\\\d{10,11}$/.test(phone))return '';
 const code=o.short_code||o.id;
 const message='Olá, '+(o.agent_name||'vendedor')+'! Quero falar sobre meu pedido '+code+'.';
 return 'https://wa.me/'+phone+'?text='+encodeURIComponent(message);
}
"""
        s=one(s,'async function refreshMyOrders(){',fn+'async function refreshMyOrders(){','seller direct link function')
        if s.count('esc(o.id.toUpperCase())')!=2:raise RuntimeError('Customer order number views drifted')
        s=s.replace('esc(o.id.toUpperCase())','esc((o.short_code||o.id).toUpperCase())')
        s=one(s,"esc(cartWhatsAppURL(o))","esc(mbDirectSellerWhatsApp(o))",'direct owner seller WhatsApp')
        opening='<div class="customer-order-actions">'
        note="""'+(o.status==='received'&&!o.cancelled?'<p class="mb-order-contact-notice">Para acompanhar este pedido, fale com '+esc(o.agent_name||'o vendedor responsável')+'.</p>':'')+'"""
        s=one(s,opening,note+opening,'contact note visible on order card')
        return s
    apply(root/'storefront-orders.js',buyer)

    def staff(s):
        if s.count('esc(o.id.toUpperCase())')<2:raise RuntimeError('Missing staff order number views')
        s=s.replace('esc(o.id.toUpperCase())','esc((o.short_code||o.id).toUpperCase())')
        # The dashboard keeps its existing server-backed metrics, cash status,
        # last sales and low-stock data; remove duplicates of sidebar shortcuts.
        prefix="+'<div class=\"operations-shortcuts\">'+workspaceShortcuts().map(([id,label,desc])=>"
        p=s.find(prefix)
        if p<0:raise RuntimeError('Operations shortcut block changed')
        q=s.find("+'</div><section id=\"operationsMetrics\"",p)
        if q<0:raise RuntimeError('Operations metrics anchor changed')
        s=s[:p]+"+'<section id=\"operationsMetrics\""+s[q+len("+'</div><section id=\"operationsMetrics\""):]
        # Remove giant duplicated promotional hero; keep compact metrics and lists.
        begin=s.find(" const heading=view.querySelector('.operations-heading');heading.insertAdjacentHTML(")
        end=s.find("\n view.querySelectorAll('[data-workspace-action]')",begin)
        if begin<0 or end<0:raise RuntimeError('Dashboard hero boundaries changed')
        s=s[:begin]+""" if(!isOwner){
  const p=document.createElement('div');
  p.className='operations-quick-pos';
  p.innerHTML='<button class="primary" type="button" data-workspace-action="sell">Abrir PDV ↗</button>';
  view.querySelector('.operations-heading').after(p);
 }
"""+s[end:]
        return s
    apply(root/'staff-workspace.js',staff)

    def pdv(s):
        s=one(s,'id="clearSale">Limpar</button>','id="clearSale">Cancelar venda</button>','PDV cancel label')
        return one(s,'Limpar os itens desta venda ainda não registrada?',
                'Cancelar esta venda em andamento? Os itens serão descartados e nenhuma movimentação será registrada no caixa.',
                'PDV cancel confirmation')
    apply(root/'page.html',pdv)
    print(shop+': seller contact on order card, readable codes, clean operations dashboard, cancel draft PDV')
