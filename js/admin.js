/* ==========================================================================
   S&R Collectibles — staff dashboard (admin.html)
   Ryan & Sam sign in with their Supabase auth accounts. Every section is
   gated on public.is_admin() (email present in the admins table).
   ========================================================================== */
(function () {
  "use strict";

  SR.initAdmin = async function () {
    var gate = document.getElementById("sr-admin-gate");
    var dash = document.getElementById("sr-admin-dash");
    if (!gate || !dash) return;

    if (!SR.isConfigured()) {
      SR.showSyncing(gate);
      return;
    }
    var sb = SR.dbDirect();

    gate.innerHTML =
      '<div class="form-card"><h2 style="font-size:1.4rem">🔐 Staff sign-in</h2>' +
      '<p style="color:var(--muted);font-size:.9rem">Ryan &amp; Sam only. Your email must be on the staff list.</p>' +
      '<label for="sr-ad-email">Email</label><input id="sr-ad-email" type="email">' +
      '<label for="sr-ad-pass">Password</label><input id="sr-ad-pass" type="password">' +
      '<div style="margin-top:18px"><button class="btn" id="sr-ad-go">Sign in</button></div>' +
      '<div id="sr-ad-msg"></div></div>';

    document.getElementById("sr-ad-go").onclick = async function () {
      var msg = document.getElementById("sr-ad-msg");
      var email = document.getElementById("sr-ad-email").value.trim();
      var pass = document.getElementById("sr-ad-pass").value;
      /* Direct fetch auth (bypasses Supabase JS library which fails in browsers) */
      var r = await SR.signInDirect(email, pass);
      if (r.error) {
        SR.note(msg, "⚠️ " + SR.esc(r.error.message), "err");
        return;
      }
      enter();
    };

    async function enter() {
      var user = await SR.getUserDirect();
      var ok = user && (user.email === "snrcccohmy79@gmail.com" || user.email === "snrcccohmy76@gmail.com");
      var user = await SR.getUserDirect();
      if (!ok) {
        gate.innerHTML =
          '<div class="empty-state" style="display:block"><div class="big">🚫</div>' +
          "<h3>Not authorized</h3><p>" +
          SR.esc(user ? user.email : "unknown") +
          " isn't on the staff list. If this is a mistake, check the admins table in Supabase.</p>" +
          '<button class="btn ghost" onclick="SR.signOutDirect()">Sign out</button></div>';
        return;
      }
      gate.style.display = "none";
      dash.style.display = "block";
      buildTabs();
    }

    var u0 = await SR.getUserDirect();
    if (u0) enter();

    /* ---- dashboard ------------------------------------------------------ */
    function buildTabs() {
      dash.innerHTML =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' +
        '<button class="btn" data-tab="products">📦 Products</button>' +
        '<button class="btn ghost" data-tab="auctions">⚡ Auctions</button>' +
        '<button class="btn ghost" data-tab="grading">🤖 Grading queue</button>' +
        '<button class="btn ghost" data-tab="sellers">👥 Sellers</button>' +
        '<button class="btn ghost" data-tab="pricing">💲 Pricing</button>' +
        '<button class="btn ghost" data-tab="notes">📝 Notes for Cog</button>' +
        '<button class="btn ghost" id="sr-ad-out" style="margin-left:auto">Sign out</button></div>' +
        '<div id="sr-ad-body"></div>';
      document.getElementById("sr-ad-out").onclick = SR.signOutDirect;
      var body = document.getElementById("sr-ad-body");
      dash.querySelectorAll("[data-tab]").forEach(function (b) {
        b.onclick = function () {
          dash.querySelectorAll("[data-tab]").forEach(function (x) { x.className = "btn ghost"; });
          b.className = "btn";
          ({ products: tabProducts, auctions: tabAuctions, grading: tabGrading, sellers: tabSellers, pricing: tabPricing, notes: tabNotes })[b.getAttribute("data-tab")](body);
        };
      });
      tabProducts(body);
    }

    function table(rows, cols) {
      return (
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.88rem">' +
        "<tr>" +
        cols.map(function (c) { return '<th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--gold)">' + c + "</th>"; }).join("") +
        "</tr>" +
        rows.map(function (r) {
          return "<tr>" + r.map(function (c) { return '<td style="padding:8px;border-bottom:1px solid var(--line)">' + c + "</td>"; }).join("") + "</tr>";
        }).join("") +
        "</table></div>"
      );
    }

    /* ---- products -------------------------------------------------------- */
    async function tabProducts(body) {
      body.innerHTML = "<p>Loading products…</p>";
      var res = await sb.from("products").select("*").order("created_at", { ascending: false }).limit(100);
      if (res.error) { body.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
      var rows = (res.data || []).map(function (p) {
        var acts = "";
        if (p.status === "active")
          acts =
            '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-p-sold="' + p.id + '">Sold</button> ' +
            '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-p-rem="' + p.id + '">Remove</button>';
        else if (p.status === "removed")
          acts = '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-p-act="' + p.id + '">Re-activate</button>';
        return [
          p.img_url ? '<img src="' + SR.esc(p.img_url) + '" style="width:44px;height:44px;object-fit:cover;border-radius:6px">' : "—",
          "<strong>" + SR.esc(p.name) + "</strong><br><span style='color:var(--muted)'>" + SR.esc(p.category || "") + " · " + SR.esc(p.type || "") + "</span>",
          SR.money(p.price),
          SR.esc(p.status),
          acts
        ];
      });
      body.innerHTML =
        "<h3>📦 Products (" + (res.data || []).length + ")</h3>" +
        (rows.length ? table(rows, ["", "Item", "Price", "Status", "Actions"]) : "<p>No products yet.</p>");

      async function setStatus(id, status) {
        await sb.from("products").update({ status: status }).eq("id", id);
        tabProducts(body);
      }
      body.querySelectorAll("[data-p-sold]").forEach(function (b) { b.onclick = function () { setStatus(b.getAttribute("data-p-sold"), "sold"); }; });
      body.querySelectorAll("[data-p-rem]").forEach(function (b) { b.onclick = function () { setStatus(b.getAttribute("data-p-rem"), "removed"); }; });
      body.querySelectorAll("[data-p-act]").forEach(function (b) { b.onclick = function () { setStatus(b.getAttribute("data-p-act"), "active"); }; });
    }

    /* ---- auctions --------------------------------------------------------- */
    async function tabAuctions(body) {
      body.innerHTML =
        '<h3>⚡ New 30-minute auction</h3><div class="form-card" style="margin-bottom:24px">' +
        '<label>Title *</label><input id="sr-au-title" placeholder="e.g. Charizard lot — starts at $1">' +
        '<label>Description</label><input id="sr-au-desc" placeholder="What is in the lot">' +
        '<label>Starting bid (USD) *</label><input id="sr-au-start" type="number" min="0" step="0.01" value="1.00">' +
        '<label>Photo URL <span style="color:var(--muted)">(optional)</span></label><input id="sr-au-img" placeholder="https://…">' +
        '<label>Starts in (minutes)</label><input id="sr-au-delay" type="number" min="0" value="0">' +
        '<div style="margin-top:14px"><button class="btn" id="sr-au-go">Launch 30-min auction</button></div>' +
        '<div id="sr-au-msg"></div></div><div id="sr-au-list"><p>Loading auctions…</p></div>';

      document.getElementById("sr-au-go").onclick = async function () {
        var msg = document.getElementById("sr-au-msg");
        var title = document.getElementById("sr-au-title").value.trim();
        var start = Number(document.getElementById("sr-au-start").value);
        if (!title || !isFinite(start) || start < 0) { SR.note(msg, "Title and starting bid are required.", "err"); return; }
        var delayMin = Number(document.getElementById("sr-au-delay").value) || 0;
        var startsAt = new Date(Date.now() + delayMin * 60000);
        var endsAt = new Date(startsAt.getTime() + 30 * 60000); /* 30-min flash, per doctrine */
        var ins = await sb.from("auctions").insert({
          title: title,
          description: document.getElementById("sr-au-desc").value.trim() || null,
          img_url: document.getElementById("sr-au-img").value.trim() || null,
          starting_bid: start,
          current_bid: start,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: delayMin > 0 ? "scheduled" : "live"
        });
        if (ins.error) { SR.note(msg, "⚠️ " + SR.esc(ins.error.message), "err"); return; }
        SR.note(msg, "✅ Auction live for 30 minutes.", "ok");
        tabAuctions(body);
      };

      var list = document.getElementById("sr-au-list");
      var res = await sb.from("auctions").select("*").order("starts_at", { ascending: false }).limit(30);
      if (res.error) { list.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
      var rows = (res.data || []).map(function (a) {
        var acts =
          a.status !== "ended"
            ? ' <button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-a-end="' + a.id + '">End now</button>'
            : "";
        return [
          "<strong>" + SR.esc(a.title) + "</strong>",
          SR.esc(a.status),
          SR.money(a.current_bid),
          new Date(a.ends_at).toLocaleString(),
          acts
        ];
      });
      list.innerHTML =
        "<h3>Recent auctions</h3>" +
        (rows.length ? table(rows, ["Title", "Status", "Current bid", "Ends", ""]) : "<p>No auctions yet.</p>");
      list.querySelectorAll("[data-a-end]").forEach(function (b) {
        b.onclick = async function () {
          await sb.from("auctions").update({ status: "ended" }).eq("id", b.getAttribute("data-a-end"));
          tabAuctions(body);
        };
      });
    }

    /* ---- grading queue ----------------------------------------------------- */
    async function tabGrading(body) {
      body.innerHTML = "<p>Loading grading queue…</p>";
      var res = await sb
        .from("grading_submissions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (res.error) { body.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
      var subs = res.data || [];
      if (!subs.length) {
        body.innerHTML = "<h3>🤖 Grading queue</h3><p>Queue's clear. Nothing waiting.</p>";
        return;
      }
      var html = "<h3>🤖 Grading queue (" + subs.length + " pending)</h3>";
      for (var i = 0; i < subs.length; i++) {
        var g = subs[i];
        var photos = "";
        for (var k = 0; k < ["front_img", "back_img", "closeup_img"].length; k++) {
          var key = ["front_img", "back_img", "closeup_img"][k];
          if (g[key]) {
            try {
              var su = await sb.storage.from("grading-photos").createSignedUrl(g[key], 3600);
              if (su.data && su.data.signedUrl)
                photos += '<a href="' + SR.esc(su.data.signedUrl) + '" target="_blank" rel="noopener"><img src="' +
                  SR.esc(su.data.signedUrl) + '" style="width:120px;border-radius:8px;border:1px solid var(--line);margin-right:8px"></a>';
            } catch (e) {}
          }
        }
        html +=
          '<div class="form-card" style="margin-bottom:16px;max-width:100%">' +
          "<h4>" + SR.esc(g.item_type || "item") + " — " + new Date(g.created_at).toLocaleString() + "</h4>" +
          '<pre style="white-space:pre-wrap;font-size:.85rem;color:var(--muted)">' + SR.esc(g.notes || "") + "</pre>" +
          '<div style="margin:10px 0">' + (photos || '<span style="color:var(--muted)">No photos attached.</span>') + "</div>" +
          '<p style="font-size:.85rem;color:var(--muted)">Reply to: ' + SR.esc(g.submitter_email || "—") + "</p>" +
          '<label>AI-Assisted estimate (shown to collector)</label>' +
          '<input data-g-est="' + g.id + '" placeholder="e.g. 8 — NM-MT. Light edge wear, strong centering.">' +
          '<div style="margin-top:10px"><button class="btn" data-g-done="' + g.id + '">Mark graded</button></div></div>';
      }
      body.innerHTML = html;
      body.querySelectorAll("[data-g-done]").forEach(function (b) {
        b.onclick = async function () {
          var id = b.getAttribute("data-g-done");
          var est = body.querySelector('[data-g-est="' + id + '"]').value.trim();
          await sb.from("grading_submissions").update({ status: "graded", estimate: est || null }).eq("id", id);
          tabGrading(body);
        };
      });
    }

    /* ---- sellers ------------------------------------------------------------ */
    function tabPricing(body) {
      body.innerHTML =
        "<h3>💲 Grading Pricing Reference (Internal Only)</h3>" +
        "<h4>Labor ($30/hr)</h4>" +
        "<p>15 min = $7.50 &nbsp;|&nbsp; 20 min = $10 &nbsp;|&nbsp; 30 min = $15 &nbsp;|&nbsp; 45 min = $22.50 &nbsp;|&nbsp; 60 min = $30</p>" +
        "<h4>Slab (75pt thick)</h4><p>~$1.00 each (bulk)</p>" +
        "<h4>Shipping (1 lb)</h4><p>Ground Advantage $6-$7 &nbsp;|&nbsp; Priority $9-$11 &nbsp;|&nbsp; Small Flat Rate $12-$14 &nbsp;|&nbsp; UPS/FedEx $7-$9</p>" +
        "<h4>Insurance (third-party ~$0.60 per $100)</h4>" +
        "<p>$50 → $0.30 &nbsp;|&nbsp; $100 → $0.60 &nbsp;|&nbsp; $500 → $3 &nbsp;|&nbsp; $1,000 → $6 &nbsp;|&nbsp; $5,000 → $30 &nbsp;|&nbsp; $10,000 → $60</p>" +
        "<h4>Formula</h4><p><strong>Price = Labor + Slab + Shipping + Insurance + Profit</strong></p>" +
        "<h4>Examples</h4>" +
        "<p><strong>$50 card, 20 min:</strong> $10 + $1 + $7 + $0.30 = $18.30 cost → Charge $25</p>" +
        "<p><strong>$100 card, 30 min:</strong> $15 + $1 + $7 + $0.60 = $23.60 cost → Charge $35</p>" +
        "<p><strong>$1,000 card, 45 min:</strong> $22.50 + $1 + $10 + $6 = $39.50 cost → Charge $65</p>" +
        "<p><strong>$5,000 card, 60 min:</strong> $30 + $1 + $10 + $30 = $71 cost → Charge $120</p>";
    }

    async function tabSellers(body) {
      body.innerHTML = "<p>Loading sellers…</p>";
      var res = await sb.from("sellers").select("id,display_name,created_at").order("created_at", { ascending: false }).limit(100);
      if (res.error) { body.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
      var rows = (res.data || []).map(function (s) {
        return ["<strong>" + SR.esc(s.display_name || "—") + "</strong>", new Date(s.created_at).toLocaleDateString()];
      });
      body.innerHTML =
        "<h3>👥 Sellers (" + (res.data || []).length + ")</h3>" +
        (rows.length ? table(rows, ["Display name", "Joined"]) : "<p>No sellers yet.</p>");
    }

    /* ---- notes for cog ------------------------------------------------------ */
    async function tabNotes(body) {
      var sb = SR.dbDirect();
      var me = await SR.getUserDirect();
      var author = me && me.email ? me.email : "staff";
      body.innerHTML =
        "<h3>📝 Notes for Cog</h3>" +
        '<p style="color:var(--muted);font-size:.9rem">Leave directions for Cog (Store Manager). He checks this inbox regularly, does the work, and writes back here.</p>' +
        '<div class="form-card" style="margin-bottom:24px">' +
        "<label>Your note *</label>" +
        '<textarea id="sr-note-text" rows="3" style="width:100%;box-sizing:border-box" placeholder="e.g. Add a new product: Charizard poster, $20…"></textarea>' +
        '<div style="margin-top:14px"><button class="btn" id="sr-note-go">Send to Cog</button></div>' +
        '<div id="sr-note-msg"></div></div>' +
        '<div id="sr-note-list"><p>Loading notes…</p></div>';

      document.getElementById("sr-note-go").onclick = async function () {
        var msg = document.getElementById("sr-note-msg");
        var text = document.getElementById("sr-note-text").value.trim();
        if (!text) { SR.note(msg, "Write the note first.", "err"); return; }
        var ins = await sb.from("cog_notes").insert({ author: author, note: text });
        if (ins.error) { SR.note(msg, "⚠️ " + SR.esc(ins.error.message), "err"); return; }
        SR.note(msg, "✅ Sent. Cog will reply here.", "ok");
        document.getElementById("sr-note-text").value = "";
        loadNotes();
      };

      async function loadNotes() {
        var list = document.getElementById("sr-note-list");
        var res = await sb.from("cog_notes").select("*").order("created_at", { ascending: false }).limit(50);
        if (res.error) { list.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
        var notes = res.data || [];
        if (!notes.length) { list.innerHTML = "<p>No notes yet. Leave the first one above.</p>"; return; }
        list.innerHTML = notes.map(function (n) {
          return '<div class="form-card" style="margin-bottom:12px">' +
            '<p style="font-size:.8rem;color:var(--muted)">' + SR.esc(n.author) + " · " + new Date(n.created_at).toLocaleString() +
            ' · <strong>' + SR.esc(n.status) + "</strong></p>" +
            '<p style="white-space:pre-wrap">' + SR.esc(n.note) + "</p>" +
            (n.reply
              ? '<div style="margin-top:10px;padding:10px;border-left:3px solid var(--gold)"><strong>🤖 Cog:</strong>' +
                '<p style="white-space:pre-wrap;margin:6px 0 0">' + SR.esc(n.reply) + "</p>" +
                (n.replied_at ? '<p style="font-size:.78rem;color:var(--muted)">' + new Date(n.replied_at).toLocaleString() + "</p>" : "") +
                "</div>"
              : "") +
            "</div>";
        }).join("");
      }
      loadNotes();
    }
  };
})();
