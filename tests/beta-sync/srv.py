import threading, http.server, functools, socketserver
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def start(port=8765, root=None):
    socketserver.TCPServer.allow_reuse_address=True
    import os
    root=root or os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
    h=functools.partial(Q,directory=root)
    s=http.server.ThreadingHTTPServer(("127.0.0.1",port),h)
    threading.Thread(target=s.serve_forever,daemon=True).start()
    return s
