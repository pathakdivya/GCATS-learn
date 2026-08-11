# GCATS-Training

# Gamepad Training Protocol

A lightweight researcher friendly web app for familiarising behavioural research participants with a gamepad controller before they begin a main experiment. Built for use alongside [GCATS](https://github.com/pathakdivya/GCATS) (Gamepad-based Continuous Affective Tracing System), it can also be independently used for training. Software was built at [NSLab](https://sites.google.com/site/ammuns68), [Department of Cognitive Science](https://www.cgs.iitk.ac.in/user/cgs/cgs/), IIT Kanpur.

Participants plug in a controller, walk through a guided orientation, complete an adaptive motion-discrimination task to confirm they can use the thumbstick accurately, and fill out a short comfort questionnaire — all in the browser, with results exportable as CSV.

## Why this exists

Continuous affective tracking tasks ask participants to make fine, sustained thumbstick movements — a skill many people don't have going in, especially if they don't game regularly. When attempting to collect continuous data, dropping someone straight into a real trial risks confounding "couldn't operate the controller" with the construct actually being measured. This protocol is a standardised warm-up that helps you train naive participants to handle gamepads or Joysticks.

## Features

- **Welcome page** – overview and stage-by-stage navigation with progress pills
- **About the Device** – introduces the controller's layout and how to hold it, and lets the participant choose their preferred thumbstick (left or right)
- **Stage 1: Controller Familiarisation** – a guided checklist with live visual feedback (an on-screen stick and button diagram) that confirms the participant can find and use each control
- **Stage 2: Random Dot Motion Task** – a classic RDM discrimination task where the participant reports the net direction of a field of moving dots using the thumbstick; coherence adapts to performance via a staircase procedure, with a pass threshold before continuing
- **Stage 3: Questionnaire for Hardware Comfort & Familiarity** – a short survey (prior controller experience, usage frequency, comfort ratings, free-text feedback) with automatic reverse-scoring on negatively worded items
- **Session export** – combines Stage 1 progress, every Stage 2 attempt (trial-by-trial), and questionnaire responses into a single tidy CSV per participant
- **No build step** – vanilla TypeScript compiled to plain JS, no bundler or framework dependency
- **Keyboard fallback** – stages remain usable without a gamepad connected, for testing and accessibility

## Tech stack

- TypeScript (compiled to ES modules, checked into the repo alongside the compiled `.js`)
- Vanilla HTML/CSS/JS — no frameworks, no bundler, no `node_modules`
- Browser [`Gamepad API`](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) for controller input, polled directly via `navigator.getGamepads()` each animation frame rather than relying on the (unreliable) `gamepadconnected` event
- `localStorage` for in-session persistence; a manual CSV export for handing data off to the experimenter

## Getting started

No installation or build step is required to run the app — the `.js` files are already compiled and checked in.

1. Clone the repository:
   ```bash
   git clone https://github.com/pathakdivya/gamepad-training-protocol.git
   cd gamepad-training-protocol
   ```
2. Serve the folder with any static file server (opening `index.html` directly via `file://` will not work, since the pages load ES modules). For example:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in a Chromium-based browser (Chrome or Edge — the Gamepad API's behaviour varies across browsers, and this project has been tested primarily on Edge).
4. Connect a gamepad and press any button to activate it, then click **Welcome → Start Here** to begin.

### Editing the source

If you need to change behaviour, edit the `.ts` files, not the `.js` files directly — the `.js` files are compiled output and will be overwritten. Compile with the TypeScript compiler:

```bash
tsc --target es2020 --module es2020 *.ts
```

(Adjust flags to match your `tsconfig.json` if you add one; the project doesn't currently ship with a build config since it was authored without a bundler.)

## Project structure

```
├── index.html / about.html / stage1.html / stage2.html / stage3.html   # pages
├── about.ts / stage1.ts / stage2.ts / stage3.ts / storage.ts           # source (edit these)
├── about.js / stage1.js / stage2.js / stage3.js / storage.js           # compiled output
├── styles.css                                                          # all styling
└── images/                                                             # controller diagrams, logo
```

`storage.ts` is shared across all stages — it defines the data model (`Stage1Progress`, `Stage2Attempt`, `QuestionnaireResponses`, `SessionRecord`) and the CSV export logic.

## Data & privacy

All data is stored locally in the participant's browser (`localStorage`) and is only written to a file when the participant completes the final questionnaire and the session is exported as CSV. No data is transmitted anywhere by this app — export and handling of the resulting CSV is the experimenter's responsibility under their own IRB/ethics protocol.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

## Acknowledgements

Built as part of ongoing research work at NSLab, CGS, IIT Kanpur. The controller diagram and connection-detection approach draw on lessons learned adapting [controllercheck.org](https://controllercheck.org).

---

Designed by [divya@NSLab](https://github.com/pathakdivya)

