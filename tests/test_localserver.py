"""
The local tool servers' same-origin guard (tools/localserver.py).

The designer, the workbench and the review console write files, push
commits and merge pull requests. A browser will send a request to
http://localhost:<port> from ANY page that is open while one of them
runs, so the guard is what stands between a hostile web page and
`git push`. These tests run a real server on a spare port and send it
the requests a browser would.
"""

import http.client
import json
import pathlib
import sys
import tempfile
import threading
import unittest
from http.server import HTTPServer

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))

import localserver                                           # noqa: E402


class Guard(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        web = pathlib.Path(cls.tmp.name)
        (web / "index.html").write_text("hello", encoding="utf-8")
        (web / "allowed.js").write_text("1", encoding="utf-8")
        (web / "secret.js").write_text("2", encoding="utf-8")

        class Handler(localserver.LocalHandler):
            WEB = web
            SITE = web
            SITE_FILES = {"allowed.js"}
            MAX_BODY = 64

            def do_GET(self):
                if self.route().startswith("/site/"):
                    return self.send_site(self.route()[len("/site/"):])
                return super().do_GET()

            def do_POST(self):
                try:
                    return self.send_json({"got": self.read_json()})
                except localserver.BodyTooLarge as e:
                    return self.send_json({"error": str(e)}, 400)

            def log_message(self, *a):
                pass

        cls.server = HTTPServer(("127.0.0.1", 0), Handler)
        cls.port = cls.server.server_port
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def request(self, method, path, headers=None, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        h = {"Host": f"localhost:{self.port}"}
        h.update(headers or {})
        conn.request(method, path, body=body, headers=h)
        res = conn.getresponse()
        data = res.read()
        conn.close()
        return res.status, data

    def origin(self):
        return f"http://localhost:{self.port}"

    def test_the_tool_s_own_page_is_served(self):
        self.assertEqual(self.request("GET", "/index.html")[0], 200)
        status, data = self.request(
            "POST", "/api/x", {"Origin": self.origin(),
                               "Sec-Fetch-Site": "same-origin"}, b'{"a": 1}')
        self.assertEqual((status, json.loads(data)), (200, {"got": {"a": 1}}))

    def test_a_command_line_client_is_let_through(self):
        # curl sends no Origin; it already runs as the user on this machine.
        self.assertEqual(self.request("POST", "/api/x", body=b"{}")[0], 200)

    def test_another_site_s_origin_is_refused(self):
        for method in ("GET", "POST"):
            status, _ = self.request(method, "/api/x",
                                     {"Origin": "https://evil.example"}, b"{}")
            self.assertEqual(status, 403, method)

    def test_a_cross_site_form_post_is_refused(self):
        status, _ = self.request("POST", "/api/x",
                                 {"Sec-Fetch-Site": "cross-site"}, b"{}")
        self.assertEqual(status, 403)

    def test_a_rebound_hostname_is_refused(self):
        # DNS rebinding: evil.example is re-pointed at 127.0.0.1, so the
        # request reaches us, same-origin as far as the browser can tell.
        status, _ = self.request("GET", "/index.html",
                                 {"Host": f"evil.example:{self.port}"})
        self.assertEqual(status, 403)

    def test_site_files_are_an_allow_list(self):
        self.assertEqual(self.request("GET", "/site/allowed.js")[0], 200)
        self.assertEqual(self.request("GET", "/site/secret.js")[0], 404)
        self.assertEqual(self.request("GET", "/site/../secret.js")[0], 404)

    def test_an_oversized_body_is_refused_unread(self):
        status, data = self.request("POST", "/api/x", body=b"x" * 200)
        self.assertEqual(status, 400)
        self.assertIn("too large", json.loads(data)["error"])


if __name__ == "__main__":
    unittest.main()
