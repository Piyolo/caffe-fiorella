/* ============================================================
   Caffè Fiorella — front-end only behaviour
   1) Scroll-driven translate/scale animations (no 3D / canvas)
   2) Nav solid-on-scroll
   3) Hero parallax (translate + scale only)
   4) Gallery lightbox (pure client-side state)
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Elements ---------- */
  var nav = document.getElementById("nav");
  var heroCup = document.getElementById("heroCup");
  var hero = document.querySelector(".hero");
  var driftEls = Array.prototype.slice.call(document.querySelectorAll("[data-drift]"));
  var revealEls = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  var stackCards = Array.prototype.slice.call(document.querySelectorAll(".stack-card"));

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ---------- Scroll engine: rAF-throttled ---------- */
  var ticking = false;

  function onScrollFrame() {
    ticking = false;
    var vh = window.innerHeight;
    var scrollY = window.pageYOffset;

    /* Nav background */
    if (nav) nav.classList.toggle("is-solid", scrollY > 40);

    /* Reveal elements: progress 0 -> 1 as they rise through the viewport */
    for (var i = 0; i < revealEls.length; i++) {
      var el = revealEls[i];
      var rect = el.getBoundingClientRect();
      // start when element top crosses 90% of viewport, done at 45%
      var start = vh * 0.9;
      var end = vh * 0.45;
      var p = clamp01((start - rect.top) / (start - end));
      el.style.setProperty("--p", p.toFixed(4));
    }

    /* Sticky stack: a covered card recedes (translate + scale) as the next slides over it */
    for (var s = 0; s < stackCards.length - 1; s++) {
      var nextTop = stackCards[s + 1].getBoundingClientRect().top;
      // 0 while the next card is still below the fold, 1 once it has risen past 35% of the viewport
      var cover = clamp01((vh - nextTop) / (vh * 0.65));
      stackCards[s].style.setProperty("--cover", cover.toFixed(4));
    }

    /* Hero parallax: translate + scale only */
    if (hero && !reduceMotion) {
      var heroRect = hero.getBoundingClientRect();
      if (heroRect.bottom > 0) {
        var hp = clamp01(-heroRect.top / vh); // 0 at top, 1 when scrolled past

        if (heroCup) {
          var tx = -40 * hp;
          var ty = -90 * hp;
          var sc = 1 - 0.14 * hp;
          heroCup.style.transform =
            "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) scale(" + sc.toFixed(4) + ")";
        }

        for (var d = 0; d < driftEls.length; d++) {
          var dEl = driftEls[d];
          var factor = parseFloat(dEl.getAttribute("data-drift")) || 0;
          var dy = -140 * factor * hp;
          var ds = 1 - 0.05 * factor * hp;
          dEl.style.transform =
            "translate3d(0," + dy.toFixed(2) + "px,0) scale(" + ds.toFixed(4) + ")";
          dEl.style.opacity = String(1 - hp * 0.85);
        }
      }
    }
  }

  function requestFrame() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScrollFrame);
    }
  }

  if (reduceMotion) {
    // Show everything immediately, no scroll animation
    revealEls.forEach(function (el) { el.style.setProperty("--p", "1"); });
    if (nav) nav.classList.toggle("is-solid", window.pageYOffset > 40);
  } else {
    window.addEventListener("scroll", requestFrame, { passive: true });
    window.addEventListener("resize", requestFrame);
    requestFrame();
  }

  /* ---------- Gallery lightbox ---------- */
  var frames = Array.prototype.slice.call(document.querySelectorAll(".frame"));
  var lightbox = document.getElementById("lightbox");
  var lbImage = document.getElementById("lbImage");
  var lbCaption = document.getElementById("lbCaption");
  var lbClose = document.getElementById("lbClose");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");
  var currentIndex = 0;
  var lastFocused = null;

  function showImage(index) {
    if (!frames.length) return;
    currentIndex = (index + frames.length) % frames.length;
    var frame = frames[currentIndex];
    var img = frame.querySelector("img");
    lbImage.src = img ? img.src : "";
    lbImage.alt = img ? img.alt : "";
    lbCaption.textContent = frame.getAttribute("data-caption") || (img ? img.alt : "");
  }

  function openLightbox(index) {
    lastFocused = document.activeElement;
    lightbox.hidden = false;
    // force reflow so opacity transition runs
    void lightbox.offsetWidth;
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
    showImage(index);
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    var done = function () {
      lightbox.hidden = true;
    };
    // wait for fade-out
    window.setTimeout(done, 320);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  frames.forEach(function (frame, i) {
    frame.setAttribute("tabindex", "0");
    frame.setAttribute("role", "button");
    frame.setAttribute("aria-label", "Enlarge image " + (i + 1));
    frame.addEventListener("click", function () { openLightbox(i); });
    frame.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(i);
      }
    });
  });

  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  if (lbPrev) lbPrev.addEventListener("click", function () { showImage(currentIndex - 1); });
  if (lbNext) lbNext.addEventListener("click", function () { showImage(currentIndex + 1); });

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!lightbox || lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") showImage(currentIndex - 1);
    else if (e.key === "ArrowRight") showImage(currentIndex + 1);
  });

  /* ---------- Graceful image fallback (offline / 404) ---------- */
  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener("error", function () {
      img.style.background =
        "repeating-linear-gradient(45deg, #d9c4a3 0 14px, #cbb08a 14px 28px)";
      img.style.minHeight = "180px";
      img.alt = img.alt || "Image unavailable";
    });
  });
})();
