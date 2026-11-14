import json
import socket
import urllib.error
import urllib.request

import server

ORIGIN = "http://localhost:5173"
calls = []


def handle(action, params):
    calls.append(action)
    if action == "boom":
        raise Exception("kaboom")
    return [action, params]


with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
srv = server.start(port, [ORIGIN], handle)
url = f"http://127.0.0.1:{port}/"


def post(action, origin=None, host=None):
    h = {"Content-Type": "application/json"}
    if origin:
        h["Origin"] = origin
    if host:
        h["Host"] = host
    req = urllib.request.Request(url, json.dumps({"action": action, "version": 6, "params": {"a": 1}}).encode(), h)
    try:
        r = urllib.request.urlopen(req)
        return r.status, r.headers, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.headers, None


try:
    st, hd, body = post("hi", ORIGIN)
    assert st == 200 and body == {"result": ["hi", {"a": 1}], "error": None}
    assert hd["Access-Control-Allow-Origin"] == ORIGIN and hd["Vary"] == "Origin"
    assert post("hi")[0] == 200  # no Origin is fine

    n = len(calls)
    st, hd, _ = post("evil", "https://evil.example")
    assert st == 403 and hd["Access-Control-Allow-Origin"] is None and len(calls) == n
    assert post("evil", "null")[0] == 403 and len(calls) == n

    assert post("evil", host="evil.example")[0] == 403 and len(calls) == n

    req = urllib.request.Request(url, method="OPTIONS", headers={"Origin": ORIGIN})
    r = urllib.request.urlopen(req)
    assert r.status == 204 and r.headers["Access-Control-Allow-Private-Network"] == "true"
    bad = urllib.request.Request(url, method="OPTIONS", headers={"Origin": "https://evil.example"})
    try:
        urllib.request.urlopen(bad)
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 403

    assert post("boom")[2] == {"result": None, "error": "kaboom"}
    print("ok")
finally:
    server.stop(srv)
