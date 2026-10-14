/* ==========================================================================
   S&R Collectibles — 30-minute auction floor (auctions.html)
   Reads auctions, live-updates via realtime bids, bid form inserts to bids
   and bumps auctions.current_bid / current_bidder.
   NOTE: bidders must be signed in (email + password). A seller row is
   created automatically on first login.
   ========================================================================== */
(function () {
  "use strict";

  function fmtLeft(ms) {
    if (ms <= 0) return "ended";
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  SR.initAuctions = async function (mountId) {
    var mount = document.getElementById(mountId);
    if (!mount) return;
    if (!SR.isConfigured()) {
      SR.showSyncing(mount);
      return;
    }
    var sb = SR.db();
    var user = await SR.getUser();
    var auctions = [];

    /* ---- auth strip ---------------------------------------------------- */
    var authBar = document.createElement("div");
    authBar.className = "todo-note";
    authBar.style.marginBottom = "18px";
    mount.appendChild(authBar);

    var listWrap = document.createElement("div");
    mount.appendChild(listWrap);
    var statusLine = document.createElement("div");
    mount.appendChild(statusLine);

    function renderAuthBar() {
      if (user) {
        authBar.innerHTML =
          "🔨 Bidding as <strong>" +
          SR.esc(user.email) +
          '</strong> &nbsp;<button class="btn ghost" style="padding:4px 12px;font-size:.8rem" id="sr-auction-signout">Sign out</button>';
        document.getElementById("sr-auction-signout").onclick = SR.signOut;
      } else {
        authBar.innerHTML =
          "🔨 <strong>Sign in to bid.</strong> " +
          '<input id="sr-a-email" type="email" placeholder="you@email.com" style="margin:0 6px;padding:6px 10px;border-radius:6px;border:1px solid var(--line);background:#1a140d;color:var(--cream)"> ' +
          '<input id="sr-a-pass" type="password" placeholder="password" style="margin:0 6px;padding:6px 10px;border-radius:6px;border:1px solid var(--line);background:#1a140d;color:var(--cream)"> ' +
          '<button class="btn" style="padding:6px 14px" id="sr-a-go">Sign in / Join</button> ' +
          '<span style="font-size:.8rem;color:var(--muted)">New here? Signing in creates your bidder account automatically.</span>';
        document.getElementById("sr-a-go").onclick = async function () {
          var email = document.getElementById("sr-a-email").value.trim();
          var pass = document.getElementById("sr-a-pass").value;
          if (!email || !pass) {
            SR.note(statusLine, "Enter an email and password to bid.", "err");
            return;
          }
          SR.note(statusLine, "Signing you in…", "info");
          var r = await sb.auth.signInWithPassword({ email: email, password: pass });
          if (r.error) {
            var s = await sb.auth.signUp({ email: email, password: pass });
            if (s.error) {
              SR.note(statusLine, "⚠️ " + SR.esc(s.error.message), "err");
              return;
            }
            if (!s.data.session) {
              SR.note(statusLine, "📧 Account created — check your email for a confirmation link, then sign in.", "ok");
              return;
            }
            r = s;
          }
          await SR.ensureSellerRow(r.data.user || r.data.session.user);
          user = (await sb.auth.getUser()).data.user;
          SR.note(statusLine, "✅ You're in. Happy bidding.", "ok");
          renderAuthBar();
          render();
        };
      }
    }

    /* ---- auction cards --------------------------------------------------- */
    function auctionCard(a) {
      var now = Date.now();
      var endsMs = new Date(a.ends_at).getTime() - now;
      var live = a.status === "live" && endsMs > 0;
      var card = document.createElement("div");
      card.className = "feature";
      card.id = "auction-" + a.id;
      card.style.marginBottom = "16px";

      var badge = live
        ? '<span class="badge">🔴 LIVE — <span data-countdown="' + a.id + '">' + fmtLeft(endsMs) + "</span></span>"
        : a.status === "scheduled"
        ? '<span class="badge">⏳ Starts ' + new Date(a.starts_at).toLocaleString() + "</span>"
        : '<span class="badge">🏁 Ended</span>';

      card.innerHTML =
        (a.img_url
          ? '<div style="margin-bottom:10px"><img src="' + SR.esc(a.img_url) + '" alt="' + SR.esc(a.title) + '" style="width:100%;border-radius:8px" loading="lazy"></div>'
          : "") +
        badge +
        "<h3 style=\"margin-top:8px\">" + SR.esc(a.title) + "</h3>" +
        (a.description ? '<p style="font-size:.9rem">' + SR.esc(a.description) + "</p>" : "") +
        '<p style="font-size:1.15rem;margin:8px 0"><strong>Current bid: <span data-current-bid="' + a.id + '" style="color:var(--gold)">' + SR.money(a.current_bid) + "</span></strong></p>" +
        '<div data-bids="' + a.id + '" style="font-size:.85rem;color:var(--muted);margin-bottom:8px">Loading bids…</div>' +
        (live
          ? '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
            '<input data-bid-amt="' + a.id + '" type="number" min="0" step="0.01" placeholder="Your bid ($)" style="padding:8px 10px;border-radius:6px;border:1px solid var(--line);background:#1a140d;color:var(--cream);width:150px">' +
            '<button class="btn" data-bid-btn="' + a.id + '">Place bid</button></div>' +
            '<div style="font-size:.78rem;color:var(--muted);margin-top:6px">Must beat the current bid. 9% seller fee applies on the sale.</div>'
          : "");

      if (live) {
        card.querySelector('[data-bid-btn="' + a.id + '"]').onclick = function () {
          placeBid(a);
        };
      }
      return card;
    }

    async function loadBids(a) {
      var box = listWrap.querySelector('[data-bids="' + a.id + '"]');
      if (!box) return;
      var res = await sb
        .from("bids")
        .select("amount, created_at, bidder_id")
        .eq("auction_id", a.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (res.error || !res.data || !res.data.length) {
        box.textContent = res.data && res.data.length === 0 ? "No bids yet — be the first." : "Bid history unavailable.";
        return;
      }
      box.innerHTML = res.data
        .map(function (b) {
          return "<div>💰 <strong>" + SR.money(b.amount) + "</strong> · " + new Date(b.created_at).toLocaleTimeString() + "</div>";
        })
        .join("");
    }

    async function placeBid(a) {
      if (!user) {
        SR.note(statusLine, "Sign in above to place a bid.", "err");
        return;
      }
      var input = listWrap.querySelector('[data-bid-amt="' + a.id + '"]');
      var amount = Number(input.value);
      if (!isFinite(amount) || amount <= Number(a.current_bid)) {
        SR.note(statusLine, "Your bid must be higher than " + SR.money(a.current_bid) + ".", "err");
        return;
      }
      await SR.ensureSellerRow(user);
      var ins = await sb.from("bids").insert({
        auction_id: a.id,
        bidder_id: user.id,
        amount: amount
      });
      if (ins.error) {
        SR.note(statusLine, "⚠️ Bid rejected: " + SR.esc(ins.error.message), "err");
        return;
      }
      /* Bump the auction row too (a DB trigger is the belt-and-suspenders
         version — see CHANGELOG). Failure here is non-fatal: realtime
         refreshes the display from the bids table anyway. */
      try {
        await sb.from("auctions").update({ current_bid: amount, current_bidder: user.id }).eq("id", a.id);
      } catch (e) {}
      a.current_bid = amount;
      SR.note(statusLine, "✅ Bid placed: <strong>" + SR.money(amount) + "</strong> on “" + SR.esc(a.title) + "”.", "ok");
      input.value = "";
      refreshAuction(a.id);
    }

    async function refreshAuction(id) {
      var res = await sb.from("auctions").select("*").eq("id", id).single();
      if (res.data) {
        var i = auctions.findIndex(function (x) { return x.id === id; });
        if (i !== -1) auctions[i] = res.data;
        var el = listWrap.querySelector('[data-current-bid="' + id + '"]');
        if (el) el.textContent = SR.money(res.data.current_bid);
      }
      var a = auctions.find(function (x) { return x.id === id; });
      if (a) loadBids(a);
    }

    function render() {
      listWrap.innerHTML = "";
      if (!auctions.length) {
        listWrap.innerHTML =
          '<div class="empty-state" style="display:block"><div class="big">🔨</div>' +
          "<h3>No auctions on the floor</h3><p>New 30-minute flash auctions drop regularly. Check back soon.</p></div>";
        return;
      }
      auctions.forEach(function (a) {
        listWrap.appendChild(auctionCard(a));
        loadBids(a);
      });
    }

    /* ---- realtime: bids + auction updates -------------------------------- */
    function subscribe() {
      auctions.forEach(function (a) {
        sb.channel("sr-bids-" + a.id)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "bids", filter: "auction_id=eq." + a.id },
            function () { refreshAuction(a.id); }
          )
          .subscribe();
      });
      sb.channel("sr-auctions")
        .on("postgres_changes", { event: "*", schema: "public", table: "auctions" }, function () {
          load();
        })
        .subscribe();
    }

    /* ---- countdown ticker ------------------------------------------------- */
    setInterval(function () {
      document.querySelectorAll("[data-countdown]").forEach(function (el) {
        var a = auctions.find(function (x) { return x.id === el.getAttribute("data-countdown"); });
        if (!a) return;
        var left = new Date(a.ends_at).getTime() - Date.now();
        if (left <= 0) {
          el.textContent = "ended";
          if (a.status === "live") load();
        } else {
          el.textContent = fmtLeft(left);
        }
      });
    }, 1000);

    async function load() {
      var res = await sb
        .from("auctions")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(20);
      if (res.error) {
        SR.note(listWrap, "⚠️ Couldn't load auctions (" + SR.esc(res.error.message) + ").", "err");
        return;
      }
      auctions = res.data || [];
      renderAuthBar();
      render();
      subscribe();
    }

    sb.auth.onAuthStateChange(async function () {
      user = (await sb.auth.getUser()).data.user;
      renderAuthBar();
    });

    load();
  };
})();
