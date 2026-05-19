import sys

sys.path.insert(0, "/app")

config = {
    "app": "config.asgi:application",
    "host": "0.0.0.0",
    "port": 8000,
    "reload": True,
    "workers": 1,
    "log_level": "debug",
}
