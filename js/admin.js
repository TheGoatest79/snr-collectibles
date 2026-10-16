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
        '<button class="btn ghost" data-tab="vault">🔐 Consignment Vault</button>' +
        '<button class="btn ghost" data-tab="auctions">⚡ Auctions</button>' +
        '<button class="btn ghost" data-tab="grading">🤖 Grading queue</button>' +
        '<button class="btn ghost" data-tab="sellers">👥 Sellers</button>' +
        '<button class="btn ghost" data-tab="pricing">💲 Pricing</button>' +
        '<button class="btn ghost" data-tab="notes">📝 Notes for Cog</button>' +
        '<button class="btn ghost" data-tab="messages">💬 Messages</button>' +
        '<button class="btn ghost" id="sr-ad-out" style="margin-left:auto">Sign out</button></div>' +
        '<div id="sr-ad-body"></div>';
      document.getElementById("sr-ad-out").onclick = SR.signOutDirect;
      var body = document.getElementById("sr-ad-body");
      dash.querySelectorAll("[data-tab]").forEach(function (b) {
        b.onclick = function () {
          dash.querySelectorAll("[data-tab]").forEach(function (x) { x.className = "btn ghost"; });
          b.className = "btn";
          ({ products: tabProducts, vault: tabVault, auctions: tabAuctions, grading: tabGrading, sellers: tabSellers, pricing: tabPricing, notes: tabNotes, messages: tabMessages })[b.getAttribute("data-tab")](body);
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

    /* ---- consignment vault (staff only) ------------------------------------- */
    async function tabVault(body) {
      body.innerHTML = "<p>Loading Consignment Vault…</p>";
      var res = await sb.from("products").select("*").eq("category", "vault").order("created_at", { ascending: false }).limit(200);
      if (res.error) { body.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
      var items = res.data || [];
      var rows = items.map(function (p) {
        var acts = "";
        if (p.status === "active")
          acts =
            '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-v-sold="' + p.id + '">Sold</button> ' +
            '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-v-rem="' + p.id + '">Remove</button> ' +
            '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-v-price="' + p.id + '" data-v-cur="' + p.price + '">Set price</button>';
        else if (p.status === "removed")
          acts = '<button class="btn ghost" style="padding:4px 10px;font-size:.78rem" data-v-act="' + p.id + '">Re-activate</button>';
        else
          acts = '<span style="color:var(--muted)">—</span>';
        return [
          p.img_url ? '<img src="' + SR.esc(p.img_url) + '" style="width:44px;height:44px;object-fit:cover;border-radius:6px">' : "—",
          "<strong>" + SR.esc(p.name) + "</strong><br><span style='color:var(--muted)'>" + SR.esc(p.type || "") + " · " + SR.esc(p.condition || "") + "</span>",
          SR.money(p.price),
          SR.esc(p.status),
          acts
        ];
      });
      body.innerHTML =
        "<h3>🔐 Consignment Vault (" + items.length + ")</h3>" +
        '<p style="color:var(--muted);font-size:.9rem">Staff only. Items here are NOT visible on the public site. Price them, then move to the Cabinet when ready to list.</p>' +
        '<div class="form-card" style="margin-bottom:24px;max-width:640px">' +
        "<h4>Add to Vault</h4>" +
        '<label>Item name *</label><input id="sr-v-name" placeholder="e.g. 1996-97 Topps Chrome #138 Kobe Bryant">' +
        '<label>Price (USD) *</label><input id="sr-v-price" type="number" min="0" step="0.01" placeholder="0.00">' +
        '<label>Type</label><input id="sr-v-type" placeholder="trading-card, comic, coin…">' +
        '<label>Condition</label><input id="sr-v-cond" placeholder="e.g. NM-MT">' +
        '<label>Photo URL</label><input id="sr-v-img" placeholder="https://…">' +
        '<label>Consignor <span style="color:var(--muted)">(who owns it)</span></label><input id="sr-v-seller" placeholder="e.g. Ryan, or customer name">' +
        '<div style="margin-top:14px"><button class="btn" id="sr-v-add">Add to Vault</button></div>' +
        '<div id="sr-v-msg"></div></div>' +
        (rows.length ? table(rows, ["", "Item", "Price", "Status", "Actions"]) : "<p>Vault's empty. Add the first consignment piece above.</p>");

      document.getElementById("sr-v-add").onclick = async function () {
        var msg = document.getElementById("sr-v-msg");
        var name = document.getElementById("sr-v-name").value.trim();
        var price = Number(document.getElementById("sr-v-price").value);
        if (!name || !isFinite(price) || price < 0) { SR.note(msg, "Name and price are required.", "err"); return; }
        var ins = await sb.from("products").insert({
          name: name,
          price: price,
          type: document.getElementById("sr-v-type").value.trim() || null,
          condition: document.getElementById("sr-v-cond").value.trim() || null,
          img_url: document.getElementById("sr-v-img").value.trim() || null,
          category: "vault",
          media: "physical",
          status: "active"
        });
        if (ins.error) { SR.note(msg, "⚠️ " + SR.esc(ins.error.message), "err"); return; }
        SR.note(msg, "✅ Added to the Vault.", "ok");
        tabVault(body);
      };

      async function setStatus(id, status) {
        await sb.from("products").update({ status: status }).eq("id", id);
        tabVault(body);
      }
      async function setPrice(id, cur) {
        var np = prompt("New price (USD):", cur);
        if (np === null) return;
        np = Number(np);
        if (!isFinite(np) || np < 0) { alert("Enter a valid price."); return; }
        await sb.from("products").update({ price: np }).eq("id", id);
        tabVault(body);
      }
      body.querySelectorAll("[data-v-sold]").forEach(function (b) { b.onclick = function () { setStatus(b.getAttribute("data-v-sold"), "sold"); }; });
      body.querySelectorAll("[data-v-rem]").forEach(function (b) { b.onclick = function () { setStatus(b.getAttribute("data-v-rem"), "removed"); }; });
      body.querySelectorAll("[data-v-act]").forEach(function (b) { b.onclick = function () { setStatus(b.getAttribute("data-v-act"), "active"); }; });
      body.querySelectorAll("[data-v-price]").forEach(function (b) { b.onclick = function () { setPrice(b.getAttribute("data-v-price"), b.getAttribute("data-v-cur")); }; });
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

    /* ---- customer direct messages ---------------------------------------- */
    async function tabMessages(body) {
      var sb = SR.dbDirect();
      body.innerHTML =
        "<h3>💬 Customer messages</h3>" +
        '<p style="color:var(--muted);font-size:.9rem">Direct message threads from customers and sellers. Click a thread to read and reply.</p>' +
        '<div id="sr-dm-list"><p>Loading threads…</p></div>' +
        '<div id="sr-dm-open"></div>';

      async function loadThreads() {
        var list = document.getElementById("sr-dm-list");
        var res = await sb.from("dm_threads").select("*").order("updated_at", { ascending: false }).limit(50);
        if (res.error) { list.innerHTML = "<p>⚠️ " + SR.esc(res.error.message) + "</p>"; return; }
        var threads = res.data || [];
        if (!threads.length) { list.innerHTML = "<p>No message threads yet.</p>"; return; }
        list.innerHTML = threads.map(function (t) {
          return '<div class="form-card" style="margin-bottom:10px;cursor:pointer" data-thread="' + t.id + '">' +
            '<p style="margin:0"><strong>' + SR.esc(t.subject || "Conversation") + "</strong> " +
            '<span style="font-size:.75rem;color:var(--muted)">' + SR.esc(t.status) + "</span></p>" +
            '<p style="font-size:.8rem;color:var(--muted);margin:6px 0 0">' + SR.esc(t.name) + " · " + SR.esc(t.email) +
            " · " + new Date(t.updated_at).toLocaleString() + "</p></div>";
        }).join("");
        list.querySelectorAll("[data-thread]").forEach(function (el) {
          el.onclick = function () { openThread(el.getAttribute("data-thread")); };
        });
      }

      async function openThread(tid) {
        var open = document.getElementById("sr-dm-open");
        var t = await sb.from("dm_threads").select("*").eq("id", tid).single();
        var m = await sb.from("dm_messages").select("*").eq("thread_id", tid).order("created_at", { ascending: true });
        var thread = t.data || {};
        var msgs = (m.data || []).map(function (x) {
          var cust = x.sender === "customer";
          return '<div style="margin-bottom:10px;padding:10px 14px;border-radius:10px;' +
            (cust ? "background:var(--panel)" : "background:#2a2118;border:1px solid var(--gold)") + '">' +
            '<p style="font-size:.75rem;color:var(--muted);margin:0 0 6px">' +
            (cust ? SR.esc(thread.name || "Customer") : "Staff") + " · " + new Date(x.created_at).toLocaleString() + "</p>" +
            '<p style="white-space:pre-wrap;margin:0">' + SR.esc(x.body) + "</p></div>";
        }).join("");
        open.innerHTML =
          "<hr><h3>" + SR.esc(thread.subject || "Conversation") + "</h3>" +
          '<p style="font-size:.85rem;color:var(--muted)">' + SR.esc(thread.name || "") + " · " + SR.esc(thread.email || "") +
          ' · <strong>' + SR.esc(thread.status || "") + "</strong></p>" +
          '<div style="max-width:640px">' + (msgs || "<p>No messages yet.</p>") + "</div>" +
          (thread.status === "open"
            ? '<div class="form-card" style="max-width:640px"><label>Reply as staff</label>' +
              '<textarea id="sr-dm-staff-reply" rows="3" style="width:100%;box-sizing:border-box"></textarea>' +
              '<div style="margin-top:12px"><button class="btn" id="sr-dm-staff-send">Send reply</button> ' +
              '<button class="btn ghost" id="sr-dm-close">Close thread</button></div>' +
              '<div id="sr-dm-staff-msg"></div></div>'
            : '<div style="margin-top:12px"><button class="btn ghost" id="sr-dm-reopen">Reopen thread</button></div>');
        var send = document.getElementById("sr-dm-staff-send");
        if (send) send.onclick = async function () {
          var st = document.getElementById("sr-dm-staff-msg");
          var txt = document.getElementById("sr-dm-staff-reply").value.trim();
          if (!txt) { SR.note(st, "Write the reply first.", "err"); return; }
          var ins = await sb.from("dm_messages").insert({ thread_id: tid, sender: "staff", body: txt });
          if (ins.error) { SR.note(st, "⚠️ " + SR.esc(ins.error.message), "err"); return; }
          await sb.from("dm_threads").update({ updated_at: new Date().toISOString() }).eq("id", tid);
          openThread(tid); loadThreads();
        };
        var close = document.getElementById("sr-dm-close");
        if (close) close.onclick = async function () {
          await sb.from("dm_threads").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", tid);
          openThread(tid); loadThreads();
        };
        var reopen = document.getElementById("sr-dm-reopen");
        if (reopen) reopen.onclick = async function () {
          await sb.from("dm_threads").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", tid);
          openThread(tid); loadThreads();
        };
      }
      loadThreads();
    }
  };
})();
