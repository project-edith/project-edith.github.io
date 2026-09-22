# project-edith.github.io

Static GitHub Pages site for EDITH.

## Local preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Note that videos load faster under a threaded server; the stock
`http.server` is single-threaded and serialises the page's video requests.

## Files

- `index.html`: the page — hero (the presentation's opening question), motivation,
  hardware, the interactive mechanism explorer, evaluation tasks with the
  comparison viewer, results, robustness, ablations, citation
- `site.css`: design tokens, dark theme, page shell, and section styles. Loads
  *after* `styles.css` and retunes its tokens
- `site.js`: theme toggle, task comparison viewer, scroll reveals
- `nonverbal.js`: the opening question — four participants, paired side/top
  views, ported from the presentation's first slide. The four clips run on
  different source clocks and are warped onto one shared timeline so the panels
  hit the same beat together.
- `mechanism.css` / `mechanism.js`: the interactive mechanism explorer
- `styles.css` / `script.js`: carried over from the previous site; they still
  own the results section's layout and the "why are signals noisy" modal
- `index-legacy.html`: the previous page, kept for reference

### Assets

- `assets/web/*.mp4`: web-sized copies of the page's videos (~29 MB total).
  Re-encode from `assets/videos` with
  `ffmpeg -i in.mp4 -vf "scale='min(1280,iw)':-2" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -an -movflags +faststart out.mp4`
- `assets/videos/*`: the original full-resolution sources (~270 MB, not served)
- `assets/scene/*`: media for the mechanism explorer, including
  `tool-ego.mp4` (downscaled from `assets/videos/ego_input.mp4`) and
  `tool-robot-obs.mp4` (`low_center_rgb_top.mp4` with its burned-in debug
  overlay cropped off the top)
- `assets/scene/nonverbal/*`: the four paired recordings and their word-level
  speech timings (`speech.json`) for the opening question
- `assets/scene/tasks/*`: the three evaluation-task clips (privacy-processed
  copies from the presentation), shown in place of the old static stills
- `assets/episode_000000_actions.js`: recorded 14-DoF actions at 15 Hz, replayed
  as the Tool-Passing action readout

Unused by the current page but still in the repo (~7 MB): `assets/web/main.mp4`
(the old hero teaser), `assets/user_study/*` and `assets/userstudy_procedure.png`
(the removed user-study panel), and `assets/{muffin-serving,tumbler-sorting,tool-passing}.png`
(the task stills the evaluation videos replaced).

## Where the numbers come from

The results section carries the figures from the research presentation
(2026-09-22), which supersede the ones the June page shipped: five methods
rather than four, and EDITH at 48.6% SR / 75.9% TP on average rather than
59.7 / 84.7.

The previous page's user study, robustness analysis, and ablation panels were
built on the June figures and contradicted the new chart, so they were removed
along with the detail modal they fed. `index-legacy.html` still has them if any
of that content needs to come back against updated numbers.

The Ablations section carries the paper's Fig. 8 figures for Muffin-Serving
(EDITH 43.8 SR / 70.8 TP; without the keyframe 2.1 / 17.0; with the keyframe
taken from the robot's view instead 2.1 / 26.4). The paper's error bars are not
reproduced — their intervals are not in this repository.

`assets/scene/parallax/*` illustrates Fig. 9: the first-person keyframes are the
presentation's own, and the robot-view frames are sampled from
`policy-robot-top.mp4`. They are representative examples of the two viewpoints
rather than the paper's exact crops, so swap in the figure itself if the page
should match it frame for frame.

In the distraction experiment the baseline is π_FAM-HRI + π_l (its Muffin-Serving
numbers, 22.9 SR / 50.3 TP, match the main chart), not π₀.₅.

## The mechanism explorer

`mechanism.js` holds one config per task. Each carries the egocentric clip, the
speech windows, the subtask keyframes, and the execution timings.

Timings are read off the media they drive rather than eyeballed:

- Tool-Passing speech windows (1.50–3.47 s and 8.57–11.03 s) were measured from
  the burned-in captions of `assets/videos/ego_input.mp4`.
- Tool-Passing execution timings and action values come from the recorded
  episode.
- Muffin-Serving timings are carried over from the research presentation. Its
  action readout is labelled illustrative because no recorded action stream for
  that episode is in this repository.

Adding a task means adding one entry to `TASKS` in `mechanism.js`; nothing else
in the page needs to change.

## Deployment

This is a static site — GitHub Pages serves it from the `main` branch root with
no build step.

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin git@github.com:project-edith/edith.github.io.git
git push -u origin main
```
