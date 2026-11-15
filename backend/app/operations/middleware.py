"""Bounded requests, origin checks and private structured request logs."""
import json
import asyncio
import logging
import time
from collections import OrderedDict, deque
from http.cookies import SimpleCookie
from threading import Lock
from uuid import uuid4

from app.operations.auth import COOKIE

READ_POSTS = {"/api/retrieve", "/api/hybrid/retrieve", "/api/explanations", "/api/graph/path", "/api/aco/search", "/api/fuzzy/evaluate", "/api/hospital/query", "/api/hospital/assessment/evaluate", "/api/hospital/assessment/news2"}


class RequestGuard:
    def __init__(self, app, auth, origins, max_bytes=10 * 1024 * 1024 + 65536, per_minute=120):
        self.app, self.auth, self.origins = app, auth, set(origins)
        self.max_bytes, self.per_minute = max_bytes, per_minute
        self.rate, self.lock = OrderedDict(), Lock()

    def limited(self, identity, limit):
        now = time.monotonic()
        with self.lock:
            self.rate.setdefault(identity, deque())
            queue = self.rate[identity]
            while queue and queue[0] <= now - 60: queue.popleft()
            self.rate.move_to_end(identity)
            while len(self.rate) > 2048: self.rate.popitem(last=False)
            if len(queue) >= limit: return True
            queue.append(now)
        return False

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http": return await self.app(scope, receive, send)
        headers = {key.decode().lower(): value.decode() for key, value in scope["headers"]}
        path, method = scope["path"], scope["method"]
        request_id, started = uuid4().hex, time.perf_counter()
        async def reject(status, code, message):
            body = json.dumps({"code": code, "message": message, "details": {}, "request_id": request_id}).encode()
            response_headers = [(b"content-type", b"application/json"), (b"x-request-id", request_id.encode()), (b"cache-control", b"no-store")]
            if status == 429: response_headers.append((b"retry-after", b"60"))
            await send({"type": "http.response.start", "status": status, "headers": response_headers})
            await send({"type": "http.response.body", "body": body})
        if method == "OPTIONS": return await self.app(scope, receive, send)
        public = path in {"/health", "/ready", "/api/auth/session"}
        authorization = headers.get("authorization", "")
        actor = self.auth.authenticate_key(authorization[7:]) if authorization.startswith("Bearer ") else None
        cookie = SimpleCookie()
        try: cookie.load(headers.get("cookie", ""))
        except Exception: pass
        if actor is None and COOKIE in cookie: actor = self.auth.session(cookie[COOKIE].value)
        peer = (scope.get("client") or ("unknown",))[0]
        if self.limited((peer, "login" if path == "/api/auth/session" and method == "POST" else (actor or {}).get("user", "local")), 5 if path == "/api/auth/session" and method == "POST" else self.per_minute):
            return await reject(429, "rate_limited", "Request limit reached. Try again in one minute.")
        if self.auth.users and not public and actor is None: return await reject(401, "unauthenticated", "Sign in to access this workspace.")
        workspace, resource = "course", path
        if path.startswith("/workspaces/"):
            parts = path.split("/")
            workspace, resource = parts[2], "/" + "/".join(parts[3:])
        if actor and workspace not in actor["workspaces"] and not public and path != "/api/workspaces":
            return await reject(403, "workspace_forbidden", "This account cannot access that workspace.")
        if actor and actor["role"] == "reader" and method not in {"GET", "HEAD"} and resource not in READ_POSTS and path != "/api/auth/session":
            return await reject(403, "read_only", "This account has read-only workspace access.")
        if self.auth.users and method not in {"GET", "HEAD"} and not authorization.startswith("Bearer ") and path != "/api/auth/session":
            if headers.get("origin") not in self.origins: return await reject(403, "origin_forbidden", "Session writes require an allowed application origin.")
        scope.setdefault("state", {})["actor"] = actor
        scope["state"]["request_id"] = request_id
        if method in {"POST", "PUT", "PATCH"}:
            try: declared = int(headers.get("content-length", "0"))
            except ValueError: return await reject(400, "invalid_length", "Invalid content length.")
            if declared < 0 or declared > self.max_bytes: return await reject(413, "request_limit", "Request body exceeds the upload limit.")
            chunks, total = [], 0
            body_started = time.monotonic()
            while True:
                try:
                    message = await asyncio.wait_for(receive(), timeout=max(.001, 30 - (time.monotonic() - body_started)))
                except TimeoutError:
                    return await reject(408, "request_timeout", "Upload did not finish within 30 seconds.")
                if message["type"] == "http.disconnect": return
                chunk = message.get("body", b""); total += len(chunk)
                if total > self.max_bytes: return await reject(413, "request_limit", "Request body exceeds the upload limit.")
                chunks.append(chunk)
                if not message.get("more_body"): break
            messages = deque([{"type": "http.request", "body": b"".join(chunks), "more_body": False}])
            original_receive = receive
            async def replay():
                return messages.popleft() if messages else await original_receive()
            receive = replay
        status = 500
        async def traced(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = [*message.get("headers", []), (b"x-request-id", request_id.encode()), (b"x-content-type-options", b"nosniff"), (b"cache-control", b"no-store")]
            await send(message)
        try: await self.app(scope, receive, traced)
        finally:
            logging.getLogger("softgraph.requests").info(json.dumps({"request_id": request_id, "method": method, "status": status,
                "workspace": workspace, "duration_ms": round((time.perf_counter() - started) * 1000, 2)}))
