"""Run the Vinext server and its loopback-only FastAPI backend."""

import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def main():
    origin = os.environ.get("SOFTGRAPH_CORS_ORIGINS") or os.environ.get("RENDER_EXTERNAL_URL", "")
    url = urlsplit(origin)
    if (url.scheme != "https" or not url.hostname or url.username or url.password
            or url.path or url.query or url.fragment or "," in origin
            or any(character.isspace() for character in origin)):
        raise SystemExit("Set SOFTGRAPH_CORS_ORIGINS to the exact public HTTPS origin.")

    backend_port = os.environ.get("SOFTGRAPH_INTERNAL_PORT", "8000")
    frontend_port = os.environ.get("PORT", "10000")
    if backend_port == frontend_port:
        raise SystemExit("The frontend and backend must use different ports.")

    environment = {
        **os.environ,
        "SOFTGRAPH_ENV": "production",
        "SOFTGRAPH_CORS_ORIGINS": origin,
        "SOFTGRAPH_BACKEND_URL": f"http://127.0.0.1:{backend_port}",
    }
    process_specs = (
        ("FastAPI", [sys.executable, "-m", "uvicorn", "app.main:app", "--host",
                     "127.0.0.1", "--port", backend_port, "--workers", "1",
                     "--no-access-log"], ROOT / "backend", environment),
        ("Vinext", ["node", "node_modules/vinext/dist/cli.js", "start",
                    "--hostname", "0.0.0.0", "--port", frontend_port], ROOT,
         {key: value for key, value in environment.items()
          if key not in {"SOFTGRAPH_USERS", "SOFTGRAPH_SESSION_SECRET", "OPENROUTER_API_KEY"}}),
    )
    stopping = False

    def stop(_signal, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    children = []
    try:
        for name, command, directory, env in process_specs:
            children.append((name, subprocess.Popen(command, cwd=directory, env=env)))
        while not stopping:
            for name, child in children:
                code = child.poll()
                if code is not None:
                    print(f"{name} exited unexpectedly (status {code})", file=sys.stderr)
                    return 1
            time.sleep(0.25)
        return 0
    finally:
        for _, child in children:
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + 8
        for _, child in children:
            try:
                child.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == "__main__":
    raise SystemExit(main())
