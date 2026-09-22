/* ==========================================================================
   EDITH — the opening question, carried over from the research presentation.

   Four participants ask for the same three objects in their own words, each
   shown as a side view paired with a top view. The top view marks which object
   the participant selected and when; the bubble types their speech in sync.

   The four recordings run on different clocks, so every participant's timeline
   is warped onto one shared timeline through a small piecewise-linear map
   (nonverbalSourceAnchors -> NV_TARGET_ANCHORS). That is what makes the four
   panels tell the same beat at the same moment.
   ========================================================================== */

(function () {
  "use strict";

  const BASE = "assets/scene/nonverbal";

  const DIALOGUE = [
    "Hand me this one and that muffin and that one over there.",
    "Can you give me this cupcake, this cupcake, and this cupcake?",
    "Give me this muffin, this muffin, and this one.",
    "Give me this and this and this.",
  ];

  // Anonymous paired views; both cameras of a pair share one source timeline.
  const PAIRS = [
    { asset: 3, cues: [[1, 1.5, 9.7, 260, 222], [2, 4, 11.7, 108, 222], [3, 7, 13.4, 260, 286]] },
    { asset: 1, cues: [[1, 0.8, 11.5, 182, 222], [2, 3.8, 13.8, 182, 286], [3, 6.8, 15.8, 108, 222]] },
    { asset: 2, cues: [[1, 1, 7.8, 260, 222], [2, 2, 9.8, 182, 222], [3, 3, 12.2, 108, 286]] },
    { asset: 4, cues: [[1, 0.7, 7.8, 260, 286], [2, 1.8, 9.8, 182, 286], [3, 2.8, 12.5, 108, 222]] },
  ];

  const SOURCE_ANCHORS = {
    3: [0, 1.5, 4, 7, 7.9, 15.3],
    1: [0, 1, 4, 7, 283 / 30, 17.3],
    2: [0, 1.2, 1.9, 2.6, 186 / 30, 13.9333333333],
    4: [0, 1.1, 2, 3, 178 / 30, 13.2],
  };
  const TARGET_ANCHORS = [0, 1.2, 3, 4.8, 6.5, 15.5];

  function alignedTime(t, asset) {
    const src = SOURCE_ANCHORS[asset];
    let i = 0;
    while (i < src.length - 2 && t > src[i + 1]) i++;
    return (
      TARGET_ANCHORS[i] +
      ((t - src[i]) / (src[i + 1] - src[i])) * (TARGET_ANCHORS[i + 1] - TARGET_ANCHORS[i])
    );
  }

  PAIRS.forEach((pair) => {
    pair.cues = pair.cues.map((cue, i) => [
      cue[0],
      TARGET_ANCHORS[i + 1] - 0.2,
      alignedTime(cue[2], pair.asset),
      cue[3],
      cue[4],
    ]);
  });

  function markup() {
    return PAIRS.map((pair, i) => {
      const markers = pair.cues
        .map(
          ([n, , , x, y]) =>
            `<g class="nv-marker">` +
            `<circle cx="${x}" cy="${y}" r="25" fill="#0066ff10" stroke="#0066ff" stroke-width="3"/>` +
            `<circle cx="${x + 19}" cy="${y - 22}" r="12" fill="#0066ff" stroke="white" stroke-width="2"/>` +
            `<text x="${x + 19}" y="${y - 21}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="16" font-weight="600">${n}</text>` +
            `</g>`,
        )
        .join("");

      return (
        `<section class="nv-pair" aria-label="Participant ${i + 1}: paired side and top views">` +
        `<div class="nv-media">` +
        `<video class="nv-side" src="${BASE}/${pair.asset}-side.mp4" poster="${BASE}/${pair.asset}-side.jpg" muted playsinline preload="auto" aria-label="Side view ${i + 1}"></video>` +
        `<div class="nv-top">` +
        `<video src="${BASE}/${pair.asset}-top.mp4" poster="${BASE}/${pair.asset}-top.jpg" muted playsinline preload="auto" aria-label="Top view ${i + 1}"></video>` +
        `<svg viewBox="0 0 360 504" aria-label="Selection order">${markers}</svg>` +
        `</div>` +
        `</div>` +
        `<blockquote class="nv-speech" aria-hidden="true"><span></span></blockquote>` +
        `</section>`
      );
    }).join("");
  }

  async function setup(root) {
    root.innerHTML = markup();

    const pairs = Array.from(root.querySelectorAll(".nv-pair")).map((node, i) => ({
      node,
      side: node.querySelector(".nv-side"),
      top: node.querySelector(".nv-top video"),
      markers: Array.from(node.querySelectorAll(".nv-marker")),
      cues: PAIRS[i].cues,
      asset: PAIRS[i].asset,
      bubble: node.querySelector(".nv-speech"),
      speech: node.querySelector(".nv-speech span"),
    }));

    let speech = [];
    try {
      speech = await fetch(`${BASE}/speech.json`).then((r) => r.json());
    } catch {
      // fall back to evenly spaced words below
    }

    pairs.forEach((pair) => {
      const words = DIALOGUE[pair.asset - 1].split(" ");
      const raw =
        speech[pair.asset - 1] ||
        words.map((text, i) => ({ text, start: 0.2 + i * 0.4, end: 0.2 + (i + 1) * 0.4 }));
      pair.wordCues = raw.map((cue) => ({
        ...cue,
        start: alignedTime(cue.start, pair.asset),
        end: alignedTime(cue.end, pair.asset),
      }));
    });

    const play = (pair) => {
      pair.node.classList.add("is-playing");
      [pair.side, pair.top].forEach((video) => {
        const attempt = video.play();
        if (attempt && attempt.catch) attempt.catch(() => { /* autoplay blocked */ });
      });
    };

    const restart = () => {
      pairs.forEach((pair) => {
        try {
          pair.side.currentTime = 0;
          pair.top.currentTime = 0;
        } catch { /* not seekable yet */ }
        play(pair);
      });
    };

    // The four clips are the same length once aligned, so the set loops together.
    pairs.forEach((pair) =>
      pair.side.addEventListener("ended", () => {
        pair.top.pause();
        pair.node.classList.remove("is-playing");
        if (pairs.every((p) => p.side.ended)) window.setTimeout(restart, 900);
      }),
    );

    let visible = false;
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          pairs.forEach((pair) => {
            if (visible) { if (!pair.side.ended) play(pair); }
            else { pair.side.pause(); pair.top.pause(); }
          });
        });
      },
      { threshold: 0.2 },
    ).observe(root);

    function tick() {
      window.requestAnimationFrame(tick);
      if (!root.isConnected) return;

      pairs.forEach((pair) => {
        if (!pair.side.paused && !pair.top.ended &&
            Math.abs(pair.side.currentTime - pair.top.currentTime) > 0.1) {
          try { pair.top.currentTime = pair.side.currentTime; } catch { /* not seekable */ }
        }

        let text = "";
        for (const cue of pair.wordCues) {
          if (pair.side.currentTime <= cue.start) break;
          const span = Math.max(0.13, Math.min(0.3, cue.end - cue.start));
          const count = Math.min(
            cue.text.length,
            Math.ceil(((pair.side.currentTime - cue.start) / span) * cue.text.length),
          );
          text += (text ? " " : "") + cue.text.slice(0, count);
        }
        pair.speech.textContent = text;
        pair.bubble.classList.toggle("visible", !!text);
        pair.bubble.setAttribute("aria-hidden", String(!text));

        pair.markers.forEach((marker, i) =>
          marker.classList.toggle(
            "visible",
            pair.side.currentTime >= pair.cues[i][1] && pair.side.currentTime < pair.cues[i][2],
          ),
        );
      });
    }
    tick();
  }

  function init() {
    const root = document.querySelector("[data-nonverbal]");
    if (root) setup(root);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
