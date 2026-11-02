/* ==========================================================================
   EDITH — interactive mechanism explorer.

   One figure, two acts, two tasks:
     act "high"  human signal (egocentric view + gaze + speech) -> pi_h -> queue
     act "low"   queue -> pi_l + robot observation -> action a_t, completion p_t

   Every timing below is read off the media it drives:
     * Tool-Passing speech windows were measured from the burned-in captions
       of assets/videos/ego_input.mp4 (caption box present 1.50-3.47 s and
       8.57-11.03 s at 30 fps).
     * Tool-Passing execution timings and the action stream come from the
       recorded episode (assets/episode_000000_actions.js, 15 fps).
     * Muffin-Serving timings are carried over from the research presentation.
   ========================================================================== */

(function () {
  "use strict";

  const TASKS = [
    {
      id: "muffin",
      label: "Muffin-Serving",
      blurb:
        "The human points at three cupcakes while speaking. Deixis (“this one”) carries no " +
        "object identity on its own — gaze and the egocentric view resolve which cupcake is meant.",
      signal: {
        src: "assets/scene/policy-ego-4s.mp4",
        poster: "assets/scene/policy-ego-v2.jpg",
        rate: 0.75,
      },
      cues: [
        { start: 0.11, end: 0.2, text: "Can" },
        { start: 0.2, end: 0.34, text: " you" },
        { start: 0.4, end: 0.54, text: " give" },
        { start: 0.67, end: 0.79, text: " me" },
        { start: 0.8, end: 0.94, text: " this" },
        { start: 1.07, end: 1.26, text: " cupcake" },
        { start: 1.69, end: 1.77, text: " and this" },
        { start: 1.77, end: 1.96, text: " cupcake" },
        { start: 2.65, end: 2.79, text: " and" },
        { start: 2.85, end: 2.99, text: " this" },
        { start: 3.31, end: 3.5, text: " cupcake." },
      ],
      subtasks: [
        { time: 1, keyframe: "assets/scene/policy-keyframe-v2-1.png", task: "Pick up the top-right cupcake." },
        { time: 2, keyframe: "assets/scene/policy-keyframe-v2-2.png", task: "Pick up the top-middle cupcake." },
        { time: 3, keyframe: "assets/scene/policy-keyframe-v2-3.png", task: "Pick up the bottom-left cupcake." },
      ],
      execution: {
        src: "assets/scene/policy-robot-from-5s.mp4",
        poster: "assets/scene/policy-robot-start-5s.jpg",
        rate: 0.5,
        switches: [3.3, 5.4],
        completions: [[3.0, 3.95], [5.1, 6.05]],
        actions: { kind: "illustrative" },
      },
    },
    {
      id: "tool",
      label: "Tool-Passing",
      blurb:
        "The human keeps both hands on the workpiece and asks for tools without ever naming " +
        "which one on the table. Gaze fixates the requested tool a moment before the request lands.",
      signal: {
        src: "assets/scene/tool-ego.mp4",
        poster: "assets/scene/tool-ego.jpg",
        rate: 1,
      },
      cues: [
        { start: 1.5, end: 3.47, text: "Give me that screwdriver." },
        { start: 8.57, end: 11.03, text: " Also give me that metal profile." },
      ],
      subtasks: [
        { time: 3.6, keyframe: "assets/keyframe1.png", task: "Pick up the screwdriver and pass it to human." },
        { time: 11.2, keyframe: "assets/keyframe2.png", task: "Pick up the 10 cm metal profile." },
      ],
      execution: {
        src: "assets/scene/tool-robot-obs.mp4",
        poster: "assets/scene/tool-robot.jpg",
        rate: 1,
        switches: [7.15],
        completions: [[7.15, 8], [14.5, 15]],
        actions: { kind: "recorded", indices: [2, 9, 7, 1] },
      },
    },
  ];

  const ACTS = [
    {
      id: "high",
      index: "01",
      label: "High-level policy",
      note: "Reads the egocentric stream and extracts keyframe-grounded subtasks.",
    },
    {
      id: "low",
      index: "02",
      label: "Low-level policy",
      note: "Conditions on the keyframe to produce actions.",
    },
  ];

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* --- action readouts --------------------------------------------------- */

  function recordedStream(indices) {
    const data = window.EDITH_LOW_LEVEL_ACTIONS;
    const values = data && Array.isArray(data.values) ? data.values : [];
    if (!values.length) return null;

    const signature = (a) =>
      indices.filter((i) => i < a.length).map((i) => Number(a[i]).toFixed(4)).join("|");

    const stream = [];
    let last = "";
    for (const action of values) {
      const sig = signature(action);
      if (sig === last) continue;
      stream.push(action);
      last = sig;
    }
    return stream.length ? stream : values;
  }

  function formatRecorded(action, indices) {
    const v = indices.filter((i) => i < action.length).map((i) => Number(action[i]).toFixed(4));
    return v.length > 2 ? `[${v.slice(0, 2).join(", ")}, …, ${v.slice(2).join(", ")}]` : `[${v.join(", ")}]`;
  }

  // Smoothly varying stand-in joint values — not recorded telemetry.
  const BASE = [-0.9649, -2.1997, 0.5584, 0.4955];
  const AMP = [0.55, 0.4, 0.65, 0.5];
  function hash(joint, step) {
    const v = Math.sin((joint + 1) * 127.1 + (step + 1) * 311.7) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  }
  function illustrative(t) {
    const values = BASE.map((base, j) => {
      const pos = t / 0.65;
      const k = Math.floor(pos);
      const u = pos - k;
      const w = u * u * (3 - 2 * u);
      const n = hash(j, k) * (1 - w) + hash(j, k + 1) * w;
      const ramp = Math.min(1, t / 0.8);
      return clamp(base + AMP[j] * n * ramp, -Math.PI, Math.PI).toFixed(4);
    });
    return `[${values[0]}, ${values[1]}, …, ${values[2]}, ${values[3]}]`;
  }

  /* --- markup ------------------------------------------------------------ */

  const linkPair = (name) =>
    `<path class="link-track" data-link="${name}"></path>` +
    `<path class="link-pulse" pathLength="100" data-link="${name}"></path>`;

  function queueMarkup(task, heading) {
    return (
      `<section class="mech-node mech-queue">` +
      `<h3>Subtask queue <span>Q — ${task.subtasks.length} subtasks</span></h3>` +
      `<div class="mech-cards" data-mech-cards>${heading}</div>` +
      `</section>`
    );
  }

  function stageMarkup(task) {
    const emptyQueue = `<p class="mech-queue-empty" data-mech-empty>Waiting for the human’s intent…</p>`;

    const high =
      `<div class="mech-act mech-act-high" data-act="high">` +
      `<svg class="mech-links" data-links="high">${linkPair("signal")}${linkPair("engine")}</svg>` +
      `<figure class="mech-node mech-signal">` +
      `<p class="mech-label">Human signal</p>` +
      `<div class="mech-signal-frame" data-mech-signal-frame>` +
      `<video data-mech-signal playsinline muted preload="auto" poster="${task.signal.poster}" src="${task.signal.src}"></video>` +
      `<span class="mech-glasses-badge"><img src="assets/scene/hardware-glass.jpg" alt="">Project Aria · ego + gaze</span>` +
      `</div>` +
      `<div class="mech-asr is-idle" data-mech-asr><small>Speech ℓ · ASR</small><span class="mech-asr-text" data-mech-asr-text></span></div>` +
      `</figure>` +
      `<div class="mech-node mech-engine-wrap">` +
      `<div class="mech-engine" data-mech-engine-h><h3>High-level policy</h3><p>π<sub>h</sub> (VLM)</p></div>` +
      `<p class="mech-engine-note">Reads the recent window of egocentric context and speech, infers intent, and pushes subtasks into Q.</p>` +
      `</div>` +
      queueMarkup(task, emptyQueue) +
      `</div>`;

    const low =
      `<div class="mech-act mech-act-low" data-act="low">` +
      `<svg class="mech-links" data-links="low">${linkPair("queue")}${linkPair("obs")}${linkPair("out")}</svg>` +
      queueMarkup(task, "") +
      `<div class="mech-exec">` +
      `<figure class="mech-node mech-obs-wrap">` +
      `<p class="mech-label">Robot observation o<sub>t</sub></p>` +
      `<div class="mech-obs"><video data-mech-exec playsinline muted preload="auto" poster="${task.execution.poster}" src="${task.execution.src}"></video></div>` +
      `</figure>` +
      `<div class="mech-node mech-engine-wrap">` +
      `<div class="mech-engine" data-mech-engine-l><h3>Low-level policy</h3><p>π<sub>l</sub> (VLA)</p></div>` +
      `<p class="mech-engine-note">Pops the front of Q and runs it to completion, then moves on.</p>` +
      `</div>` +
      `<div class="mech-node mech-output">` +
      `<div class="mech-readout"><p>Robot action a<sub>t</sub></p><code data-mech-action>—</code></div>` +
      `<div class="mech-readout"><p>Completion p<sub>t</sub></p><span class="mech-completion" data-mech-completion>0</span></div>` +
      `<p class="mech-note" data-mech-actions-note></p>` +
      `</div>` +
      `</div>` +
      `</div>`;

    return high + low;
  }

  function cardMarkup(subtask, i, isNew) {
    return (
      `<button class="mech-card${isNew ? " is-new" : ""}" type="button" data-card="${i}">` +
      `<img src="${subtask.keyframe}" alt="Keyframe ${i + 1}">` +
      `<div><small>KEYFRAME C<sub>${i + 1}</sub></small><h4>${subtask.task}</h4></div>` +
      `<span class="mech-card-state" data-card-state>Queued</span>` +
      `</button>`
    );
  }

  /* --- controller -------------------------------------------------------- */

  function createExplorer(root) {
    const stage = root.querySelector("[data-mech-stage]");
    const caption = root.querySelector("[data-mech-caption]");
    const actRail = root.querySelector("[data-mech-acts]");
    const taskRail = root.querySelector("[data-mech-tasks]");
    const playButton = root.querySelector("[data-mech-play]");
    const replayButton = root.querySelector("[data-mech-replay]");
    const progress = root.querySelector("[data-mech-progress]");
    if (!stage) return;

    let task = TASKS[0];
    let act = "high";
    let revealed = new Set();
    let frameRequest = null;
    let visible = false;
    let nodes = {};

    /* ---- rendering ---- */

    function render() {
      stage.innerHTML = stageMarkup(task);
      revealed = new Set();

      nodes = {
        high: stage.querySelector('[data-act="high"]'),
        low: stage.querySelector('[data-act="low"]'),
        signal: stage.querySelector("[data-mech-signal]"),
        signalFrame: stage.querySelector("[data-mech-signal-frame]"),
        asr: stage.querySelector("[data-mech-asr]"),
        asrText: stage.querySelector("[data-mech-asr-text]"),
        engineH: stage.querySelector("[data-mech-engine-h]"),
        engineL: stage.querySelector("[data-mech-engine-l]"),
        exec: stage.querySelector("[data-mech-exec]"),
        action: stage.querySelector("[data-mech-action]"),
        completion: stage.querySelector("[data-mech-completion]"),
        actionsNote: stage.querySelector("[data-mech-actions-note]"),
        cardHosts: Array.from(stage.querySelectorAll("[data-mech-cards]")),
        empty: stage.querySelector("[data-mech-empty]"),
      };

      nodes.signal.playbackRate = task.signal.rate;
      nodes.exec.playbackRate = task.execution.rate;
      nodes.exec.loop = false;

      // The low-level act always shows the full queue; the high-level act fills it live.
      const lowHost = nodes.cardHosts[1];
      lowHost.innerHTML = task.subtasks.map((s, i) => cardMarkup(s, i)).join("");

      nodes.actionsNote.textContent =
        task.execution.actions.kind === "recorded"
          ? "Action values are replayed from the recorded episode (15 Hz, 14-DoF; 4 joints shown)."
          : "Action values shown for this task are illustrative, not recorded telemetry.";

      nodes.signal.addEventListener("ended", onSignalEnded);
      nodes.exec.addEventListener("ended", onExecEnded);

      applyAct();
      syncTaskRail();
      caption.innerHTML = `<strong>${task.label}.</strong> ${task.blurb}`;
    }

    function onCardClick(event) {
      const card = event.target.closest("[data-card]");
      if (!card) return;
      const index = Number(card.dataset.card);
      if (act === "low") {
        const starts = [0].concat(task.execution.switches);
        seekExec(starts[index] ?? 0);
      } else {
        setAct("low");
        const starts = [0].concat(task.execution.switches);
        seekExec(starts[index] ?? 0);
      }
    }

    /* ---- acts ---- */

    function applyAct() {
      nodes.high.classList.toggle("is-current", act === "high");
      nodes.low.classList.toggle("is-current", act === "low");

      Array.from(actRail.querySelectorAll("button")).forEach((button) => {
        button.setAttribute("aria-selected", String(button.dataset.mechAct === act));
      });

      if (act === "high") {
        nodes.exec.pause();
        restartSignal();
      } else {
        nodes.signal.pause();
        fillQueue();
        restartExec();
      }
    }

    function setAct(next) {
      if (act === next) return;
      act = next;
      applyAct();
    }

    function syncTaskRail() {
      Array.from(taskRail.querySelectorAll("button")).forEach((button) => {
        button.setAttribute("aria-selected", String(button.dataset.mechTask === task.id));
      });
    }

    /* ---- act 1 ---- */

    function restartSignal() {
      revealed = new Set();
      nodes.cardHosts[0].innerHTML = `<p class="mech-queue-empty" data-mech-empty>Waiting for the human’s intent…</p>`;
      nodes.empty = stage.querySelector("[data-mech-empty]");
      nodes.asrText.textContent = "";
      nodes.asr.classList.add("is-idle");
      try { nodes.signal.currentTime = 0; } catch { /* not seekable yet */ }
      if (visible) play(nodes.signal);
    }

    function reveal(index) {
      if (revealed.has(index)) return;
      revealed.add(index);

      if (nodes.empty) { nodes.empty.remove(); nodes.empty = null; }
      nodes.cardHosts[0].insertAdjacentHTML("beforeend", cardMarkup(task.subtasks[index], index, true));

      flash(nodes.signalFrame);
      flash(nodes.engineH);
    }

    function flash(node) {
      if (!node || reduced()) return;
      node.classList.add("is-firing");
      setTimeout(() => node.classList.remove("is-firing"), 620);
    }

    function onSignalEnded() {
      if (!visible) return;
      setTimeout(() => { if (visible && act === "high") setAct("low"); }, 900);
    }

    /* ---- act 2 ---- */

    function fillQueue() {
      const host = nodes.cardHosts[1];
      if (!host.children.length) host.innerHTML = task.subtasks.map((s, i) => cardMarkup(s, i)).join("");
    }

    function restartExec() {
      try { nodes.exec.currentTime = 0; } catch { /* not seekable yet */ }
      if (visible) play(nodes.exec);
    }

    function seekExec(time) {
      try { nodes.exec.currentTime = time; } catch { /* not seekable yet */ }
      play(nodes.exec);
    }

    function onExecEnded() {
      nodes.exec.currentTime = 0;
      play(nodes.exec);
    }

    const stream = { muffin: null, tool: null };
    function actionText(t, duration) {
      const spec = task.execution.actions;
      if (spec.kind === "illustrative") return illustrative(Math.max(0, t));
      if (!stream[task.id]) stream[task.id] = recordedStream(spec.indices);
      const values = stream[task.id];
      if (!values) return "[action unavailable]";
      const i = clamp(Math.floor((t / duration) * values.length), 0, values.length - 1);
      return formatRecorded(values[i], spec.indices);
    }

    /* ---- per-frame sync ---- */

    function tick() {
      frameRequest = window.requestAnimationFrame(tick);
      if (!root.isConnected) return;

      if (act === "high") {
        const t = nodes.signal.currentTime || 0;
        let text = "";
        for (const cue of task.cues) {
          const share = clamp((t - cue.start) / (cue.end - cue.start), 0, 1);
          text += cue.text.slice(0, Math.floor(cue.text.length * share));
        }
        nodes.asrText.textContent = text;
        nodes.asr.classList.toggle("is-idle", !text);

        task.subtasks.forEach((subtask, i) => {
          if (t >= subtask.time) reveal(i);
        });

        setProgress(nodes.signal);
      } else {
        const video = nodes.exec;
        const t = video.currentTime || 0;
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
        const active = task.execution.switches.filter((s) => t >= s).length;
        const complete = task.execution.completions.some(([a, b]) => t >= a && t < b);

        nodes.action.textContent = actionText(t, duration);
        nodes.completion.textContent = complete ? "1" : "0";
        nodes.completion.classList.toggle("is-complete", complete);
        nodes.engineL.classList.toggle("is-firing", complete);

        Array.from(nodes.cardHosts[1].children).forEach((card, i) => {
          card.classList.toggle("is-active", i === active);
          card.classList.toggle("is-done", i < active);
          card.classList.toggle("is-pending", i > active);
          const state = card.querySelector("[data-card-state]");
          if (state) state.textContent = i < active ? "Done" : i === active ? "Running" : "Queued";
        });

        setProgress(video);
      }

      layoutLinks();
    }

    function setProgress(video) {
      if (!progress) return;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const share = duration ? (video.currentTime / duration) * 100 : 0;
      progress.style.width = `${clamp(share, 0, 100)}%`;
    }

    /* ---- connectors ---- */

    function layoutLinks() {
      const current = act === "high" ? nodes.high : nodes.low;
      const svg = current.querySelector(".mech-links");
      if (!svg) return;

      const base = svg.getBoundingClientRect();
      if (!base.width) return;

      const draw = (name, d, live) => {
        svg.querySelectorAll(`[data-link="${name}"]`).forEach((path) => {
          path.setAttribute("d", d);
          if (path.classList.contains("link-pulse")) path.classList.toggle("is-live", live);
        });
      };
      const hEdge = (from, to) => {
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const y1 = a.top + a.height / 2 - base.top;
        const y2 = b.top + b.height / 2 - base.top;
        const x1 = a.right - base.left + 5;
        const x2 = b.left - base.left - 7;
        const mid = x1 + (x2 - x1) * 0.55;
        return `M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      };
      const vEdge = (from, to) => {
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const x = b.left + b.width / 2 - base.left;
        return `M${x} ${a.bottom - base.top + 5}V${b.top - base.top - 7}`;
      };

      if (act === "high") {
        const playing = !nodes.signal.paused;
        draw("signal", hEdge(nodes.signalFrame, nodes.engineH), playing);
        draw("engine", hEdge(nodes.engineH, nodes.cardHosts[0]), playing && revealed.size > 0);
      } else {
        const playing = !nodes.exec.paused;
        draw("queue", vEdge(nodes.cardHosts[1], nodes.engineL), playing);
        draw("obs", hEdge(nodes.exec.parentElement, nodes.engineL), playing);
        draw("out", hEdge(nodes.engineL, nodes.action.parentElement), playing);
      }
    }

    /* ---- transport ---- */

    function play(video) {
      const attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(() => { /* autoplay blocked */ });
      syncPlayButton();
    }

    function currentVideo() {
      return act === "high" ? nodes.signal : nodes.exec;
    }

    function syncPlayButton() {
      if (!playButton) return;
      const paused = currentVideo().paused;
      playButton.textContent = paused ? "▶ Play" : "❚❚ Pause";
      playButton.setAttribute("aria-label", paused ? "Play" : "Pause");
    }

    /* ---- wiring ---- */

    actRail.innerHTML = ACTS.map(
      (a) =>
        `<li><button type="button" role="tab" data-mech-act="${a.id}" aria-selected="${a.id === act}">` +
        `<span class="mech-act-head"><b>${a.index}</b>${a.label}</span>` +
        `<small>${a.note}</small></button></li>`,
    ).join("");

    taskRail.innerHTML = TASKS.map(
      (t) =>
        `<button type="button" role="tab" data-mech-task="${t.id}" aria-selected="${t.id === task.id}">${t.label}</button>`,
    ).join("");

    actRail.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mech-act]");
      if (button) setAct(button.dataset.mechAct);
    });

    taskRail.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mech-task]");
      if (!button) return;
      const next = TASKS.find((t) => t.id === button.dataset.mechTask);
      if (!next || next === task) return;
      task = next;
      act = "high";
      render();
    });

    if (playButton) {
      playButton.addEventListener("click", () => {
        const video = currentVideo();
        if (video.paused) play(video);
        else video.pause();
        syncPlayButton();
      });
    }

    const progressTrack = progress ? progress.parentElement : null;
    if (progressTrack) {
      progressTrack.setAttribute("role", "slider");
      progressTrack.setAttribute("tabindex", "0");
      progressTrack.setAttribute("aria-label", "Seek within this stage");

      const seekFromPointer = (event) => {
        const video = currentVideo();
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        if (!duration) return;
        const rect = progressTrack.getBoundingClientRect();
        const share = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        try { video.currentTime = share * duration; } catch { /* not seekable yet */ }
        play(video);
      };

      progressTrack.addEventListener("pointerdown", seekFromPointer);
      progressTrack.addEventListener("keydown", (event) => {
        const video = currentVideo();
        const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (!step) return;
        event.preventDefault();
        try { video.currentTime = clamp(video.currentTime + step, 0, video.duration || 0); } catch { /* not seekable */ }
      });
    }

    if (replayButton) {
      replayButton.addEventListener("click", () => {
        if (act === "high") restartSignal();
        else restartExec();
      });
    }

    stage.addEventListener("click", onCardClick);
    stage.addEventListener("play", syncPlayButton, true);
    stage.addEventListener("pause", syncPlayButton, true);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          if (visible) play(currentVideo());
          else currentVideo().pause();
        });
      },
      { threshold: 0.25 },
    );
    observer.observe(root);

    render();
    if (!frameRequest) tick();
  }

  function init() {
    document.querySelectorAll("[data-mech-root]").forEach(createExplorer);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
