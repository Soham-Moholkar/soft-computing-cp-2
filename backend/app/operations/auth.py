"""Server-side workspace memberships and revocable signed sessions."""
import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

from app.workspaces import PROFILES

WORKSPACE_IDS = set(PROFILES)
COOKIE = "softgraph_session"


@dataclass(frozen=True)
class AuthSettings:
    users: dict
    secret: str = ""
    production: bool = False
    session_seconds: int = 28800

    @classmethod
    def from_environment(cls):
        return cls(json.loads(os.getenv("SOFTGRAPH_USERS", "{}")), os.getenv("SOFTGRAPH_SESSION_SECRET", ""), os.getenv("SOFTGRAPH_ENV", "local") == "production")

    def validate(self):
        if not isinstance(self.users, dict):
            raise ValueError("SOFTGRAPH_USERS must be a JSON object")
        if self.production and not self.users:
            raise ValueError("Production requires SOFTGRAPH_USERS and a session secret")
        if self.users and len(self.secret) < 32:
            raise ValueError("Session signing secret must contain at least 32 characters")
        for name, user in self.users.items():
            if not isinstance(user, dict) or not isinstance(user.get("workspaces"), list):
                raise ValueError("Users require an object with a workspace list")
            if not isinstance(name, str) or not name or len(name) > 100 or not isinstance(user.get("key"), str) or len(user["key"]) < 32:
                raise ValueError("Named users require unique access keys of at least 32 characters")
            if user.get("role") not in {"reader", "editor"} or not user.get("workspaces") or not set(user["workspaces"]) <= WORKSPACE_IDS:
                raise ValueError("Users require a reader/editor role and allowed workspace memberships")
        if len({user["key"] for user in self.users.values()}) != len(self.users):
            raise ValueError("Access keys must be unique")

    def authenticate_key(self, key):
        for name, user in self.users.items():
            if hmac.compare_digest(user["key"].encode(), key.encode()): return {"user": name, "role": user["role"], "workspaces": user["workspaces"]}
        return None

    def issue(self, name):
        payload = base64.urlsafe_b64encode(json.dumps({"user": name, "expires": int(time.time()) + self.session_seconds}, separators=(",", ":")).encode()).decode().rstrip("=")
        signature = hmac.new(self.secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        return payload + "." + signature

    def session(self, token):
        try:
            payload, signature = token.split(".")
            expected = hmac.new(self.secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected): return None
            body = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
            user = self.users.get(body["user"])
            if not user or type(body["expires"]) is not int or not time.time() < body["expires"] <= time.time() + self.session_seconds + 1: return None
            return {"user": body["user"], "role": user["role"], "workspaces": user["workspaces"]}
        except (ValueError, KeyError, TypeError):
            return None
