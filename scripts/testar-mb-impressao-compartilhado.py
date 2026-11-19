#!/usr/bin/env python3
"""Integration test: one local MB Impressao pairing across the two official origins."""
import http.client
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
from http.server import ThreadingHTTPServer
from unittest.mock import patch

with tempfile.TemporaryDirectory() as temp:
    os.environ["LOCALAPPDATA"]=temp
    module_path=Path(__file__).resolve().parents[1]/"printer-bridge"/"mb_impressao.py"
    spec=importlib.util.spec_from_file_location("mb_impressao_test",module_path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    server=ThreadingHTTPServer(("127.0.0.1",0),module.Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    def call(path,origin,token=None,method="GET",host=None):
        conn=http.client.HTTPConnection("127.0.0.1",server.server_port,timeout=4)
        headers={"Origin":origin,"Host":host or "127.0.0.1:17425"}
        if token:headers["X-MB-Token"]=token
        if method=="POST":headers["Content-Type"]="application/json"
        conn.request(method,path,body=b"{}" if method=="POST" else None,headers=headers)
        response=conn.getresponse()
        data=json.loads(response.read().decode())
        status=response.status
        conn.close()
        return status,data
    try:
        dryfit="https://mbdryfit.com.br"
        her="https://forher.mbdryfit.com.br"
        stranger="https://site-desconhecido.example"
        assert call("/paired",dryfit)[0]==409
        assert call("/paired",stranger)[0]==403
        assert call("/paired",dryfit,host="evil.example:17425")[0]==403
        assert call("/printers",dryfit,token="0"*64)[0]==401
        with patch.object(module,"printer_names",return_value=["ELGIN L42PRO FULL"]):
            status,p=call("/printers",dryfit,token=module.TOKEN)
            assert status==200 and p["printers"]==["ELGIN L42PRO FULL"]
        status,p=call("/paired",her)
        assert status==200 and p["token"]==module.TOKEN
        assert call("/paired",stranger)[0]==403
        old=module.TOKEN
        assert call("/forget",her,token=old,method="POST")[0]==200
        assert call("/paired",dryfit)[0]==409
        assert call("/printers",dryfit,token=old)[0]==401
        assert module.TOKEN!=old
        assert module.TOKEN_FILE.is_file()
        assert not module.PAIRED_FILE.exists()
        print("MB Impressao: shared origins, legacy-token check, revocation and host guard OK")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
