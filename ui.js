const reduceMotion =
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function initHoverTyping() {
  const targets = Array.from(
    document.querySelectorAll(".site-nav .nav-link, .side .side-tab")
  );
  if (!targets.length) return;

  const timers = new WeakMap();

  const clear = (el) => {
    const t = timers.get(el);
    if (t != null) window.clearTimeout(t);
    timers.delete(el);
  };

  const stop = (el) => {
    clear(el);
    const label = String(el?.dataset?.typeLabel ?? "").trim();
    if (label) el.textContent = label;
    el.classList.remove("is-typing", "is-typed");
  };

  const start = (el) => {
    const label = String(el?.dataset?.typeLabel ?? "").trim();
    if (!label) return;

    if (reduceMotion) {
      el.classList.add("is-typed");
      return;
    }

    stop(el);
    el.classList.add("is-typing");
    el.textContent = "";

    const perChar = clamp(520 / Math.max(4, label.length), 24, 76);
    let i = 0;

    const tick = () => {
      i += 1;
      el.textContent = label.slice(0, i);
      if (i >= label.length) {
        el.classList.remove("is-typing");
        el.classList.add("is-typed");
        clear(el);
        return;
      }
      timers.set(el, window.setTimeout(tick, perChar));
    };

    tick();
  };

  for (const el of targets) {
    const label = String(el.textContent ?? "").trim();
    if (!label) continue;

    el.dataset.typeLabel = label;

    if (el.classList.contains("nav-link")) {
      const width = Math.ceil(el.getBoundingClientRect().width);
      if (Number.isFinite(width) && width > 0) el.style.minWidth = `${width}px`;
    }

    el.addEventListener("mouseenter", () => start(el));
    el.addEventListener("mouseleave", () => stop(el));
    el.addEventListener("focus", () => start(el));
    el.addEventListener("blur", () => stop(el));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHoverTyping, { once: true });
} else {
  initHoverTyping();
}

