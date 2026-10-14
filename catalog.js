/* S&R product catalog — add inventory here later.
   Each product: { name, price, type, condition, media, category, badge }
   category: "vault" | "digital" | "budget"   (budget = $1-$5 items)
   type: "trading-card" | "comic" | "coin" | "currency" | "collectible" | "antique" | "digital-art"
   condition: "mint" | "near-mint" | "excellent" | "very-good" | "good" | "fair" | "digital"
   media: "physical" | "digital"
*/
const PRODUCTS = [
  // --- Digital Dungeon: authenticated digital collectibles (live 2026-10-07) ---
  { name: "Vault Guardian — 1-of-1", price: 49.00, type: "digital-art", condition: "digital", conditionLabel: "1-of-1 Original", media: "digital", category: "digital", badge: "1-of-1", img: "assets/digital/vault-guardian.webp", cert: "SNR-DIG-00001", edition: "1 of 1" },
  { name: "Mint State — 1-of-1", price: 39.00, type: "digital-art", condition: "digital", conditionLabel: "1-of-1 Original", media: "digital", category: "digital", badge: "1-of-1", img: "assets/digital/mint-state.webp", cert: "SNR-DIG-00002", edition: "1 of 1" },
  { name: "Copper Age Relic — 1-of-5", price: 19.00, type: "digital-art", condition: "digital", conditionLabel: "Limited Edition", media: "digital", category: "digital", badge: "1-of-5", img: "assets/digital/copper-age-relic.webp", cert: "SNR-DIG-00003", edition: "1 of 5" },
  { name: "The Oh-My! Burst — 1-of-5", price: 15.00, type: "digital-art", condition: "digital", conditionLabel: "Limited Edition", media: "digital", category: "digital", badge: "1-of-5", img: "assets/digital/oh-my-burst.webp", cert: "SNR-DIG-00004", edition: "1 of 5" },
  { name: "Bronze Vault — 1-of-5", price: 15.00, type: "digital-art", condition: "digital", conditionLabel: "Limited Edition", media: "digital", category: "digital", badge: "1-of-5", img: "assets/digital/bronze-vault.webp", cert: "SNR-DIG-00005", edition: "1 of 5" },
];

(function () {
  const grid = document.getElementById("product-grid");
  const empty = document.getElementById("empty-state");
  if (!grid) return;
  const pageCat = document.body.dataset.category || "vault";

  const q = document.getElementById("f-search");
  const t = document.getElementById("f-type");
  const c = document.getElementById("f-condition");
  const m = document.getElementById("f-media");
  const s = document.getElementById("f-sort");

  function money(n) { return "$" + n.toFixed(2); }

  function render() {
    let list = PRODUCTS.filter(p => p.category === pageCat);
    const query = (q.value || "").toLowerCase().trim();
    if (query) list = list.filter(p => p.name.toLowerCase().includes(query));
    if (t.value) list = list.filter(p => p.type === t.value);
    if (c.value) list = list.filter(p => p.condition === c.value);
    if (m.value) list = list.filter(p => p.media === m.value);
    if (s.value === "price-asc") list.sort((a, b) => a.price - b.price);
    if (s.value === "price-desc") list.sort((a, b) => b.price - a.price);
    if (s.value === "name") list.sort((a, b) => a.name.localeCompare(b.name));

    grid.innerHTML = "";
    if (!list.length) {
      grid.style.display = "none";
      empty.style.display = "block";
      return;
    }
    grid.style.display = "grid";
    empty.style.display = "none";
    list.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML =
        (p.img ? '<div class="ph"><img src="' + p.img + '" alt="' + p.name.replace(/"/g, "") + '" loading="lazy"></div>' : '<div class="ph">📷 Photo coming soon</div>') +
        '<div class="info">' +
          (p.badge ? '<span class="badge">' + p.badge + "</span>" : "") +
          "<h3>" + p.name + "</h3>" +
          '<div class="price">' + money(p.price) + "</div>" +
          '<div style="font-size:.82rem;color:var(--muted)">' + (p.conditionLabel || p.condition) + " · " + p.media + "</div>" +
          (p.cert ? '<div style="font-size:.78rem;color:var(--gold-deep)">📜 Cert ' + p.cert + " · Edition " + p.edition + "</div>" : "") +
          '<button class="btn disabled" disabled style="margin-top:8px">Coming soon</button>' +
        "</div>";
      grid.appendChild(card);
    });
  }

  [q, t, c, m, s].forEach(el => el && el.addEventListener("input", render));

  // Deep-link: shop.html?type=trading-card etc. pre-selects the Type filter
  try {
    const params = new URLSearchParams(window.location.search);
    const pt = params.get("type");
    if (pt && t) {
      const opt = Array.from(t.options).find(o => o.value === pt);
      if (opt) t.value = pt;
    }
  } catch (e) {}

  render();
})();
