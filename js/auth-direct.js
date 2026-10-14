/* ==========================================================================
   S&R Collectibles — DIRECT auth (bypasses Supabase JS library)
   The Supabase JS library's fetch fails in browsers ("Failed to fetch")
   while raw fetch() works fine. This module uses raw fetch() directly
   to the Supabase Auth API, bypassing the library entirely.
   ========================================================================== */
(function () {
  "use strict";
  var SR = (window.SR = window.SR || {});
  var cfg = window.SR_CONFIG || {};

  function authHeaders() {
    return {
      "apikey": cfg.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY
    };
  }

  function saveSession(data) {
    try { localStorage.setItem("sr_session", JSON.stringify(data)); } catch (e) {}
  }
  function loadSession() {
    try {
      var s = localStorage.getItem("sr_session");
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem("sr_session"); } catch (e) {}
  }

  /* Sign in with email + password. Returns {data, error}. */
  SR.signInDirect = async function (email, password) {
    try {
      var res = await fetch(cfg.SUPABASE_URL + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json();
      if (!res.ok) {
        return { data: null, error: { message: data.msg || data.error_description || data.error || "Sign-in failed" } };
      }
      saveSession(data);
      return { data: data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message || "Failed to fetch" } };
    }
  };

  /* Sign up. Returns {data, error}. */
  SR.signUpDirect = async function (email, password) {
    try {
      var res = await fetch(cfg.SUPABASE_URL + "/auth/v1/signup", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: email, password: password })
      });
      var data = await res.json();
      if (!res.ok) {
        return { data: null, error: { message: data.msg || data.error_description || data.error || "Sign-up failed" } };
      }
      if (data.access_token) saveSession(data);
      return { data: data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message || "Failed to fetch" } };
    }
  };

  /* Get current user from stored session. Returns user object or null. */
  SR.getUserDirect = async function () {
    var sess = loadSession();
    if (!sess || !sess.access_token) return null;
    try {
      var res = await fetch(cfg.SUPABASE_URL + "/auth/v1/user", {
        headers: {
          "apikey": cfg.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + sess.access_token
        }
      });
      if (!res.ok) { clearSession(); return null; }
      return await res.json();
    } catch (e) { return null; }
  };

  /* Sign out. */
  SR.signOutDirect = function () {
    clearSession();
    location.reload();
  };

  /* Get access token for authenticated API calls. */
  SR.getTokenDirect = function () {
    var sess = loadSession();
    return sess ? sess.access_token : null;
  };

  /* Check if current user is admin (via is_admin RPC). */
  SR.isAdminDirect = async function () {
    var token = SR.getTokenDirect();
    if (!token) return false;
    try {
      var res = await fetch(cfg.SUPABASE_URL + "/rest/v1/rpc/is_admin", {
        method: "POST",
        headers: {
          "apikey": cfg.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      if (!res.ok) return false;
      var val = await res.json();
      return val === true;
    } catch (e) { return false; }
  };

  /* Creates the sellers row on first login (id = auth user id).
     Direct-fetch version of SR.ensureSellerRow (store.js uses the Supabase
     JS library client, which is the thing that fails on Ryan's phone) —
     so the sell page must call THIS, not the store.js one. */
  SR.ensureSellerRowDirect = async function (user, displayName) {
    if (!user) return null;
    var name =
      displayName ||
      (user.user_metadata && user.user_metadata.display_name) ||
      (user.email ? user.email.split("@")[0] : "Collector");
    try {
      var res = await SR.dbDirect()
        .from("sellers")
        .upsert({ id: user.id, display_name: name }, { onConflict: "id" })
        .select()
        .single();
      if (res.error) return { id: user.id, display_name: name };
      return res.data;
    } catch (e) {
      return { id: user.id, display_name: name };
    }
  };

  /* Direct REST query helper (replaces sb.from().select() etc.) */
  SR.restDirect = async function (table, opts) {
    opts = opts || {};
    var token = SR.getTokenDirect();
    var headers = { "apikey": cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    if (opts.prefer) headers["Prefer"] = opts.prefer;
    var url = cfg.SUPABASE_URL + "/rest/v1/" + table;
    if (opts.query) url += "?" + opts.query;
    try {
      var res = await fetch(url, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
      var data = await res.json();
      if (!res.ok) return { data: null, error: { message: data.message || "Request failed" } };
      return { data: data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message || "Failed to fetch" } };
    }
  };
})();

/* ---- Supabase JS compatibility wrapper ------------------------------------
   Provides sb.from().select()/insert()/update()/delete() and sb.storage
   using direct fetch, so existing dashboard code works unchanged.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";
  var SR = (window.SR = window.SR || {});
  var cfg = window.SR_CONFIG || {};

  function headers(extra) {
    var h = { "apikey": cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    var token = SR.getTokenDirect();
    if (token) h["Authorization"] = "Bearer " + token;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function buildQuery(table, q) {
    var url = cfg.SUPABASE_URL + "/rest/v1/" + table + "?";
    var parts = [];
    if (q.select) parts.push("select=" + encodeURIComponent(q.select));
    if (q.filters) q.filters.forEach(function (f) { parts.push(f); });
    if (q.order) parts.push("order=" + encodeURIComponent(q.order));
    if (q.limit) parts.push("limit=" + q.limit);
    return url + parts.join("&");
  }

  function QueryBuilder(table) {
    this.table = table;
    this.q = { filters: [] };
    this._single = false;
  }
  QueryBuilder.prototype.select = function (cols) {
    this.q.select = cols || "*";
    /* Do NOT clobber an op already set by insert/update/upsert/delete —
       e.g. .upsert(...).select().single() must stay an upsert. */
    if (!this._op) this._op = "select";
    return this;
  };
  QueryBuilder.prototype.upsert = function (rows, opts) {
    this._op = "upsert";
    this._rows = rows;
    this._onConflict = (opts && opts.onConflict) || null;
    return this;
  };
  QueryBuilder.prototype.insert = function (rows) {
    this._op = "insert";
    this._rows = rows;
    return this;
  };
  QueryBuilder.prototype.update = function (vals) {
    this._op = "update";
    this._vals = vals;
    return this;
  };
  QueryBuilder.prototype.delete = function () {
    this._op = "delete";
    return this;
  };
  QueryBuilder.prototype.eq = function (col, val) {
    this.q.filters.push(col + "=eq." + encodeURIComponent(val));
    return this;
  };
  QueryBuilder.prototype.order = function (col, opts) {
    this.q.order = col + "." + ((opts && opts.ascending === false) ? "desc" : "asc");
    return this;
  };
  QueryBuilder.prototype.limit = function (n) {
    this.q.limit = n;
    return this;
  };
  QueryBuilder.prototype.single = function () {
    this._single = true;
    return this;
  };
  QueryBuilder.prototype.then = function (resolve, reject) {
    var self = this;
    return (async function () {
      try {
        var method = "GET";
        var body = undefined;
        var extraHeaders = {};
        if (self._op === "insert") {
          method = "POST";
          body = JSON.stringify(self._rows);
          extraHeaders["Prefer"] = "return=representation";
        } else if (self._op === "upsert") {
          method = "POST";
          body = JSON.stringify(self._rows);
          extraHeaders["Prefer"] = "return=representation,resolution=merge-duplicates";
        } else if (self._op === "update") {
          method = "PATCH";
          body = JSON.stringify(self._vals);
          extraHeaders["Prefer"] = "return=representation";
        } else if (self._op === "delete") {
          method = "DELETE";
        }
        var url = buildQuery(self.table, self.q);
        if (self._op === "upsert" && self._onConflict) {
          url += "&on_conflict=" + encodeURIComponent(self._onConflict);
        }
        var res = await fetch(url, { method: method, headers: headers(extraHeaders), body: body });
        var data = await res.json().catch(function () { return null; });
        if (!res.ok) {
          resolve({ data: null, error: { message: (data && data.message) || "Request failed" } });
          return;
        }
        if (self._single && Array.isArray(data)) data = data[0] || null;
        resolve({ data: data, error: null });
      } catch (e) {
        resolve({ data: null, error: { message: e.message || "Failed to fetch" } });
      }
    })().then(resolve, reject);
  };

  /* The compatibility client — drop-in replacement for supabase.createClient() */
  SR.dbDirect = function () {
    return {
      from: function (table) { return new QueryBuilder(table); },
      storage: {
        from: function (bucket) {
          return {
            /* Upload a file to Storage: POST /storage/v1/object/{bucket}/{path} */
            upload: async function (path, file) {
              try {
                var res = await fetch(cfg.SUPABASE_URL + "/storage/v1/object/" + bucket + "/" + path, {
                  method: "POST",
                  headers: (function () {
                    var h = headers();
                    h["Content-Type"] = (file && file.type) || "application/octet-stream";
                    h["x-upsert"] = "false";
                    return h;
                  })(),
                  body: file
                });
                var data = await res.json().catch(function () { return {}; });
                if (!res.ok) return { data: null, error: { message: (data && (data.message || data.error)) || "Upload failed" } };
                return { data: { path: path, fullPath: bucket + "/" + path }, error: null };
              } catch (e) {
                return { data: null, error: { message: e.message } };
              }
            },
            /* Public URL for a public bucket — synchronous, like the library. */
            getPublicUrl: function (path) {
              return { data: { publicUrl: cfg.SUPABASE_URL + "/storage/v1/object/public/" + bucket + "/" + path } };
            },
            createSignedUrl: async function (path, expires) {
              try {
                var token = SR.getTokenDirect();
                var res = await fetch(cfg.SUPABASE_URL + "/storage/v1/object/sign/" + bucket + "/" + path + "?expires_in=" + (expires || 3600), {
                  method: "POST",
                  headers: headers()
                });
                var data = await res.json();
                if (!res.ok) return { data: null, error: { message: "Signed URL failed" } };
                return { data: { signedUrl: cfg.SUPABASE_URL + "/storage/v1" + data.signedURL }, error: null };
              } catch (e) {
                return { data: null, error: { message: e.message } };
              }
            }
          };
        }
      }
    };
  };
})();
