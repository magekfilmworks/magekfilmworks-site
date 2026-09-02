/* ============================================================
   Magek Filmworks — site behavior
   ============================================================ */

/* ------------------------------------------------------------
   Where intake submissions go.

   Paste the endpoint from your form service here (Formspree,
   Basin, Netlify Forms, etc). Until you do, the form falls back
   to opening a prefilled email so the page still works.
   ------------------------------------------------------------ */
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "info@magekfilmworks.productions";

/* ---------- Hero slider ----------
   A multi-format rotation: photographs, a clip we host that plays in the
   frame, and a clip hosted elsewhere that shows its poster and opens in
   the lightbox. Hard cuts, with a segmented bar filling across each
   hold. Swipeable, and it stops entirely for reduced motion.

   The hold is 8s. It was 20 — the headline's whole cycle, so every
   slide landed exactly as "We" rose — but that made reaching the fifth
   slide an 80-second wait. Strict sync and a quick rotation cannot both
   be had: holding to the headline's beat means every slide must consume
   a multiple of 20s. 8s keeps a rhythm without the wait, and a clip
   runs two holds so it has room to play. */
/* Credits ride on a data attribute as JSON — a credit can carry a URL,
   and every cheap separator turns up inside one ('https://' has the
   colon, a company name may have the pipe or the dash). Bad JSON returns
   nothing rather than throwing: a malformed credit should cost the
   credit line, not the whole page's scripting. */
function readCredits(raw) {
  if (!raw) return [];
  try {
    const out = JSON.parse(raw);
    return Array.isArray(out) ? out : [];
  } catch (e) {
    return [];
  }
}

const slider = document.querySelector(".hero-slider");

if (slider) {
  const slides = Array.from(slider.querySelectorAll(".hero-slide"));
  const ticks = Array.from(document.querySelectorAll(".hero-tick"));
  const hold = Number(slider.dataset.hold) || 4200;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = null;

  const isVideo = (el) => el && el.tagName === "VIDEO";

  /* A hosted clip ships with data-src, not src, so landing on the page
     costs a photograph rather than 9.5MB. The file is attached the first
     time its slide is reached, and the slide after the current one is
     armed early so it has a head start on buffering. */
  const arm = (el) => {
    if (isVideo(el) && !el.src && el.dataset.src) el.src = el.dataset.src;
  };

  const resetTick = (i) => {
    const fill = ticks[i] && ticks[i].querySelector("i");
    if (!fill) return;
    fill.style.transition = "none";
    fill.style.width = "0%";
  };

  // A photograph's tick is animated by CSS across a fixed hold. A video's
  // is driven by the video's own clock, so the bar measures the clip
  // rather than guessing at it — and it stays honest if playback stalls
  // while buffering.
  const runTick = (i, ms) => {
    const fill = ticks[i] && ticks[i].querySelector("i");
    if (!fill) return;
    fill.style.transition = "none";
    fill.style.width = "0%";
    void fill.offsetWidth;
    fill.style.transition = still ? "none" : `width ${ms}ms linear`;
    fill.style.width = "100%";
  };

  const trackVideo = (video, i) => {
    const fill = ticks[i] && ticks[i].querySelector("i");
    if (!fill) return;
    fill.style.transition = "none";
    const onTime = () => {
      if (!video.duration) return;
      fill.style.width = `${(video.currentTime / video.duration) * 100}%`;
    };
    video.addEventListener("timeupdate", onTime);
    video.__onTime = onTime;
  };

  const untrackVideo = (video) => {
    if (video && video.__onTime) {
      video.removeEventListener("timeupdate", video.__onTime);
      delete video.__onTime;
    }
  };

  /* The play panel. A slide carrying video data offers it; any other
     slide hides it. The panel is a [data-reel] button, so filling in its
     dataset is all that is needed — the lightbox handler elsewhere in
     this file reads those attributes at click time, not at load. */
  const play = document.querySelector(".hero-play");

  const stage = slider.closest(".hero");

  /* Restarting the headline sequence from its first frame.

     The sequence is a CSS animation on a fixed loop and the slider is a
     setTimeout on another. Aligning the two durations keeps them in step
     while nothing interrupts, but a video slide hides the headline for
     two holds and the animation keeps running underneath — so the
     headline could return to a fresh slide already mid-cycle and start
     fading a second after it landed. Clearing the inline animation and
     forcing a reflow restarts it from 0%; the per-beat delays come back
     with the cleared inline style, so the stagger is preserved. */
  const beats = stage ? stage.querySelectorAll(".seq-we, .seq-line") : [];
  const restartSeq = () => {
    beats.forEach((b) => { b.style.animation = "none"; });
    if (beats.length) void beats[0].offsetWidth;
    beats.forEach((b) => { b.style.animation = ""; });
  };

  let screening = false;

  /* Keeping the control off the subhead.

     The ring belongs on the frame's centre line and the subhead stays up
     on every slide, and at some viewports those two wants collide — the
     plate hangs into the subhead's first line. Which viewports is not
     something a breakpoint can predict: the hero's height comes from
     three different min-height rules and the plate's height comes from
     how many credits the clip carries, so the overlap appeared at
     1440x860 and 390x780 but not at 1470x912 or 430x932. A fixed lift
     tuned against that list still missed 360x740.

     So it is measured instead. Lift by exactly the overlap and no more:
     the ring stays centred wherever there is room, and only gives that
     up where the alternative is covering the sentence. */
  const sub = stage && stage.querySelector(".hero-sub");

  const GAP = 16;   // breathing room between the plate and the sentence

  const fitPlay = () => {
    if (!play || play.hidden || !sub || !stage) return;
    /* Computed from layout, not from the control's own rectangle. The
       entrance animation is running when this is called, so a
       getBoundingClientRect() on the control reports wherever the
       keyframe has it at that instant — which silently added the
       animation's 12px offset to every measurement. offsetHeight is the
       laid-out height and does not move with a transform. */
    const heroBox = stage.getBoundingClientRect();
    const ring = play.querySelector(".hero-play-mark").offsetHeight;
    // The ring is last, so the control's bottom edge is the ring's, and
    // the CSS parks that at the frame's centre plus half a ring.
    // Where the CSS wants the ring: centre line plus half a ring, plus
    // the deliberate drop below centre.
    const drop = parseFloat(
      getComputedStyle(play).getPropertyValue("--play-drop")) || 0;
    // Ring first, so the control's top edge is the ring's top edge.
    const bottom = heroBox.top + heroBox.height / 2 - ring / 2
                 + play.offsetHeight + drop;
    const top = bottom - play.offsetHeight;

    /* Two edges, and the control is squeezed between them. Rising clears
       the subhead below and moves the plate toward the masthead above;
       the plate went under the header at 375x667 with the ring exactly
       centred. So: rise as far as the subhead demands, but no further
       than the header allows — and if the header alone is already the
       problem, `room` goes negative and the same number pushes the
       control down instead. One value, both directions. */
    const header = document.querySelector("header");
    const headBottom = header ? header.getBoundingClientRect().bottom : 0;

    const wantUp = bottom + GAP - sub.getBoundingClientRect().top;
    const room = top - (headBottom + GAP);

    const lift = Math.min(Math.max(0, wantUp), room);
    play.style.setProperty("--play-lift", `${Math.round(lift)}px`);
  };

  let fitTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitPlay, 120);
  });

  const offerVideo = (slide, manual) => {
    if (!play) return;
    const d = slide && slide.dataset;

    // The headline and the play control both want the middle of the
    // frame. Rather than shuffle one around the other, the hero shows
    // one thing at a time: while a clip is up, the sequence steps back.
    const wantsScreen = !!(d && d.videoTitle);
    if (stage) stage.classList.toggle("is-screening", wantsScreen);

    // Only on the transition back, never on every photo slide. A run of
    // two stills is one headline cycle: the beats play over the first
    // and the frame rests over the second. Restarting on each of them
    // would replay the headline and delete the rest.
    // A jump the visitor asked for is a fresh start, the same as coming
    // back from a clip: they chose this slide, so the headline plays for
    // it rather than landing mid-cycle on whatever the clock had reached.
    if ((screening || manual) && !wantsScreen) restartSeq();
    screening = wantsScreen;

    if (!d || !d.videoTitle) {
      play.hidden = true;
      return;
    }

    // Clear both sources first: a YouTube slide following a local one
    // would otherwise keep the stale src and open the wrong clip.
    delete play.dataset.src;
    delete play.dataset.poster;
    delete play.dataset.youtube;

    if (d.videoYoutube) {
      play.dataset.youtube = d.videoYoutube;
    } else {
      play.dataset.src = d.videoSrc;
      play.dataset.poster = d.videoPoster;
    }
    play.dataset.label = d.videoTitle;

    play.querySelector(".hero-play-title").textContent = d.videoTitle;
    play.querySelector(".hero-play-tags").textContent = d.videoTags || "";
    play.querySelector(".hero-play-time").textContent = d.videoTime || "";

    /* Collaboration credits. "Produced by Dent Digital · Streamed by
       Magek Filmworks" — the role set faint and the house set in ink, so
       the eye lands on who did the work rather than on the preposition.
       pages.py refuses to build a clip that credits a partner without
       also saying what this house did. */
    const cr = play.querySelector(".hero-play-credits");
    cr.textContent = "";
    readCredits(d.videoCredits).forEach(([role, who]) => {
      const line = document.createElement("span");
      line.className = "hero-credit";
      const r = document.createElement("i");
      r.textContent = role;
      line.append(r, document.createTextNode(who));
      cr.appendChild(line);
    });
    cr.hidden = !cr.childElementCount;

    // The plate is itself the lightbox trigger, so it has to carry the
    // caption's data too — the link included, which only the lightbox
    // will render.
    play.dataset.metaTags = d.videoTags || "";
    play.dataset.metaTime = d.videoTime || "";
    if (d.videoCredits) play.dataset.credits = d.videoCredits;
    else delete play.dataset.credits;

    play.hidden = false;
    fitPlay();
    // Restart the entrance animation on every appearance.
    play.style.animation = "none";
    void play.offsetWidth;
    play.style.animation = "";
  };

  const show = (next, manual) => {
    const leaving = slides[index];
    if (isVideo(leaving)) leaving.pause();

    index = (next + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
    ticks.forEach((t, i) => {
      if (i !== index) resetTick(i);
      t.classList.toggle("is-live", i === index);
      if (i === index) t.setAttribute("aria-current", "true");
      else t.removeAttribute("aria-current");
    });

    clearTimeout(timer);
    const current = slides[index];
    offerVideo(current, manual);
    arm(slides[(index + 1) % slides.length]);

    if (isVideo(current)) {
      // The bar measures the time the slide is on screen, not the clip's
      // full length. The hero shows a teaser — two holds of a 38s clip —
      // so a bar scaled to the whole duration crawled to 40% and jumped
      // away, which read as no bar at all.
      runTick(index, 2 * hold);
      arm(current);
      if (still) {
        // No autoplay for reduced motion — hold on the poster and move
        // on, rather than parking on a frame that will never advance.
        timer = setTimeout(() => show(index + 1), hold);
        return;
      }
      current.currentTime = 0;

      // Two holds for a clip, so it has room to run without parking the
      // rotation for its whole length. The hero is a teaser; the
      // lightbox is where a clip is watched end to end.
      const runFor = () => {
        clearTimeout(timer);
        timer = setTimeout(() => show(index + 1), 2 * hold);
      };
      if (current.readyState >= 1) runFor();
      else current.addEventListener("loadedmetadata", runFor, { once: true });

      const play = current.play();
      if (play && play.catch) {
        // Autoplay refused (a data-saver setting, say). Don't strand the
        // slider on a frame that will never advance — treat it as a
        // still and move on after the normal hold.
        play.catch(() => {
          runTick(index, hold);
          timer = setTimeout(() => show(index + 1), hold);
        });
      }
      return;
    }

    runTick(index, hold);
    if (!still && slides.length > 1) {
      timer = setTimeout(() => show(index + 1), hold);
    }
  };

  // A finished clip no longer advances the slider on its own: the beat
  // does that, so the rotation stays in step with the headline. It just
  // holds on its last frame for the remainder.
  slides.filter(isVideo).forEach((video) => {
    video.addEventListener("ended", () => {
      const fill = ticks[slides.indexOf(video)];
      if (fill && fill.querySelector("i")) fill.querySelector("i").style.width = "100%";
    });
  });

  /* The bars are the picker. They were already the only thing on screen
     saying how many slides there are and which one is up, so they are
     where a visitor looks to change it — a second row of dots would be
     the same information twice.

     A click does not stop the rotation. The bars are a way to reach the
     clip you saw go past, not a transport: pausing on the chosen slide
     would leave the hero dead for anyone who clicked out of curiosity
     and then looked away. */
  ticks.forEach((tick, i) => {
    tick.addEventListener("click", () => {
      if (i === index) return;   // already here; a restart would look like a glitch
      show(i, true);
    });
  });

  const start = () => {
    if (still || slides.length < 2) return;
    show(index);
  };

  show(0);

  // Swipe, so the frames are browsable rather than only watchable.
  let touchX = null;
  slider.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 44) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  }, { passive: true });

  // Nothing advances while the tab is hidden — otherwise you come back to
  // a bar that has run on without you, or a clip that played to an empty
  // room.
  document.addEventListener("visibilitychange", () => {
    const current = slides[index];
    if (document.hidden) {
      clearTimeout(timer);
      if (isVideo(current)) current.pause();
    } else {
      show(index);
    }
  });
}

/* ---------- Reel lightbox ----------
   One dialog, two sources. A dialog rather than a hand-rolled overlay:
   the browser handles the focus trap, Escape, and returning focus to
   whichever button opened it.

   The player is built on open and torn down on close, whichever kind it
   is. For YouTube that keeps their cookies and tracking out of a visit
   where nobody asked to watch anything — nothing is requested from
   youtube.com until a click. For the local clip it keeps 9.5MB off the
   wire for the same reason. Tearing the node out is also the only
   reliable way to stop playback: a hidden iframe keeps playing audio.
   ------------------------------------------------------------------ */
const reelDialog = document.querySelector("#reel");
const reelFrame = reelDialog && reelDialog.querySelector("[data-reel-frame]");

if (reelDialog && reelFrame) {
  const buildYouTube = (id, label) => {
    const iframe = document.createElement("iframe");
    // nocookie host, and no related-video grid from other channels at the end
    iframe.src =
      `https://www.youtube-nocookie.com/embed/${id}` +
      "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    iframe.title = label;
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    return iframe;
  };

  const buildVideo = (src, poster) => {
    const video = document.createElement("video");
    video.className = "reel-video";
    video.controls = true;
    video.playsInline = true;
    // No autoplay: the clip opens on its poster and waits to be started.
    // preload="metadata" fetches headers only, so the duration and the
    // scrubber are right without pulling 9.5MB down for a viewer who
    // opened the box and changed their mind.
    video.preload = "metadata";
    if (poster) video.poster = poster;
    const source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    video.appendChild(source);
    return video;
  };

  const teardown = () => {
    const player = reelFrame.querySelector("iframe, video");
    if (!player) return;
    // Pause first: removing a <video> mid-play can leave the fetch running.
    if (typeof player.pause === "function") player.pause();
    player.remove();
  };

  /* The caption under the player. It is the only place a credit can be
     a link: everywhere else a credit sits inside a <button>, where an
     <a> has no valid home and the click would have two meanings. It is
     also the right place — you are already watching the clip when you
     decide you want the collaborator. */
  const cap = reelDialog.querySelector("[data-reel-cap]");

  const fillCap = (btn) => {
    if (!cap) return;
    const d = btn.dataset;
    cap.querySelector("[data-cap-title]").textContent = d.label || "";
    cap.querySelector("[data-cap-tags]").textContent = d.metaTags || "";
    cap.querySelector("[data-cap-time]").textContent = d.metaTime || "";

    const box = cap.querySelector("[data-cap-credits]");
    box.textContent = "";
    (readCredits(d.credits)).forEach(([role, who, url]) => {
      const line = document.createElement("p");
      line.className = "reel-credit";
      const r = document.createElement("i");
      r.textContent = role;
      let name;
      if (url) {
        name = document.createElement("a");
        name.href = url;
        // Set here rather than by the build's externalise() pass, which
        // only ever sees markup in the files — this anchor does not
        // exist until a click.
        name.target = "_blank";
        name.rel = "noopener noreferrer";
      } else {
        name = document.createElement("span");
      }
      name.textContent = who;
      line.append(r, name);
      box.appendChild(line);
    });
    cap.hidden = !(d.label || box.childElementCount);
  };

  const open = (btn) => {
    teardown(); // in case a previous player is somehow still mounted
    const label = btn.dataset.label || "Video";
    reelDialog.setAttribute("aria-label", label);
    fillCap(btn);
    reelFrame.appendChild(
      btn.dataset.youtube
        ? buildYouTube(btn.dataset.youtube, label)
        : buildVideo(btn.dataset.src, btn.dataset.poster)
    );
    if (typeof reelDialog.showModal === "function") reelDialog.showModal();
    else reelDialog.setAttribute("open", "");
  };

  const close = () => {
    if (typeof reelDialog.close === "function") reelDialog.close();
    else { reelDialog.removeAttribute("open"); teardown(); }
  };

  document.querySelectorAll("[data-reel]").forEach((btn) => {
    btn.addEventListener("click", () => open(btn));
  });

  reelDialog.querySelectorAll("[data-reel-close]").forEach((btn) => {
    btn.addEventListener("click", close);
  });

  // A click that lands outside the player rectangle is a backdrop click.
  reelDialog.addEventListener("click", (e) => {
    if (e.target.closest("[data-reel-close]")) return;
    const box = reelFrame.getBoundingClientRect();
    const outside =
      e.clientX < box.left || e.clientX > box.right ||
      e.clientY < box.top || e.clientY > box.bottom;
    if (outside) close();
  });

  // Covers Escape too — the dialog fires close however it was dismissed.
  reelDialog.addEventListener("close", teardown);
}

/* ---------- Contact map ----------
   Held back until it is nearly in view. The iframe ships with data-src
   rather than src, so nothing reaches Google until someone scrolls to
   the bottom of the page — loading="lazy" was measured and does not
   defer a cross-origin frame reliably in Chromium, which fetched it on
   load from 2818px below the fold. rootMargin starts the fetch a
   screen early so it has arrived by the time it is looked at.
   ------------------------------------------------------------------ */
const mapFrame = document.querySelector(".contact-map iframe[data-src]");
if (mapFrame) {
  const load = () => {
    if (mapFrame.src) return;
    mapFrame.src = mapFrame.dataset.src;
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        load();
        io.disconnect();
      });
    }, { rootMargin: "600px 0px" });
    io.observe(mapFrame);
  } else {
    load(); // no observer, no deferral — better a map than a blank box
  }
}

/* ---------- Brand marks ----------
   A click drives the mark to the bottom of its travel and holds it
   there. It comes back up when the visitor moves the mouse — not on a
   timer — so the gesture behaves like a physical key rather than an
   animation that plays at you.

   Three things that have to be handled or it sticks down forever:

   - A click carries a pixel or two of jitter. Movement only counts past
     a threshold, or the mark would release before you saw it go down.
   - Touch and keyboard produce no pointermove at all. Both fall back to
     a short hold, since there is no "moves the mouse" for either.
   - A pointer that leaves the window stops firing pointermove, so blur
     and pointerleave release it too, and a long safety timer catches
     anything left.

     Two traps in that last part. pointerleave must be bound to the root
     element WITHOUT capture — on document with capture:true it receives
     every element's pointerleave during the capture phase, so scrolling
     the page under a stationary cursor released the hold instantly.
     And scroll must not be a release trigger at all: clicking the mark
     scrolls to the top, which would fire it before the press was seen.
   ------------------------------------------------------------------ */
const MOVE_TO_RELEASE = 6; // px of real travel, not click jitter
const RELEASE_DELAY = 220; // ms the mark stays down after the pointer moves

function holdOnClick(el, onActivate) {
  if (!el) return;

  let origin = null;
  let safety = null;
  let rising = null;

  const detach = () => {
    origin = null;
    clearTimeout(safety);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("blur", release, true);
    document.documentElement.removeEventListener("pointerleave", release);
  };

  const release = () => {
    if (!el.classList.contains("is-held")) return;
    // Stop listening straight away — the decision is made — but let the
    // mark sit down a beat longer before it comes up. Releasing on the
    // exact frame the mouse twitches reads as a glitch; a short hold
    // after makes it read as a deliberate return.
    detach();
    clearTimeout(rising);
    rising = setTimeout(() => el.classList.remove("is-held"), RELEASE_DELAY);
  };

  const onMove = (e) => {
    if (!origin) return release();
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (Math.hypot(dx, dy) >= MOVE_TO_RELEASE) release();
  };

  el.addEventListener("click", (e) => {
    if (onActivate) onActivate(e);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // detail is 0 for a keyboard-activated click, 1+ for a real one.
    const fromPointer = e.detail > 0;
    const hasPointer = window.matchMedia("(hover: hover)").matches;
    const willGetMovement = fromPointer && hasPointer;

    // A fresh press cancels a return already in flight, or the new
    // press would be undone by the previous one's timer.
    clearTimeout(rising);
    el.classList.add("is-held");
    origin = willGetMovement ? { x: e.clientX, y: e.clientY } : null;

    if (willGetMovement) {
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("blur", release, true);
      document.documentElement.addEventListener("pointerleave", release);
      safety = setTimeout(release, 6000);
    } else {
      // A finger or a keypress: nothing is coming to release it.
      safety = setTimeout(release, 280);
    }
  });
}

const brand = document.querySelector(".brand");
if (brand) {
  const isCurrentPage = () => {
    const here = location.pathname.replace(/\/index\.html$/, "/");
    const there = brand.pathname.replace(/\/index\.html$/, "/");
    return here === there;
  };

  holdOnClick(brand, (e) => {
    // On the page you are already on the link would reload it for
    // nothing. Go to the top instead.
    if (!isCurrentPage()) return;
    e.preventDefault();
    const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: motionOK ? "smooth" : "auto" });
  });
}

/* The footer disc only ever goes to the top of the page it is already
   on. href="#top" is a spec-defined special case that works with no
   element of that id, so it still does the right thing unscripted. */
holdOnClick(document.querySelector(".footer-mark-link"), (e) => {
  e.preventDefault();
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: motionOK ? "smooth" : "auto" });
});

/* ---------- Clients disclosure cue ----------
   The chevron beside "Clients & Collaborators" nudges on a phone, where
   there is no hover to reveal that the heading opens. It fires when the
   section is scrolled to rather than on load — a prompt that plays
   while it is off screen has prompted nobody — and it stops the moment
   the list is opened.
   ------------------------------------------------------------------ */
const clientsList = document.querySelector(".clients");
if (clientsList) {
  const cue = clientsList.querySelector(".clients-cue");

  if (cue && "IntersectionObserver" in window) {
    const watcher = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || clientsList.open) return;
        cue.classList.add("is-nudging");
        // One prompt per visit. Re-arming it every time the section
        // scrolls back into view would be nagging, not prompting.
        watcher.disconnect();
      });
    }, { threshold: 0.6 });
    watcher.observe(clientsList);
  }

  // Opened: it has done its job.
  clientsList.addEventListener("toggle", () => {
    if (clientsList.open && cue) cue.classList.remove("is-nudging");
  });
}

/* ---------- Reel deck ----------
   Slides are buttons; the lightbox handler above already listens on
   every [data-reel] and reads its source off the element, so nothing
   here has to know how to play anything. This only decides which slide
   is showing, and advances on its own.

   Wrapping, where the arrows used to stop at the ends. Once the deck
   cycles by itself, an arrow that refuses to go round reads as broken —
   the page loops but the control will not.
   ------------------------------------------------------------------ */
const deck = document.querySelector("[data-deck]");
if (deck) {
  const HOLD = 7000;   // long enough to read a caption before it moves
  const RESUME = 14000; // after a manual press, how long before it takes over again
  const slides = [...deck.querySelectorAll(".reel-slide")];
  const prev = document.querySelector("[data-deck-prev]");
  const next = document.querySelector("[data-deck-next]");
  const counter = document.querySelector("[data-deck-current]");
  const panel = deck.closest(".panel");

  let at = 0;
  let timer = null;
  let taken = false;   // the visitor used an arrow, so it holds for a bit
  let handback = null;
  let seen = false;    // the deck is on screen
  let hovered = false; // pointer or focus is on the panel
  let watching = false; // the lightbox is open

  const show = (i) => {
    at = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      const on = n === at;
      s.classList.toggle("is-active", on);
      s.tabIndex = on ? 0 : -1;
      // Inactive slides leave the tab order and the accessibility tree,
      // or a keyboard user tabs into invisible play buttons.
      if (on) s.removeAttribute("aria-hidden");
      else s.setAttribute("aria-hidden", "true");
    });
    if (counter) counter.textContent = String(at + 1);
  };

  const stop = () => { clearInterval(timer); timer = null; };

  const run = () => {
    stop();
    if (taken || hovered || watching || !seen || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setInterval(() => show(at + 1), HOLD);
  };

  // Using an arrow hands the deck to the visitor — but only for a
  // while, not for good. Stopping permanently is right for a long
  // carousel; with two clips it meant one press killed the cycling for
  // the rest of the visit, which reads as the slider having broken.
  const byHand = (step) => {
    taken = true;
    clearTimeout(handback);
    stop();
    show(at + step);
    handback = setTimeout(() => { taken = false; run(); }, RESUME);
  };
  if (prev) prev.addEventListener("click", () => byHand(-1));
  if (next) next.addEventListener("click", () => byHand(1));

  deck.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); byHand(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); byHand(1); }
  });

  // Hovering or tabbing in means someone is reading it.
  if (panel) {
    panel.addEventListener("pointerenter", () => { hovered = true; run(); });
    panel.addEventListener("pointerleave", () => { hovered = false; run(); });
    panel.addEventListener("focusin", () => { hovered = true; run(); });
    panel.addEventListener("focusout", () => { hovered = false; run(); });
  }

  // While the lightbox is open the deck must hold: advancing behind the
  // dialog means closing it reveals a different slide than the one that
  // was opened. Watching a clip is not taking control, so it resumes.
  //
  // This needs its own flag rather than sharing the hover one. Opening
  // the dialog puts a modal over the panel, which fires pointerleave —
  // so a single flag was set true by the click and immediately unset by
  // the pointer leaving, and the deck advanced behind the dialog.
  const dialog = document.querySelector("#reel");
  if (dialog) {
    slides.forEach((s) => s.addEventListener("click", () => { watching = true; run(); }));
    dialog.addEventListener("close", () => { watching = false; run(); });
  }

  // Off screen it does nothing at all — most visitors never scroll here.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => { seen = e.isIntersecting; run(); });
    }, { threshold: 0.35 }).observe(deck);
  } else {
    seen = true;
  }

  show(0);
  run();
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
