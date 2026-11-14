"""Mimitori Anki add-on: glue between Anki and the local HTTP server."""
from concurrent.futures import Future

from aqt import gui_hooks, mw
from aqt.utils import tooltip

from . import actions, server

_server = None


def _on_main(action, params):
    if mw.col is None:
        raise Exception("Anki has no profile open")
    fut = Future()

    def work():
        try:
            fut.set_result(actions.run(mw.col, action, params))
        except Exception as e:
            fut.set_exception(e)

    mw.taskman.run_on_main(work)
    return fut.result(timeout=60)


def _start():
    global _server
    if _server:
        return
    cfg = mw.addonManager.getConfig(__name__) or {}
    port = cfg.get("port", 8766)
    try:
        _server = server.start(port, cfg.get("allowedOrigins", []), _on_main)
    except OSError:
        tooltip(f"Mimitori: port {port} is already in use, so the add-on is off.")


def _stop():
    global _server
    if _server:
        server.stop(_server)
        _server = None


gui_hooks.profile_did_open.append(_start)
gui_hooks.profile_will_close.append(_stop)
