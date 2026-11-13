"""Nube simulada que imita a Supabase (PostgREST + Auth) para pruebas en navegador real.
Reglas copiadas de las migraciones reales:
 - RLS: cada usuario solo ve/escribe sus filas (auth.uid() = user_id).
 - tm_character_saves: PK (user_id, profile_id); UPDATE exige revision = OLD+1,
   prohíbe cambiar user_id/profile_id y fuerza verified=false.
"""
import json, base64, time, urllib.parse, threading

URL = "https://cogwkcmlkurzagygnivy.supabase.co"

def b64(o):
    return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")

class FakeSupabase:
    def __init__(self):
        import contextlib; self.lock = contextlib.nullcontext()  # un solo hilo: un Lock causaría bloqueo entre manejadores
        self.users = {}      # token -> user dict
        self.tables = {"tm_character_saves": [], "tm_legacy_backups": [], "tm_cloud_saves": [], "tm_players": []}
        self.offline = set() # ids de "celular" sin red
        self.log = []
        self.seq = 1

    def add_user(self, uid, email):
        exp = int(time.time()) + 3600 * 24
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + b64({"sub": uid, "email": email, "exp": exp, "role": "authenticated", "aud": "authenticated"}) + ".firma"
        user = {"id": uid, "aud": "authenticated", "role": "authenticated", "email": email,
                "email_confirmed_at": "2026-11-10T00:00:00Z", "app_metadata": {"provider": "email"},
                "user_metadata": {}, "created_at": "2026-11-10T00:00:00Z"}
        self.users[token] = user
        session = {"access_token": token, "refresh_token": "r-" + uid, "token_type": "bearer",
                   "expires_in": 86400, "expires_at": exp, "user": user}
        return session

    # ---------- helpers ----------
    def _uid(self, headers):
        auth = headers.get("authorization", "")
        tok = auth.split(" ", 1)[1] if " " in auth else ""
        u = self.users.get(tok)
        return u["id"] if u else None

    def _filters(self, qs):
        flt, meta = [], {}
        for k, vals in qs.items():
            for v in vals:
                if k in ("select", "order", "limit", "offset", "on_conflict", "columns"):
                    meta[k] = v
                else:
                    op, _, val = v.partition(".")
                    flt.append((k, op, val))
        return flt, meta

    @staticmethod
    def _match(row, flt):
        for col, op, val in flt:
            cur = row.get(col)
            s = "" if cur is None else str(cur)
            if op == "eq" and s != val: return False
            if op == "neq" and s == val: return False
        return True

    @staticmethod
    def _project(row, select):
        if not select or select == "*": return dict(row)
        cols = [c.strip() for c in select.split(",") if c.strip()]
        return {c: row.get(c) for c in cols}

    def _now(self):
        return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + ".%03dZ" % (int(time.time() * 1000) % 1000)

    # ---------- entry point for Playwright ----------
    def handle(self, route, device):
        try:
            return self._handle(route, device)
        except Exception:
            import traceback; traceback.print_exc()
            try: route.abort()
            except Exception: pass

    def _handle(self, route, device):
        req = route.request
        u = urllib.parse.urlparse(req.url)
        if device in self.offline:
            return route.abort("internetdisconnected")
        hdr = {k.lower(): v for k, v in req.headers.items()}
        cors = {"access-control-allow-origin": "*", "access-control-allow-headers": "*",
                "access-control-allow-methods": "*", "access-control-expose-headers": "*"}
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers=cors)
        def reply(status, body, extra=None):
            h = dict(cors); h["content-type"] = "application/json"
            if extra: h.update(extra)
            route.fulfill(status=status, headers=h, body=json.dumps(body))
        with self.lock:
            if u.path.startswith("/auth/v1/user"):
                tok = hdr.get("authorization", "").split(" ", 1)[-1]
                user = self.users.get(tok)
                return reply(200, user) if user else reply(401, {"msg": "invalid JWT", "code": 401})
            if u.path.startswith("/auth/v1/"):
                return reply(200, {})
            if not u.path.startswith("/rest/v1/"):
                return reply(404, {"message": "not found"})
            table = u.path.split("/rest/v1/")[1]
            rows = self.tables.setdefault(table, [])
            uid = self._uid(hdr)
            if not uid:
                return reply(401, {"code": "42501", "message": "permission denied"})
            qs = urllib.parse.parse_qs(u.query, keep_blank_values=True)
            flt, meta = self._filters(qs)
            single = "vnd.pgrst.object" in hdr.get("accept", "")
            visible = [r for r in rows if r.get("user_id") == uid]  # RLS
            self.log.append((device, req.method, table, u.query[:160]))
            def out(result, status=200):
                sel = meta.get("select")
                result = [self._project(r, sel) for r in result]
                if single:
                    if len(result) != 1:
                        return reply(406, {"code": "PGRST116", "details": "The result contains %d rows" % len(result),
                                           "hint": None, "message": "JSON object requested, multiple (or no) rows returned"})
                    return reply(status, result[0])
                return reply(status, result)
            if req.method in ("GET", "HEAD"):
                res = [r for r in visible if self._match(r, flt)]
                if "order" in meta:
                    col, _, d = meta["order"].partition(".")
                    res.sort(key=lambda r: str(r.get(col) or ""), reverse=d.startswith("desc"))
                if "limit" in meta: res = res[: int(meta["limit"])]
                return out(res)
            body = json.loads(req.post_data or "null")
            if req.method == "POST":
                items = body if isinstance(body, list) else [body]
                made = []
                for it in items:
                    if it.get("user_id") != uid:
                        return reply(403, {"code": "42501", "message": "new row violates row-level security policy"})
                    if table == "tm_character_saves":
                        if any(r["user_id"] == uid and r["profile_id"] == it["profile_id"] for r in rows):
                            return reply(409, {"code": "23505", "message": "duplicate key value violates unique constraint"})
                    row = dict(it); row["verified"] = False
                    row.setdefault("id", "row-%d" % self.seq); self.seq += 1
                    row["created_at"] = row["updated_at"] = self._now()
                    rows.append(row); made.append(row)
                return out(made, 201)
            if req.method == "PATCH":
                targets = [r for r in visible if self._match(r, flt)]
                for r in targets:
                    if table == "tm_character_saves":
                        if "revision" in body and int(body["revision"]) != int(r["revision"]) + 1:
                            return reply(400, {"code": "P0001", "message": "tm_character_saves: revision must increment by exactly 1"})
                        if body.get("user_id", r["user_id"]) != r["user_id"] or body.get("profile_id", r["profile_id"]) != r["profile_id"]:
                            return reply(400, {"code": "P0001", "message": "identity is immutable"})
                for r in targets:
                    r.update(body); r["verified"] = False; r["updated_at"] = self._now()
                return out(targets)
            if req.method == "DELETE":
                targets = [r for r in visible if self._match(r, flt)]
                for r in targets: rows.remove(r)
                return out(targets)
            return reply(405, {"message": "method"})

    def row(self, uid, pid):
        for r in self.tables["tm_character_saves"]:
            if r["user_id"] == uid and r["profile_id"] == pid: return r
        return None
