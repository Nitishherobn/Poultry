from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import urlparse, urlsplit

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)

from server import assignment_events, fetch_canvas_ics

ASSETS = {
    "/": "index.html",
    "/index.html": "index.html",
    "/app.css": "app.css",
    "/app-details.css": "app-details.css",
    "/app.js": "app.js",
    "/colleges.js": "colleges.js",
    "/colleges.json": "colleges.json",
}


class PreviewHandler(BaseHTTPRequestHandler):
    server_version = "DaymarkPhonePreview/2.0"

    def send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, value: dict) -> None:
        self.send_bytes(status, "application/json; charset=utf-8", json.dumps(value).encode("utf-8"))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "preview_mode": False})
            return
        if path == "/api/integrations/status":
            canvas_url = os.getenv("CANVAS_ICS_URL", "").strip()
            gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
            gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
            self.send_json(200, {
                "canvas_configured": bool(canvas_url),
                "gemini_configured": bool(gemini_key),
                "gemini_model": gemini_model,
                "preview_mode": False
            })
            return
        if path == "/api/canvas/events":
            feed_url = os.getenv("CANVAS_ICS_URL", "").strip()
            if not feed_url:
                self.send_json(503, {"detail": "Canvas is not connected yet. Paste your Canvas feed URL in Connect tools."})
                return
            try:
                content = fetch_canvas_ics(feed_url)
                events = assignment_events(content)
                self.send_json(200, {"count": len(events), "events": events})
            except Exception as error:
                self.send_json(502, {"detail": f"Could not fetch Canvas feed: {error}"})
            return

        asset = ASSETS.get(path)
        if not asset:
            self.send_json(404, {"detail": "Not found"})
            return
        file_path = ROOT / asset
        if not file_path.exists():
            self.send_json(404, {"detail": "Asset file not found"})
            return
        body = file_path.read_bytes()
        content_type = mimetypes.guess_type(asset)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {"application/javascript"}:
            content_type += "; charset=utf-8"
        self.send_bytes(200, content_type, body)

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}

        if path == "/api/integrations/configure":
            if data.get("clear_canvas"):
                os.environ.pop("CANVAS_ICS_URL", None)
            elif data.get("canvas_ics_url"):
                url = data["canvas_ics_url"].strip().replace("webcal://", "https://")
                os.environ["CANVAS_ICS_URL"] = url

            if data.get("clear_gemini"):
                os.environ.pop("GEMINI_API_KEY", None)
            elif data.get("gemini_api_key"):
                os.environ["GEMINI_API_KEY"] = data["gemini_api_key"].strip()

            if data.get("gemini_model"):
                os.environ["GEMINI_MODEL"] = data["gemini_model"].strip()

            self.send_json(200, {
                "canvas_configured": bool(os.getenv("CANVAS_ICS_URL")),
                "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
                "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                "preview_mode": False
            })
            return

        if path in {"/api/canvas/fetch-url", "/api/canvas/import-url"}:
            url = data.get("url", "").strip().replace("webcal://", "https://")
            if not url:
                self.send_json(400, {"detail": "Missing Canvas URL."})
                return
            try:
                content = fetch_canvas_ics(url)
                events = assignment_events(content)
                os.environ["CANVAS_ICS_URL"] = url
                self.send_json(200, {"count": len(events), "events": events})
            except Exception as error:
                self.send_json(502, {"detail": f"Could not fetch Canvas feed: {error}"})
            return

        if path == "/api/study/chat":
            api_key = os.getenv("GEMINI_API_KEY", "").strip()
            if not api_key:
                self.send_json(503, {"detail": "Gemini is not configured. Add your API key in Connect tools."})
                return
            model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
            message = str(data.get("message", "")).strip()
            tasks = data.get("tasks", [])
            task_context = "\n".join(f"- {str(t)[:200]}" for t in tasks[:20]) or "No current tasks provided."
            prompt = (
                "You are Daymark, a kind and concise study tutor. Help the student learn by explaining concepts, "
                "asking useful follow-up questions, and giving hints before complete answers.\n\n"
                f"Current tasks:\n{task_context}\n\nStudent question:\n{message}"
            )
            endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + urllib.parse.quote(model, safe="") + ":generateContent"
            payload = json.dumps({
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 900},
            }).encode("utf-8")
            request = urllib.request.Request(endpoint, data=payload, headers={"Content-Type": "application/json", "x-goog-api-key": api_key}, method="POST")
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    result = json.loads(response.read(1024 * 1024))
                answer = "\n".join(part["text"] for part in result["candidates"][0]["content"]["parts"] if "text" in part).strip()
                self.send_json(200, {"answer": answer, "model": model})
            except Exception as err:
                self.send_json(502, {"detail": f"Gemini error: {err}"})
            return

        self.send_json(404, {"detail": "Endpoint not found"})

    def log_message(self, format_string: str, *args) -> None:
        print(f"{self.client_address[0]} - {format_string % args}")


if __name__ == "__main__":
    address = ("0.0.0.0", 8765)
    print("Daymark phone server listening on port 8765.")
    print("Full Canvas sync and Gemini chat enabled for mobile preview.")
    ThreadingHTTPServer(address, PreviewHandler).serve_forever()
