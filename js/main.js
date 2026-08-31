/* ============================================================
   MageK Filmworks — site behavior
   ============================================================ */

/* ------------------------------------------------------------
   Where intake submissions go.

   Paste the endpoint from your form service here (Formspree,
   Basin, Netlify Forms, etc). Until you do, the form falls back
   to opening a prefilled email so the page still works.
   ------------------------------------------------------------ */
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "hello@magekfilmworks.com";

/* ---------- Hero slider ----------
   Hard cuts between frames, with a segmented bar that fills across each
   hold so the page shows where it is in the sequence. Swipeable, and it
   stops entirely for anyone who has asked for reduced motion. */
const slider = document.querySelector(".hero-slider");

if (slider) {
  const slides = Array.from(slider.querySelectorAll(".hero-slide"));
  const ticks = Array.from(document.querySelectorAll(".hero-tick"));
  const hold = Number(slider.dataset.hold) || 4200;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = null;

  const paintTicks = () => {
    ticks.forEach((tick, i) => {
      const fill = tick.querySelector("i");
      if (!fill) return;
      if (i < index) {
        tick.classList.add("is-done");
        fill.style.transition = "none";
        fill.style.width = "100%";
      } else if (i > index) {
        tick.classList.remove("is-done");
        fill.style.transition = "none";
        fill.style.width = "0%";
      } else {
        // The live tick: reset to zero with no transition, force the
        // browser to commit that, then animate across the hold.
        tick.classList.remove("is-done");
        fill.style.transition = "none";
        fill.style.width = "0%";
        void fill.offsetWidth;
        fill.style.transition = still ? "none" : `width ${hold}ms linear`;
        fill.style.width = "100%";
      }
    });
  };

  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
    paintTicks();
  };

  const start = () => {
    if (still || slides.length < 2) return;
    clearInterval(timer);
    timer = setInterval(() => show(index + 1), hold);
  };

  show(0);
  start();

  // Swipe, so the frames are browsable rather than only watchable.
  let touchX = null;
  slider.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 44) { show(index + (dx < 0 ? 1 : -1)); start(); }
    touchX = null;
  }, { passive: true });

  // Nothing advances while the tab is hidden — otherwise you come back
  // to a bar that has run on without you.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInterval(timer);
    else { paintTicks(); start(); }
  });
}

/* ---------- Mobile nav ---------- */
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".header-nav");

if (toggle && nav) {
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("is-open"));
  });

  // Jumping to a section left the menu covering it. Close on the way.
  nav.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  // Escape closes it too, and returns focus to the control that opened it.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ---------- Footer year ---------- */
const yearEl = document.querySelector(".year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Clients & Collaborators ----------
   Open on desktop where there's room, closed on phones where it would
   push the rest of the page down. 900px matches the layout breakpoint. */
const clients = document.querySelector("#clients-list");
if (clients) clients.open = window.innerWidth > 900;

/* ---------- Intake wizard ---------- */
const form = document.querySelector("#intake-form");

if (form) {
  const steps = Array.from(form.querySelectorAll(".step"));
  const markers = Array.from(form.querySelectorAll("#wizard-steps li"));
  const counter = form.querySelector("#wizard-current");
  const backBtn = form.querySelector("#wizard-back");
  const nextBtn = form.querySelector("#wizard-next");
  const sendBtn = form.querySelector("#wizard-send");
  const status = form.querySelector("#form-status");
  const done = document.querySelector("#intake-done");
  const last = steps.length - 1;

  let index = 0;

  const pad = (n) => String(n).padStart(2, "0");

  const render = () => {
    steps.forEach((step, i) => {
      step.hidden = i !== index;
    });

    markers.forEach((m, i) => {
      m.classList.toggle("is-current", i === index);
      m.classList.toggle("is-done", i < index);
      if (i === index) {
        m.setAttribute("aria-current", "step");
      } else {
        m.removeAttribute("aria-current");
      }
    });

    if (counter) counter.textContent = pad(index + 1);

    backBtn.hidden = index === 0;
    nextBtn.hidden = index === last;
    sendBtn.hidden = index !== last;
    status.textContent = "";
    status.classList.remove("is-error");
  };

  const clearError = (field) => {
    field.classList.remove("is-invalid");
    const msg = form.querySelector(`.field-error[data-for="${field.name}"]`);
    if (msg) msg.classList.remove("is-shown");
  };

  // Only the visible step is validated — hidden fieldsets would
  // otherwise block submission with errors nobody can see.
  const validateStep = () => {
    const step = steps[index];
    const fields = Array.from(step.querySelectorAll("input, select, textarea"));
    let firstBad = null;

    fields.forEach((field) => {
      if (field.checkValidity()) {
        clearError(field);
        return;
      }
      field.classList.add("is-invalid");
      const msg = form.querySelector(`.field-error[data-for="${field.name}"]`);
      if (msg) msg.classList.add("is-shown");
      if (!firstBad) firstBad = field;
    });

    if (firstBad) {
      status.textContent = "Check the highlighted fields.";
      status.classList.add("is-error");
      firstBad.focus();
      return false;
    }
    return true;
  };

  const goTo = (next) => {
    index = Math.max(0, Math.min(last, next));
    render();
    // Only pull the page if the wizard has scrolled out of view.
    const box = form.getBoundingClientRect();
    if (box.top < 0) form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  nextBtn.addEventListener("click", () => {
    if (validateStep()) goTo(index + 1);
  });

  backBtn.addEventListener("click", () => goTo(index - 1));

  // Clear an error the moment the person fixes it.
  form.addEventListener("input", (e) => {
    if (e.target.name) clearError(e.target);
  });

  // Conditional blocks (the streaming platforms list).
  form.querySelectorAll("input[type='radio']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const target = radio.dataset.reveal
        ? document.getElementById(radio.dataset.reveal)
        : null;
      form.querySelectorAll(`input[name="${radio.name}"]`).forEach((sibling) => {
        const block = sibling.dataset.reveal
          ? document.getElementById(sibling.dataset.reveal)
          : null;
        if (block && block !== target) block.hidden = true;
      });
      if (target) target.hidden = false;
    });
  });

  // Enter advances rather than submitting a half-filled form.
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && index !== last) {
      e.preventDefault();
      if (validateStep()) goTo(index + 1);
    }
  });

  const asText = (data) => {
    const merged = new Map();
    for (const [key, value] of data.entries()) {
      if (!value || key.startsWith("_")) continue;
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      merged.set(label, merged.has(label) ? `${merged.get(label)}, ${value}` : value);
    }
    return Array.from(merged, ([label, value]) => `${label}: ${value}`).join("\n");
  };

  const showDone = () => {
    form.hidden = true;
    if (done) {
      done.hidden = false;
      done.setAttribute("tabindex", "-1");
      done.focus();
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

    const data = new FormData(form);

    // No endpoint configured yet — hand it to the mail client rather
    // than silently dropping the inquiry.
    if (!FORM_ENDPOINT) {
      const subject = encodeURIComponent(
        `Project inquiry — ${data.get("name") || "website"}`
      );
      window.location.href =
        `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${encodeURIComponent(asText(data))}`;
      status.textContent = "Opening your email app…";
      return;
    }

    sendBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Sending…";

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      showDone();
    } catch (err) {
      sendBtn.disabled = false;
      status.classList.add("is-error");
      status.textContent = `Couldn't send that — email ${CONTACT_EMAIL} and we'll pick it up.`;
    }
  });

  render();
}
