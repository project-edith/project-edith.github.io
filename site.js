/* ==========================================================================
   EDITH project site — shell behaviour.
     * theme (light / dark / system) with a persisted override
     * section scroll-spy for the header nav
     * side-by-side task comparison viewer with one shared transport
   ========================================================================== */

(function () {
  "use strict";

  /* --- theme -------------------------------------------------------------- */

  const STORAGE_KEY = "edith-theme";

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  function currentTheme() {
    const stored = document.documentElement.dataset.theme;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function initTheme() {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
    });
  }

  /* Section scroll-spy lives in script.js, which toggles .is-active on nav links. */

  /* --- task comparison viewer --------------------------------------------- */

  const COMPARISONS = [
    {
      id: "muffin",
      title: "Muffin-Serving",
      ask: "Give me this muffin, this muffin, and this one.",
      note:
        "Three identical-looking muffins. The instruction never says which ones, so the " +
        "baseline has to be handed a fully-specified sentence instead.",
      baseline: { src: "assets/web/muffin_textvla.mp4", poster: "assets/posters/muffin-text.jpg" },
      edith: { src: "assets/web/muffin_edith.mp4", poster: "assets/posters/muffin-edith.jpg" },
    },
    {
      id: "tumbler",
      title: "Tumbler-Sorting",
      ask: "Put this tumbler into this basket, and that one into that basket.",
      note:
        "Both the object and its destination are deictic. Gaze disambiguates the pairing " +
        "that language leaves open.",
      baseline: { src: "assets/web/tumbler_text_vla.mp4", poster: "assets/posters/tumbler-text.jpg" },
      edith: { src: "assets/web/tumbler_edith.mp4", poster: "assets/posters/tumbler-edith.jpg" },
    },
    {
      id: "tool",
      title: "Tool-Passing",
      ask: "Give me that screwdriver. Also give me that metal profile.",
      note:
        "The human never looks up from the workpiece. The requested tool is one of a dozen " +
        "on the table, identified only by where they are looking.",
      baseline: { src: "assets/web/passing_tool_textvla.mp4", poster: "assets/posters/passing-tool-text.jpg" },
      edith: { src: "assets/web/edith_passing_tool.mp4", poster: "assets/posters/passing-tool-edith.jpg" },
    },
  ];

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0.0s";
    return `${seconds.toFixed(1)}s`;
  }

  function initCompare() {
    const root = document.querySelector("[data-compare-root]");
    if (!root) return;

    const tabs = root.querySelector("[data-compare-tabs]");
    const stage = root.querySelector("[data-compare-stage]");
    const askLine = root.querySelector("[data-compare-ask]");
    const noteLine = root.querySelector("[data-compare-note]");
    const playButton = root.querySelector("[data-compare-play]");
    const scrub = root.querySelector("[data-compare-scrub]");
    const clock = root.querySelector("[data-compare-clock]");

    let comparison = COMPARISONS[0];
    let videos = [];
    let visible = false;

    tabs.innerHTML = COMPARISONS.map(
      (c) =>
        `<button type="button" role="tab" data-compare-task="${c.id}" aria-selected="${c.id === comparison.id}">${c.title}</button>`,
    ).join("");

    function panel(kind, spec) {
      const isEdith = kind === "edith";
      return (
        `<article class="compare-panel${isEdith ? " is-edith" : ""}">` +
        `<header>` +
        `<span class="compare-tag">${isEdith ? "EDITH" : "π<sub>0.5</sub>"}</span>` +
        `<p>${isEdith ? "Verbal instruction + nonverbal signals" : "Fully-specified verbal instruction"}</p>` +
        `</header>` +
        `<div class="compare-media">` +
        `<video data-compare-video muted playsinline preload="metadata" poster="${spec.poster}" src="${spec.src}"></video>` +
        `<span class="compare-duration" data-compare-duration></span>` +
        `</div>` +
        `</article>`
      );
    }

    function render() {
      stage.innerHTML = panel("baseline", comparison.baseline) + panel("edith", comparison.edith);
      videos = Array.from(stage.querySelectorAll("[data-compare-video]"));
      askLine.textContent = `“${comparison.ask}”`;
      noteLine.textContent = comparison.note;

      videos.forEach((video) => {
        video.addEventListener("loadedmetadata", () => {
          const label = video.parentElement.querySelector("[data-compare-duration]");
          if (label) label.textContent = formatTime(video.duration);
          syncScrubRange();
        });
        video.addEventListener("ended", () => {
          if (videos.every((v) => v.ended)) restart();
        });
      });

      Array.from(tabs.querySelectorAll("button")).forEach((button) => {
        button.setAttribute("aria-selected", String(button.dataset.compareTask === comparison.id));
      });

      if (visible) playAll();
    }

    function longest() {
      return videos.reduce(
        (max, v) => (Number.isFinite(v.duration) ? Math.max(max, v.duration) : max),
        0,
      );
    }

    function syncScrubRange() {
      scrub.max = String(Math.max(0.1, longest()));
    }

    function playAll() {
      videos.forEach((video) => {
        // A video that already reached its end stays on its last frame, which is
        // the honest picture: that run is over while the other is still going.
        if (!video.ended) {
          const attempt = video.play();
          if (attempt && attempt.catch) attempt.catch(() => { /* autoplay blocked */ });
        }
      });
      syncPlayButton();
    }

    function pauseAll() {
      videos.forEach((video) => video.pause());
      syncPlayButton();
    }

    function restart() {
      videos.forEach((video) => { try { video.currentTime = 0; } catch { /* not seekable */ } });
      playAll();
    }

    function seekAll(time) {
      videos.forEach((video) => {
        try { video.currentTime = Math.min(time, video.duration || time); } catch { /* not seekable */ }
      });
    }

    function syncPlayButton() {
      const paused = videos.every((v) => v.paused);
      playButton.textContent = paused ? "▶ Play both" : "❚❚ Pause both";
    }

    function tick() {
      window.requestAnimationFrame(tick);
      if (!videos.length) return;

      const lead = videos.reduce((a, b) => (a.currentTime >= b.currentTime ? a : b));
      if (document.activeElement !== scrub) scrub.value = String(lead.currentTime);

      clock.textContent = `${formatTime(lead.currentTime)} / ${formatTime(longest())}`;

      videos.forEach((video) => {
        video.parentElement.classList.toggle("is-finished", video.ended);
      });
    }

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-compare-task]");
      if (!button) return;
      const next = COMPARISONS.find((c) => c.id === button.dataset.compareTask);
      if (!next || next === comparison) return;
      comparison = next;
      render();
    });

    playButton.addEventListener("click", () => {
      if (videos.every((v) => v.paused)) playAll();
      else pauseAll();
    });

    root.querySelector("[data-compare-restart]").addEventListener("click", restart);

    scrub.addEventListener("input", () => {
      pauseAll();
      seekAll(Number(scrub.value));
    });

    stage.addEventListener("play", syncPlayButton, true);
    stage.addEventListener("pause", syncPlayButton, true);

    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          if (visible) playAll();
          else pauseAll();
        });
      },
      { threshold: 0.3 },
    ).observe(root);

    render();
    tick();
  }

  /* --- evaluation tasks ---------------------------------------------------- */

  // Each task's spoken command types out on its own video's clock, so the text
  // and the gesture it refers to stay together through every loop. Cue windows
  // come from the research presentation's evaluation slide.
  const EVAL_COMMANDS = {
    muffin: [{ start: 0, end: 3.2, text: "Give me this muffin, this muffin, and this muffin." }],
    tumbler: [
      { start: 0, end: 3.4, text: "Put this tumbler into this basket," },
      { start: 3.5, end: 7.65, text: "\nand this tumbler into this basket." },
    ],
    tool: [
      { start: 0.97, end: 2.15, text: "Give me that screwdriver." },
      { start: 12.24, end: 13.7, text: "\nGive me that metal profile." },
    ],
  };

  function initEvalTasks() {
    const tasks = Array.from(document.querySelectorAll("[data-eval-task]")).map((node) => ({
      node,
      video: node.querySelector("video"),
      out: node.querySelector(".eval-command span"),
      bubble: node.querySelector(".eval-command"),
      cues: EVAL_COMMANDS[node.dataset.evalTask] || [],
    }));
    if (!tasks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const task = tasks.find((t) => t.node === entry.target);
          if (!task) return;
          if (entry.isIntersecting) {
            const attempt = task.video.play();
            if (attempt && attempt.catch) attempt.catch(() => { /* autoplay blocked */ });
          } else {
            task.video.pause();
          }
        });
      },
      { threshold: 0.3 },
    );
    tasks.forEach((task) => observer.observe(task.node));

    function tick() {
      window.requestAnimationFrame(tick);
      tasks.forEach((task) => {
        const full = task.cues.map((cue) => cue.text).join("");
        if (task.video.paused) {
          // A paused clip should still say what was asked, rather than showing
          // an empty bubble where the command will eventually type out.
          task.out.textContent = full;
          task.bubble.classList.add("visible");
          return;
        }
        const t = task.video.currentTime || 0;
        let text = "";
        for (const cue of task.cues) {
          const share = Math.min(1, Math.max(0, (t - cue.start) / (cue.end - cue.start)));
          text += cue.text.slice(0, Math.ceil(cue.text.length * share));
        }
        task.out.textContent = text;
        task.bubble.classList.toggle("visible", !!text.trim());
      });
    }
    tick();
  }

  /* --- reveal on scroll ---------------------------------------------------- */

  function initReveal() {
    const items = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!items.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((item) => item.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18 },
    );

    items.forEach((item) => observer.observe(item));
  }

  function init() {
    initTheme();
    initCompare();
    initEvalTasks();
    initReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
