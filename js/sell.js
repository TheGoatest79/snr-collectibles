/* ==========================================================================
   S&R Collectibles — seller sign-up + listing form (sell.html)
   Sign in (email/password) → sellers row created on first login →
   listing form → photo to product-images bucket + row in products.
   App rule: max 4 ACTIVE listings per seller.
   ========================================================================== */
(function () {
  "use strict";

  var MAX_ACTIVE = 4;

  SR.initSell = async function () {
    var authMount = document.getElementById("sr-auth");
    var formMount = document.getElementById("sr-listing");
    var myMount = document.getElementById("sr-my-listings");
    if (!authMount) return;

    if (!SR.isConfigured()) {
      SR.showSyncing(authMount);
      if (formMount) formMount.style.display = "none";
      if (myMount) myMount.style.display = "none";
      return;
    }
    var sb = SR.dbDirect();
    var user = await SR.getUserDirect();

    /* ---- auth card ------------------------------------------------------ */
    function renderAuth() {
      if (user) {
        authMount.innerHTML =
          '<div class="todo-note" style="border-color:var(--gold)">✅ Signed in as <strong>' +
          SR.esc(user.email) +
          '</strong> &nbsp;<button class="btn ghost" style="padding:4px 12px;font-size:.8rem" id="sr-sell-signout">Sign out</button></div>';
        document.getElementById("sr-sell-signout").onclick = SR.signOutDirect;
        if (formMount) formMount.style.display = "block";
        if (myMount) { myMount.style.display = "block"; loadMine(); }
        return;
      }
      authMount.innerHTML =
        '<div class="form-card"><h2 style="font-size:1.4rem">Seller sign-in</h2>' +
        '<p style="color:var(--muted);font-size:.9rem">New seller? Use the same form — your seller account is created automatically on first sign-in.</p>' +
        '<label for="sr-s-email">Email</label><input id="sr-s-email" type="email" placeholder="you@email.com">' +
        '<label for="sr-s-pass">Password</label><input id="sr-s-pass" type="password" placeholder="Choose a password">' +
        '<label for="sr-s-name">Display name <span style="color:var(--muted)">(shown to buyers)</span></label><input id="sr-s-name" placeholder="e.g. CardShark77">' +
        '<div style="margin-top:18px"><button class="btn" id="sr-s-go">Sign in / Create account</button></div>' +
        '<div id="sr-s-msg"></div></div>';
      if (formMount) formMount.style.display = "none";
      if (myMount) myMount.style.display = "none";

      /* Translate cryptic auth errors into plain language Ryan/Sam can act on.
         "Failed to fetch" is Supabase's network error — it means the phone
         never reached the database (VPN, Wi-Fi, or browser blocking it),
         not a wrong password. Don't burn a sign-up attempt on a dead
         connection, and don't show the raw jargon. */
      function authErrText(err) {
        var m = (err && err.message) || String(err || "Unknown error");
        if (/failed to fetch|network|load failed/i.test(m))
          return "📶 Your phone couldn't reach the store's database. Turn off VPN, check Wi-Fi / mobile data, then try again. If it keeps happening, try a different browser.";
        if (/already registered|already exists/i.test(m))
          return "That email already has an account — the password didn't match. Use the password you signed up with.";
        return "⚠️ " + m;
      }

      document.getElementById("sr-s-go").onclick = async function () {
        var email = document.getElementById("sr-s-email").value.trim();
        var pass = document.getElementById("sr-s-pass").value;
        var name = document.getElementById("sr-s-name").value.trim();
        var msg = document.getElementById("sr-s-msg");
        if (!email || !pass) { SR.note(msg, "Enter an email and password.", "err"); return; }
        SR.note(msg, "Signing you in…", "info");
        try {
          var r = await SR.signInDirect(email, pass);
          if (r.error) {
            if (/failed to fetch|network|load failed/i.test(r.error.message || "")) {
              SR.note(msg, authErrText(r.error), "err");
              return;
            }
            var s = await SR.signUpDirect(email, pass);
            if (s.error) { SR.note(msg, authErrText(s.error), "err"); return; }
            if (!s.data.session) {
              SR.note(msg, "📧 Account created — check your email for a confirmation link, then sign in.", "ok");
              return;
            }
            r = s;
          }
          var u = r.data.user || r.data.session.user;
          /* Direct-fetch seller row — do NOT use SR.ensureSellerRow (store.js),
             which goes through the Supabase JS library client. */
          await (SR.ensureSellerRowDirect
            ? SR.ensureSellerRowDirect(u, name)
            : SR.ensureSellerRow(u, name));
          user = await SR.getUserDirect();
          renderAuth();
        } catch (e) {
          SR.note(msg, authErrText(e), "err");
        }
      };
    }

    /* ---- listing form ---------------------------------------------------- */
    async function activeCount() {
      var res = await sb
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "active");
      return (res.data || []).length;
    }

    if (formMount) {
      formMount.innerHTML =
        '<div class="form-card"><h2 style="font-size:1.4rem">📋 List an item</h2>' +
        '<p style="color:var(--muted);font-size:.9rem">Up to <strong>4 live listings</strong> at a time. Flat <strong>9% fee</strong> only when it sells — no listing fees, no subscriptions.</p>' +
        '<div id="sr-l-cap" style="font-size:.9rem;margin-bottom:6px"></div>' +
        '<label for="sr-l-name">Item name *</label><input id="sr-l-name" placeholder="e.g. 1986 Fleer Michael Jordan #57">' +
        '<label for="sr-l-price">Price (USD) *</label><input id="sr-l-price" type="number" min="0" step="0.01" placeholder="25.00">' +
        '<label for="sr-l-type">Type *</label><select id="sr-l-type">' +
        ["trading-card", "comic", "coin", "currency", "collectible", "antique", "digital-art"].map(function (v) {
          return '<option value="' + v + '">' + v.replace("-", " ") + "</option>";
        }).join("") + "</select>" +
        '<label for="sr-l-condition">Condition</label><input id="sr-l-condition" placeholder="e.g. Near Mint">' +
        '<label for="sr-l-media">Physical or digital *</label><select id="sr-l-media"><option value="physical">Physical</option><option value="digital">Digital</option></select>' +
        '<label for="sr-l-cat">Shelf *</label><select id="sr-l-cat"><option value="cabinet">The Cabinet</option><option value="digital">Digital Dungeon</option><option value="budget">Budget Bin ($1 and up)</option></select>' +
        '<label for="sr-l-badge">Badge <span style="color:var(--muted)">(optional — e.g. HOT, 1-of-1)</span></label><input id="sr-l-badge" placeholder="">' +
        '<label for="sr-l-photo">Photo *</label><input id="sr-l-photo" type="file" accept="image/*">' +
        '<div style="margin-top:18px"><button class="btn" id="sr-l-go">List it — free</button></div>' +
        '<div id="sr-l-msg"></div></div>';

      document.getElementById("sr-l-go").onclick = async function () {
        var msg = document.getElementById("sr-l-msg");
        var name = document.getElementById("sr-l-name").value.trim();
        var price = Number(document.getElementById("sr-l-price").value);
        var file = document.getElementById("sr-l-photo").files[0];
        if (!name || !isFinite(price) || price < 0) { SR.note(msg, "Give your item a name and a price.", "err"); return; }
        if (!file) { SR.note(msg, "Add a photo — listings with photos sell.", "err"); return; }

        var n = await activeCount();
        var capEl = document.getElementById("sr-l-cap");
        capEl.innerHTML = "You have <strong>" + n + " / " + MAX_ACTIVE + "</strong> live listings.";
        if (n >= MAX_ACTIVE) {
          SR.note(msg, "You've hit the 4-listing cap. Mark something sold or remove it to list more.", "err");
          return;
        }

        SR.note(msg, "Uploading photo…", "info");
        var path = user.id + "/" + Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        var up = await sb.storage.from("product-images").upload(path, file);
        if (up.error) {
          SR.note(msg, "⚠️ Photo upload failed: " + SR.esc(up.error.message), "err");
          return;
        }
        var pub = sb.storage.from("product-images").getPublicUrl(path);

        SR.note(msg, "Listing your item…", "info");
        var ins = await sb.from("products").insert({
          seller_id: user.id,
          name: name,
          price: price,
          type: document.getElementById("sr-l-type").value,
          condition: document.getElementById("sr-l-condition").value.trim() || null,
          media: document.getElementById("sr-l-media").value,
          category: document.getElementById("sr-l-cat").value,
          badge: document.getElementById("sr-l-badge").value.trim() || null,
          img_url: pub.data.publicUrl,
          status: "active"
        });
        if (ins.error) {
          SR.note(msg, "⚠️ Couldn't create the listing: " + SR.esc(ins.error.message), "err");
          return;
        }
        SR.note(msg, "✅ <strong>Live!</strong> Your item is on the shelf.", "ok");
        document.getElementById("sr-l-name").value = "";
        document.getElementById("sr-l-price").value = "";
        document.getElementById("sr-l-photo").value = "";
        loadMine();
      };
    }

    /* ---- my listings ------------------------------------------------------ */
    async function loadMine() {
      if (!myMount || !user) return;
      var res = await sb
        .from("products")
        .select("id,name,price,status,img_url")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      if (res.error) {
        myMount.innerHTML = "";
        return;
      }
      var rows = res.data || [];
      myMount.innerHTML =
        '<div class="section-head" style="margin-top:28px"><h2>Your listings</h2></div>' +
        (rows.length
          ? '<div class="product-grid">' +
            rows.map(function (p) {
              return '<div class="product-card">' +
                (p.img_url
                  ? '<div class="ph"><img src="' + SR.esc(p.img_url) + '" alt="" loading="lazy"></div>'
                  : '<div class="ph">📷</div>') +
                '<div class="info"><h3>' + SR.esc(p.name) + "</h3>" +
                '<div class="price">' + SR.money(p.price) + "</div>" +
                '<div style="font-size:.82rem;color:var(--muted)">Status: ' + SR.esc(p.status) + "</div>" +
                (p.status === "active"
                  ? '<div style="display:flex;gap:8px;margin-top:8px">' +
                    '<button class="btn ghost" style="padding:6px 10px;font-size:.8rem" data-sold="' + p.id + '">Mark sold</button>' +
                    '<button class="btn ghost" style="padding:6px 10px;font-size:.8rem" data-remove="' + p.id + '">Remove</button></div>'
                  : "") +
                "</div></div>";
            }).join("") +
            "</div>"
          : '<p style="color:var(--muted)">No listings yet — your shelf is waiting.</p>');

      myMount.querySelectorAll("[data-sold]").forEach(function (b) {
        b.onclick = async function () {
          await sb.from("products").update({ status: "sold" }).eq("id", b.getAttribute("data-sold"));
          loadMine();
        };
      });
      myMount.querySelectorAll("[data-remove]").forEach(function (b) {
        b.onclick = async function () {
          if (!confirm("Remove this listing?")) return;
          await sb.from("products").update({ status: "removed" }).eq("id", b.getAttribute("data-remove"));
          loadMine();
        };
      });
    }

    renderAuth();
  };
})();
