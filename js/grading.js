/* ==========================================================================
   S&R Collectibles — photo grade request form (grading.html)
   Submits to grading_submissions + uploads photos to the grading-photos
   bucket. The self-grade quiz on this page stays fully client-side.

   NOTE: the deploy SQL currently grants grading-photos storage access to
   admins only. If anonymous uploads are blocked, the submission is still
   recorded and the visitor is asked to email photos instead. (One-line
   SQL fix documented in CHANGELOG.md.)
   ========================================================================== */
(function () {
  "use strict";

  var TYPE_MAP = {
    "Trading / sports card": "card",
    "Comic book": "comic",
    "Coin / paper money": "coin",
    "Other collectible": null
  };

  SR.initGradingForm = function () {
    var form = document.getElementById("sr-grade-form");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = document.getElementById("sr-g-msg");

      if (!SR.isConfigured()) {
        SR.note(msg, "🔌 The grading desk is syncing — try again shortly.", "info");
        return;
      }
      var sb = SR.db();

      var typeLabel = document.getElementById("pg-type").value;
      var desc = document.getElementById("pg-desc").value.trim();
      var name = document.getElementById("pg-name").value.trim();
      var email = document.getElementById("pg-email").value.trim();
      var front = document.getElementById("pg-front").files[0];
      var back = document.getElementById("pg-back").files[0];
      var details = document.getElementById("pg-detail").files;

      if (!front || !back) {
        SR.note(msg, "Front and back photos are required.", "err");
        return;
      }
      if (!name || !email) {
        SR.note(msg, "Add your name and email so we can send the grade.", "err");
        return;
      }

      SR.note(msg, "📤 Uploading your photos…", "info");

      var folder = "web-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      var photoFailed = false;

      async function uploadOne(file, label) {
        if (!file) return null;
        var path = folder + "/" + label + "-" + file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        try {
          var up = await sb.storage.from("grading-photos").upload(path, file);
          if (up.error) throw up.error;
          return path;
        } catch (err) {
          photoFailed = true;
          return null;
        }
      }

      var frontPath = await uploadOne(front, "front");
      var backPath = await uploadOne(back, "back");
      var closeupPath = null;
      if (details && details.length) {
        /* Store the first close-up; extras ride along in notes count. */
        closeupPath = await uploadOne(details[0], "closeup");
      }

      var notes =
        "Name: " + name + "\nItem: " + typeLabel + "\nDescription: " + (desc || "(none given)") +
        "\nPhotos: front(" + (frontPath ? "ok" : "missing") + ") back(" + (backPath ? "ok" : "missing") +
        ") close-ups(" + (details ? details.length : 0) + ")";

      var ins = await sb.from("grading_submissions").insert({
        submitter_email: email,
        item_type: TYPE_MAP[typeLabel] === undefined ? null : TYPE_MAP[typeLabel],
        front_img: frontPath,
        back_img: backPath,
        closeup_img: closeupPath,
        notes: notes,
        status: "pending"
      });

      if (ins.error) {
        SR.note(msg, "⚠️ Couldn't send your request: " + SR.esc(ins.error.message), "err");
        return;
      }

      if (photoFailed) {
        SR.note(
          msg,
          "✅ Request received! But your photos couldn't attach automatically — please email them to us and mention <strong>" +
            SR.esc(desc || typeLabel) +
            "</strong>.",
          "ok"
        );
      } else {
        SR.note(
          msg,
          "✅ <strong>Photos received!</strong> Sam &amp; Ryan will reply to <strong>" +
            SR.esc(email) +
            "</strong> with an honest estimated grade — usually within a couple of days.",
          "ok"
        );
      }
      form.reset();
      ["pg-front-prev", "pg-back-prev"].forEach(function (id) {
        var img = document.getElementById(id);
        if (img) img.style.display = "none";
      });
      var mp = document.getElementById("pg-detail-prev");
      if (mp) mp.innerHTML = "";
    });
  };
})();
