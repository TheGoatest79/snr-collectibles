/* ==========================================================================
   S&R Collectibles — shared store wiring (Supabase JS v2)
   --------------------------------------------------------------------------
   Load order on every wired page:
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
     2. js/config.js
     3. js/store.js
     4. page script (js/auctions.js, js/sell.js, …)

   If the anon key is still the PASTE_ANON_KEY_HERE placeholder, every page
   shows a clean "store syncing" state instead of throwing JS errors.
   ========================================================================== */
(function () {
  "use strict";

  var cfg = window.SR_CONFIG || {};
  var PLACEHOLDER = "PASTE_ANON_KEY_HERE";

  var SR = (window.SR = window.SR || {});

  /* ---- configuration ---------------------------------------------------- */
  SR.isConfigured = function () {
    return !!(
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_ANON_KEY &&
      cfg.SUPABASE_ANON_KEY !== PLACEHOLDER &&
      window.supabase &&
      window.supabase.createClient
    );
  };

  var _client = null;
  SR.db = function () {
    if (!_client && SR.isConfigured()) {
      _client = window.supabase.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      );
    }
    return _client;
  };

  /* ---- tiny helpers ------------------------------------------------------ */
  SR.money = function (n) {
    var v = Number(n);
    return "$" + (isFinite(v) ? v.toFixed(2) : "0.00");
  };

  SR.esc = function (s) {
    return String(s === null || s === undefined ? "" : s).replace(
      /[&<>"']/g,
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c];
      }
    );
  };

  /* Friendly inline status line inside forms. */
  SR.note = function (el, html, kind) {
    if (!el) return;
    var colors = {
      info: "var(--gold)",
      ok: "#7fc97f",
      err: "#e07b7b"
    };
    el.innerHTML =
      '<div style="margin-top:12px;padding:10px 14px;border:1px solid ' +
      (colors[kind] || colors.info) +
      ';border-radius:8px;font-size:.9rem">' +
      html +
      "</div>";
  };

  SR.showSyncing = function (el) {
    if (!el) return;
    el.innerHTML =
      '<div class="empty-state" style="display:block">' +
      '<div class="big">🔌</div><h3>Store syncing</h3>' +
      "<p>We're connecting the shelves to the stockroom. Check back shortly — your finds are safe.</p>" +
      "</div>";
  };

  /* ---- checkout -----------------------------------------------------------
     S&R's own Stripe account is live. Buy buttons create a real Stripe
     Checkout Session via the rapid-task edge function (deployed 2026-10-10;
     that is the live function name — do not rename the fetch URL below
     without renaming the deployed function too) — no per-product
     setup needed. Falls back to a product's Stripe Payment Link if set,
     then to the "coming soon" card. */
  SR.checkout = function (product) {
    if (product.stripe_payment_link) {
      window.location.href = product.stripe_payment_link;
      return;
    }
    // Try the automatic checkout via Supabase edge function.
    if (SR.isConfigured() && product.price) {
      var btn = document.activeElement;
      SR._startCheckout(product, btn);
      return;
    }
    SR._checkoutComingSoon(product);
  };

  SR._startCheckout = async function (product, btn) {
    var originalText = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Starting checkout…"; }
    try {
      var res = await fetch(
        cfg.SUPABASE_URL + "/functions/v1/rapid-task",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: cfg.SUPABASE_ANON_KEY,
            Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            name: product.name,
            price_cents: Math.round(Number(product.price) * 100),
            description: product.description || "",
            image_url: product.image_url || "",
            product_id: product.id || "",
          }),
        }
      );
      var data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || "checkout failed");
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = originalText; }
      SR._checkoutComingSoon(product);
    }
  };

  SR._checkoutComingSoon = function (product) {
    var name = product.name || "this item";
    var price = SR.money(product.price);
    var ov = document.getElementById("sr-checkout-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "sr-checkout-overlay";
      ov.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;" +
        "display:flex;align-items:center;justify-content:center;padding:20px;";
      ov.innerHTML =
        '<div style="background:#241b10;border:2px solid var(--gold,#d4af37);' +
        'border-radius:14px;max-width:440px;width:100%;padding:32px;text-align:center;">' +
        '<div style="font-size:2.2rem;margin-bottom:8px">💳</div>' +
        '<h3 id="sr-co-name" style="color:var(--gold,#d4af37);margin-bottom:6px"></h3>' +
        '<p id="sr-co-price" style="font-size:1.3rem;font-weight:700;margin-bottom:12px"></p>' +
        "<p style=\"color:#cbb98a;font-size:.92rem;margin-bottom:20px\">This item isn't purchasable online yet — S&amp;R is still adding it to the checkout. Check back soon.</p>" +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        '<a class="btn" href="contact.html">Ask about this item</a>' +
        '<button class="btn ghost" id="sr-co-close">Keep browsing</button>' +
        "</div></div>";
      document.body.appendChild(ov);
      ov.addEventListener("click", function (e) {
        if (e.target === ov || e.target.id === "sr-co-close") ov.style.display = "none";
      });
    }
    document.getElementById("sr-co-name").textContent = name;
    document.getElementById("sr-co-price").textContent = price;
    ov.style.display = "flex";
  };

  /* ---- auth helpers ------------------------------------------------------- */
  SR.getUser = async function () {
    if (!SR.isConfigured()) return null;
    try {
      var res = await SR.db().auth.getUser();
      return res.data ? res.data.user : null;
    } catch (e) {
      return null;
    }
  };

  /* Creates the sellers row on first login (id = auth user id). */
  SR.ensureSellerRow = async function (user, displayName) {
    if (!user) return null;
    var sb = SR.db();
    var name =
      displayName ||
      (user.user_metadata && user.user_metadata.display_name) ||
      (user.email ? user.email.split("@")[0] : "Collector");
    var res = await sb
      .from("sellers")
      .upsert({ id: user.id, display_name: name }, { onConflict: "id" })
      .select()
      .single();
    if (res.error) return { id: user.id, display_name: name };
    return res.data;
  };

  SR.isAdmin = async function () {
    if (!SR.isConfigured()) return false;
    try {
      var res = await SR.db().rpc("is_admin");
      return res.data === true;
    } catch (e) {
      return false;
    }
  };

  SR.signOut = async function () {
    if (SR.isConfigured()) {
      try {
        await SR.db().auth.signOut();
      } catch (e) {}
    }
    window.location.reload();
  };

  /* ---- product catalog pages (shop / digital / budget) -------------------- */
  /* shop.html uses body data-category="vault"; the DB calls it "cabinet". */
  SR.CATEGORY_MAP = {
    vault: "cabinet",
    cabinet: "cabinet",
    digital: "digital",
    budget: "budget"
  };

  SR.initProductPage = function () {
    var grid = document.getElementById("product-grid");
    var empty = document.getElementById("empty-state");
    if (!grid) return;

    if (!SR.isConfigured()) {
      SR.showSyncing(grid);
      if (empty) empty.style.display = "none";
      return;
    }

    var pageCat = document.body.dataset.category || "vault";
    var dbCat = SR.CATEGORY_MAP[pageCat] || "cabinet";

    var q = document.getElementById("f-search");
    var t = document.getElementById("f-type");
    var c = document.getElementById("f-condition");
    var m = document.getElementById("f-media");
    var s = document.getElementById("f-sort");

    var products = [];

    function applyFilters(list) {
      var out = list.slice();
      var query = ((q && q.value) || "").toLowerCase().trim();
      if (query)
        out = out.filter(function (p) {
          return (p.name || "").toLowerCase().indexOf(query) !== -1;
        });
      if (t && t.value) out = out.filter(function (p) { return p.type === t.value; });
      if (c && c.value)
        out = out.filter(function (p) {
          return ((p.condition || "").toLowerCase().indexOf(c.value) !== -1);
        });
      if (m && m.value) out = out.filter(function (p) { return p.media === m.value; });
      if (s && s.value === "price-asc")
        out.sort(function (a, b) { return Number(a.price) - Number(b.price); });
      if (s && s.value === "price-desc")
        out.sort(function (a, b) { return Number(b.price) - Number(a.price); });
      if (s && s.value === "name")
        out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      return out;
    }

    function card(p) {
      var div = document.createElement("div");
      div.className = "product-card";
      var img = p.img_url
        ? '<div class="ph"><img src="' + SR.esc(p.img_url) + '" alt="' + SR.esc(p.name) + '" loading="lazy"></div>'
        : '<div class="ph">📷 Photo coming soon</div>';
      var cond = p.condition ? SR.esc(p.condition) : "";
      var media = p.media ? " · " + SR.esc(p.media) : "";
      var cert =
        p.cert_number
          ? '<div style="font-size:.78rem;color:var(--gold-deep)">📜 Cert ' +
            SR.esc(p.cert_number) +
            (p.edition ? " · Edition " + SR.esc(p.edition) : "") +
            "</div>"
          : "";
      div.innerHTML =
        img +
        '<div class="info">' +
        (p.badge ? '<span class="badge">' + SR.esc(p.badge) + "</span>" : "") +
        "<h3>" + SR.esc(p.name) + "</h3>" +
        '<div class="price">' + SR.money(p.price) + "</div>" +
        '<div style="font-size:.82rem;color:var(--muted)">' + cond + media + "</div>" +
        cert +
        '<button class="btn" style="margin-top:8px" data-buy="' + SR.esc(p.id) + '">Buy — ' +
        SR.money(p.price) +
        "</button></div>";
      return div;
    }

    function render() {
      var list = applyFilters(products);
      grid.innerHTML = "";
      if (!list.length) {
        grid.style.display = "none";
        if (empty) empty.style.display = "block";
        return;
      }
      grid.style.display = "grid";
      if (empty) empty.style.display = "none";
      list.forEach(function (p) { grid.appendChild(card(p)); });
    }

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-buy]");
      if (!btn) return;
      var p = products.find(function (x) { return String(x.id) === btn.getAttribute("data-buy"); });
      if (p) SR.checkout(p);
    });

    [q, t, c, m, s].forEach(function (el) {
      if (el) el.addEventListener("input", render);
    });

    /* Deep-link: shop.html?type=trading-card preselects the Type filter. */
    try {
      var params = new URLSearchParams(window.location.search);
      var pt = params.get("type");
      if (pt && t) {
        var opt = Array.prototype.find.call(t.options, function (o) { return o.value === pt; });
        if (opt) t.value = pt;
      }
    } catch (e) {}

    SR.db()
      .from("products")
      .select("*")
      .eq("status", "active")
      .eq("category", dbCat)
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          SR.note(
            grid,
            "⚠️ Couldn't load the shelves right now (" + SR.esc(res.error.message) + "). Try refreshing in a bit.",
            "err"
          );
          return;
        }
        products = res.data || [];
        render();
      });
  };
})();
