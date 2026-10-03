from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
ASSETS = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.css": "app.css",
    "/app-details.css": "app-details.css",
    "/app.js": "app.js",
}


class PreviewHandler(BaseHTTPRequestHandler):
    server_version = "DaymarkPhonePreview/1.0"

    def send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, value: dict) -> None:
        self.send_bytes(status, "application/json; charset=utf-8", json.dumps(value).encode("utf-8"))

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "preview_mode": True})
            return
        if path == "/api/integrations/status":
            self.send_json(200, {"canvas_configured": False, "gemini_configured": False, "gemini_model": "", "preview_mode": True})
            return
        if path == "/api/canvas/events":
            self.send_json(503, {"detail": "Canvas sync is unavailable in phone preview mode."})
            return
        if path == "/api/study/chat":
            self.send_json(503, {"detail": "Gemini chat is unavailable in phone preview mode. This preview does not send data to your backend."})
            return

        asset = ASSETS.get(path)
        if not asset:
            self.send_json(404, {"detail": "Not found"})
            return
        file_path = ROOT / asset
        body = file_path.read_bytes()
        content_type = mimetypes.guess_type(asset)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {"application/javascript"}:
            content_type += "; charset=utf-8"
        self.send_bytes(200, content_type, body)

    def do_POST(self) -> None:
        self.send_json(403, {"detail": "Phone preview is read-only and cannot store credentials."})

    def log_message(self, format_string: str, *args) -> None:
        print(f"{self.client_address[0]} - {format_string % args}")


if __name__ == "__main__":
    address = ("0.0.0.0", 8765)
    print("Daymark phone preview is listening on port 8765.")
    print("On your phone, open http://<this-computer-wi-fi-ip>:8765 on the same Wi-Fi network.")
    print("This preview serves only frontend files; Canvas and Gemini are disabled.")
    ThreadingHTTPServer(address, PreviewHandler).serve_forever()
