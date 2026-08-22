"""Small local converter for media you are authorized to download.

Run with: uv run downloader-server.py
Dependency: yt-dlp (managed by uv)
FFmpeg must also be installed and available on PATH.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))


def get_download_dir():
    if sys.platform == "win32":
        base_dir = os.environ.get("LOCALAPPDATA", tempfile.gettempdir())
    elif sys.platform == "darwin":
        base_dir = os.path.expanduser("~/Library/Application Support")
    else:
        base_dir = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
    return os.path.join(base_dir, "yt-music-downloads")


DOWNLOAD_DIR = os.environ.get("DOWNLOAD_DIR", get_download_dir())


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", "2")
        self.headers_common()
        self.end_headers()
        self.wfile.write(b"OK")

    def do_OPTIONS(self):
        self.send_response(204)
        self.headers_common()
        self.end_headers()

    def do_POST(self):
        if self.path not in ("/download", "/cleanup"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            url = payload["url"]
            print(f"Download request URL: {url!r}", flush=True)
            parsed_url = urllib.parse.urlparse(url)
            video_id = urllib.parse.parse_qs(parsed_url.query).get("v", [None])[0]
            if parsed_url.scheme != "https" or parsed_url.netloc != "music.youtube.com" or parsed_url.path != "/watch" or not re.fullmatch(r"[\w-]+", video_id or ""):
                raise ValueError("Only a YouTube Music watch URL is accepted")
            os.makedirs(DOWNLOAD_DIR, exist_ok=True)
            if self.path == "/cleanup":
                removed = []
                prefix = f"track-{video_id}."
                for filename in os.listdir(DOWNLOAD_DIR):
                    if not filename.startswith(prefix):
                        continue
                    file_path = os.path.join(DOWNLOAD_DIR, filename)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        removed.append(file_path)
                self.send_json(200, {"removed": removed})
                return

            output = os.path.join(DOWNLOAD_DIR, f"track-{video_id}.%(ext)s")
            subprocess.run([
                "yt-dlp", "--no-playlist", "-x", "--audio-format", "mp3",
                "--audio-quality", "0", "-k", "-o", output, url
            ], check=True, timeout=600)
            mp3 = os.path.join(DOWNLOAD_DIR, f"track-{video_id}.mp3")
            with open(mp3, "rb") as file:
                data = file.read()
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(data)))
            self.headers_common()
            self.end_headers()
            self.wfile.write(data)
        except Exception as error:
            print(f"Download failed: {error}")
            self.send_response(400)
            self.headers_common()
            self.end_headers()
            self.wfile.write(str(error).encode("utf-8"))

    def headers_common(self):
        self.send_header("Access-Control-Allow-Origin", "https://music.youtube.com")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.headers_common()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        print(format % args)


if __name__ == "__main__":
    print(f"Listening on http://{HOST}:{PORT}/download")
    server = HTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDownloader server stopped.", flush=True)
    finally:
        server.server_close()
