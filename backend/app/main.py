"""ASGI entry point; offline callers import the side-effect-free factory."""
from app.factory import create_app
from app.platform import create_platform_app

app = create_platform_app()
