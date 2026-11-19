"""MB Impressão: ponte local autorizada para impressoras RAW/ZPL do Windows.

Instale somente em computador de confiança. O token de pareamento deve ser
colado exclusivamente nos sites oficiais MB Dryfit e MB For Her.
"""
import json
import os
import secrets
import threading
import tkinter as tk
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tkinter import messagebox, ttk

HOST = "127.0.0.1"
PORT = 17425
ORIGINS = {
    "https://mbdryfit.com.br",
    "https://forher.mbdryfit.com.br",
}
CONFIG_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "MB-Impressao-Elgin"
TOKEN_FILE = CONFIG_DIR / "pareamento.txt"
PAIRED_FILE = CONFIG_DIR / "pareado.flag"


def load_or_create_token():
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.is_file():
        token = TOKEN_FILE.read_text(encoding="ascii").strip()
        if len(token) == 64 and all(c in "0123456789abcdef" for c in token):
            return token
    token = secrets.token_hex(32)
    TOKEN_FILE.write_text(token, encoding="ascii")
    return token


TOKEN = load_or_create_token()
UI = None


def printer_names():
    import win32print
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return sorted(set(p[2] for p in win32print.EnumPrinters(flags)))


def raw_print(printer, zpl):
    import win32print
    if printer not in printer_names():
        raise ValueError("Impressora não encontrada no Windows.")
    data = zpl.encode("ascii")
    handle = win32print.OpenPrinter(printer)
    try:
        win32print.StartDocPrinter(handle, 1, ("MB Dryfit - Etiquetas", None, "RAW"))
        try:
            win32print.StartPagePrinter(handle)
            try:
                offset = 0
                while offset < len(data):
                    written = win32print.WritePrinter(handle, data[offset:])
                    if not written:
                        raise OSError("A fila da impressora não aceitou os dados.")
                    offset += written
            finally:
                win32print.EndPagePrinter(handle)
        finally:
            win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)


class Handler(BaseHTTPRequestHandler):
    server_version = "MB-Impressao/1.0"

    def log_message(self, *_args):
        return

    def allowed(self):
        # Reject DNS-rebinding hosts and untrusted web origins.
        host = self.headers.get("Host", "")
        return (host in {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
                and self.headers.get("Origin", "") in ORIGINS)

    def authorized(self):
        supplied = self.headers.get("X-MB-Token", "")
        return len(supplied) == 64 and secrets.compare_digest(supplied, TOKEN)

    def reply(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Vary", "Origin")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        if not self.allowed():
            self.reply(403, {"error": "Site não autorizado."})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-MB-Token")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        if not self.allowed():
            self.reply(403, {"error": "Site não autorizado."})
        elif self.path == "/health":
            self.reply(200, {"name": "MB-Impressao-Elgin", "ready": True})
        elif self.path == "/paired":
            if not PAIRED_FILE.is_file():
                self.reply(409, {"error": "Pareie neste computador uma vez."})
                return
            self.reply(200, {"token": TOKEN})
        elif self.path == "/printers":
            if not self.authorized():
                self.reply(401, {"error": "Informe o código de pareamento do programa."})
                return
            try:
                printers = printer_names()
                # A successful, authenticated pairing is shared by the two
                # official origins on this SAME Windows computer only.
                PAIRED_FILE.write_text("paired\n", encoding="ascii")
                self.reply(200, {"printers": printers})
            except Exception as exc:
                self.reply(503, {"error": "Falha ao listar impressoras: " + str(exc)[:180]})
        else:
            self.reply(404, {"error": "Rota desconhecida."})

    def do_POST(self):
        if not self.allowed():
            self.reply(403, {"error": "Site não autorizado."})
            return
        if not self.authorized():
            self.reply(401, {"error": "Código de pareamento inválido."})
            return
        if self.path == "/forget":
            # Revokes the previously paired token on both official sites.
            global TOKEN
            TOKEN = secrets.token_hex(32)
            TOKEN_FILE.write_text(TOKEN, encoding="ascii")
            PAIRED_FILE.unlink(missing_ok=True)
            self.reply(200, {"ok": True, "message": "Pareamento removido deste computador."})
            return
        if self.path != "/print":
            self.reply(404, {"error": "Rota desconhecida."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 5_000_000:
                raise ValueError("Lote acima do limite de segurança.")
            obj = json.loads(self.rfile.read(length))
            printer, zpl = obj.get("printer"), obj.get("zpl")
            if not isinstance(printer, str) or not 1 <= len(printer) <= 200:
                raise ValueError("Impressora inválida.")
            if not isinstance(zpl, str) or not zpl.startswith("^XA") or not zpl.strip().endswith("^XZ"):
                raise ValueError("Dados ZPL inválidos.")
            if zpl.count("^XA") < 1 or zpl.count("^XA") > 250 or zpl.count("^XA") != zpl.count("^XZ"):
                raise ValueError("Quantidade de linhas fora do limite.")
            raw_print(printer, zpl)
            self.reply(200, {"ok": True, "message": "Lote enviado à fila da impressora."})
        except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
            self.reply(400, {"error": str(exc)[:200]})
        except Exception as exc:
            self.reply(503, {"error": "Erro ao imprimir: " + str(exc)[:200]})


def main():
    global UI
    UI = tk.Tk()
    UI.title("MB Impressão · Elgin")
    UI.geometry("600x310")
    UI.minsize(520, 280)
    frame = ttk.Frame(UI, padding=22)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="MB IMPRESSÃO", font=("Segoe UI", 21, "bold")).pack(anchor="w")
    ttk.Label(frame, text="Impressão de etiquetas sem QZ Tray. Mantenha esta janela aberta.").pack(anchor="w", pady=(4, 18))
    ttk.Label(frame, text="Código de pareamento (somente para seu computador):").pack(anchor="w")
    field = ttk.Entry(frame, width=70, font=("Consolas", 10))
    field.insert(0, TOKEN)
    field.configure(state="readonly")
    field.pack(fill="x", pady=(5, 8))
    def copy_token():
        UI.clipboard_clear()
        UI.clipboard_append(TOKEN)
        UI.update()
        messagebox.showinfo("MB Impressão", "Código copiado. Cole no campo de pareamento do site.")
    ttk.Button(frame, text="Copiar código", command=copy_token).pack(anchor="w")
    ttk.Label(frame, text="Somente os sites oficiais MB Dryfit e MB For Her podem conectar.", foreground="#496c50").pack(anchor="w", pady=(17, 5))
    status = ttk.Label(frame, text="Conectando ao Windows...")
    status.pack(anchor="w")
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        status.configure(text="A porta local já está em uso. Feche outra instância do MB Impressão.")
        messagebox.showerror("MB Impressão", "Já existe outro programa usando a porta local 17425.")
        UI.mainloop()
        return
    threading.Thread(target=server.serve_forever, daemon=True).start()
    status.configure(text="Pronto. Servidor local ativo em 127.0.0.1:17425.")
    def close():
        server.shutdown()
        server.server_close()
        UI.destroy()
    UI.protocol("WM_DELETE_WINDOW", close)
    UI.mainloop()


if __name__ == "__main__":
    main()
