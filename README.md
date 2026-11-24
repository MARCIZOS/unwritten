# UNWRITTEN — the AI that asks what nobody thought to ask

> Philosopher Michael Polanyi wrote that *we can know more than we can tell*. UNWRITTEN helps us tell it.

Every family and workshop has knowledge that was never written down: *add salt andaz se*, *you just know when the batter is ready*. UNWRITTEN interviews an expert like a curious apprentice, notices the knowledge they use but never say, builds a guide, and then **tests whether a real beginner can learn from it**. Whatever the beginner still can't do goes back to the expert as new questions.

It is an AI designed not to replace human expertise, but to help humans pass it on.

Built for **#BuildHybridAI** with the **Firebase AI Logic hybrid inference SDK** (Web / Chrome).

## The Apprentice Loop

| # | Step | Where it runs |
|---|------|---------------|
| 1 | **Capture**: an AI apprentice interviews the expert | On-device (Gemini Nano in Chrome) |
| 2 | **Surface**: flags implicit knowledge: vague amounts, sensory checks, hidden conditions, hedges, "you just know" | On-device + keyword rules |
| 3 | **Build**: turns sessions into a step-by-step guide with *how you know it's right* for every step | Cloud (distilled notes only) |
| 4 | **Preserve**: Two Voices keeps both accounts when experts differ, never averaged | Cloud (distilled notes only) |
| 5 | **Test**: a beginner marks every line they couldn't act on and answers "what would you do if…?" | Cloud on the apprentice's phone |
| 6 | **Close & measure**: gaps become round-2 questions; the **Transfer Score** shows gaps found → resolved | Firestore |

## How Firebase AI Logic is used

All AI calls go through `firebase/ai` (see [`src/ai/models.js`](src/ai/models.js) and [`src/ai/index.js`](src/ai/index.js)). Each task picks the inference mode that matches its privacy and power needs:

| Task | Function | Inference mode | Why |
|------|----------|----------------|-----|
| Next interview question + cue detection | `nextTurn` | `ONLY_ON_DEVICE` (cloud only if the owner opts in) | Raw words stay on the laptop; works offline |
| Condense a session into notes | `distillSession` | `ONLY_ON_DEVICE` (same opt-in) | Raw transcript never goes to a cloud model |
| Build the guide | `buildGuide` | `ONLY_IN_CLOUD` | Long context, reasoning across sessions; a clear error beats a thin on-device guide |
| Two Voices comparison | `compareVoices` | `ONLY_IN_CLOUD` | Cross-document reasoning |
| Apprentice gaps → expert questions | `gapsFromTest` | `PREFER_IN_CLOUD` | Runs on phones with no local model |

- **One JSON Schema per task** constrains both sides: `onDeviceParams.promptOptions.responseConstraint` on-device and `responseJsonSchema` in the cloud ([`src/ai/schemas.js`](src/ai/schemas.js)).
- **Every response shows where it ran** (On-device / Cloud badge), read from `response.inferenceSource`.
- `initializeDeviceModel()` is called from the *Start interview* click, as Chrome requires a user gesture.
- **Graceful fallback**: if no model is available, keyword rules and question templates keep the interview going (badge: *Rules*). If the cloud fails during an Apprentice Test, the marked lines become gaps directly.
- **Hybrid in one demo**: the expert's laptop runs the interview on-device; the apprentice's phone (no local model) uses the cloud through the same SDK.

### Other Firebase products

- **App Check** (reCAPTCHA Enterprise; debug token locally): required by AI Logic, also protects Firestore.
- **Authentication**: a sign-in screen with **Continue with Google** or **Continue as a guest** (anonymous). A guest can link Google later and keep the same account and skills.
- **Cloud Firestore** with persistent offline cache: interviews work with Wi-Fi off and sync later; laptop and phone update each other live. Security rules in [`firestore.rules`](firestore.rules).
- **Remote Config**: cloud model name, cue types, cue keywords, follow-up limits, timeouts and prompt version, tunable without redeploying.
- **Hosting**: static build plus a PWA app shell that reloads offline.

## Run it locally

### 1. Firebase project (free Spark plan, no billing)

1. Create a project in the [Firebase console](https://console.firebase.google.com) and add a **Web app**.
2. **AI Services → AI Logic → Get started** → choose the **Gemini Developer API**.
3. **Firestore Database → Create database** (production mode).
4. **Authentication → Sign-in method** → enable **Anonymous** and **Google**.
5. **App Check** → register the web app with **reCAPTCHA Enterprise** and copy the site key.
6. *(Optional)* **Remote Config** → add any keys from `RC_DEFAULTS` in [`src/firebase/remoteConfig.js`](src/firebase/remoteConfig.js) to override them.

### 2. Configure and start

```bash
npm install
cp .env.example .env.local     # fill in the web app config + reCAPTCHA site key
npm run dev
```

Open the app, find the line *App Check debug token: …* in the browser console, and add it in **App Check → Apps → Manage debug tokens**. Never commit `.env.local` or the token.

### 3. Turn on Chrome's on-device model

1. Chrome desktop **139 or later**.
2. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart Chrome.
3. Needs about 22 GB free disk space and either a GPU with more than 4 GB of VRAM, or 16 GB RAM and 4+ CPU cores. Check `chrome://on-device-internals`.

The first *Start interview* click downloads the model if needed (progress bar shown). On any other browser or phone, the app runs in cloud mode or rules mode automatically.

### 4. Deploy

```bash
npm i -g firebase-tools && firebase login
firebase use --add                     # pick your project
npm run deploy                         # builds, deploys Hosting + Firestore rules
```

Then add your `web.app` and `firebaseapp.com` domains to the reCAPTCHA key and turn on App Check enforcement for Firestore.

## Design

The interface is the margin of a school notebook. The expert's words are written in blue-black ink (Martel, a typeface designed for Indian scripts). The AI apprentice writes in red pen in the margin (Kalam, a handwriting face that also covers Devanagari): it circles "andaz se" and scribbles *how much?* next to it. "How you know it's right" is marked with a haldi-yellow highlighter, and the Transfer Score is counted in tally marks. Fonts are bundled, so the app looks the same offline.

## Project structure

```text
src/
  firebase/   app, App Check, Auth, Firestore (offline cache), Remote Config
  ai/         models (hybrid SDK), schemas, prompts, cues (rules + templates), notes, ledger
  data/       Firestore reads/writes: skills, experts, sessions, guides, gaps, tests
  hooks/      useAuth, useDeviceModel, useSkill, useLive, useOnline
  components/ HybridBadge, CueChip, StatusBar, InviteDialog, PrivacyPanel
  pages/      Home, SkillNew, Skill, Interview, Guide, ApprenticeTest, Score, Join
tests/        unit tests for cue detection, grounding, scoring, notes, prompts
```

## Tests

```bash
npm test
```

## Privacy

The privacy panel (Transfer Score screen) lists every AI call from the browser, where it ran, and the exact text sent to the cloud. Raw interview words are processed by the on-device model; cloud models see only distilled notes unless the owner chooses cloud mode. Data is stored in your own Firebase project and can be deleted per skill.

## Limits, honestly

- On-device mode needs desktop Chrome with the flag above; phones use the cloud.
- The on-device model outputs English; Hindi words inside English answers ("andaz se") are fine.
- Some knowledge can't be put into words. UNWRITTEN marks those gaps **learn by doing** instead of pretending.

## License

[Apache 2.0](LICENSE)
