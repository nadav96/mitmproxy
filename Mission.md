# Mission: AgentForce in mitmweb

This file summarizes the work completed in this repo during this session.

## 1) Voice input (speech-to-text) for the AI assistant

### Goal
Enable speaking into the AI assistant input and have the transcription populate the text box, so you can then send the message normally.

### Implementation
- **Backend**: added an HTTP endpoint to transcribe recorded audio.
  - **File**: `mitmproxy/tools/web/app.py`
  - **Route**: `POST /ai/transcribe`
  - **Behavior**:
    - Accepts an uploaded audio file (`multipart/form-data`).
    - Calls OpenAI Whisper transcription (requires `OPENAI_API_KEY`).
    - Returns JSON `{ "text": "..." }`.

- **Frontend**: added microphone recording + upload.
  - **File**: `web/src/js/components/ProxyApp.tsx`
  - **Behavior**:
    - Uses `MediaRecorder` to record audio.
    - Sends the blob to `/ai/transcribe`.
    - Sets the transcription into `aiAssistantDraft` (the existing input value).

### Recording UX details
- While recording:
  - Textbox is replaced by a **live waveform** (canvas visualization driven by Web Audio API analyser).
  - Action buttons are replaced by **Cancel** and **Send**.
    - **Cancel** stops recording and discards audio (no transcription call).
    - **Send** stops recording and triggers transcription.
- While transcribing:
  - The waveform area is replaced with a **loading/typing dots animation**.

### Waveform sensitivity
- The waveform was made more responsive to quieter sound by applying a boosted nonlinear mapping when rendering the line.

### Files touched
- `mitmproxy/tools/web/app.py`
- `web/src/js/components/ProxyApp.tsx`
- `web/src/css/layout.less`


## 2) Smart Scan (flow summaries) improvements

### Goal
Make the flow summary scan faster and improve the UX so you can watch summaries/lightbulbs appear live.

### Backend: parallel scan with limited concurrency
- **File**: `mitmproxy/tools/web/app.py`
- **Route**: `POST /ai/flow_summaries` (SSE)
- **Change**:
  - Previously scanned flows **sequentially**.
  - Updated to scan in **parallel** using `asyncio` tasks with an `asyncio.Semaphore`.
  - Streams results as each request finishes.
  - Supports `concurrency` in the JSON payload (clamped to 1..10, default 4).

### Frontend: request includes concurrency
- **File**: `web/src/js/ducks/aiFlowSummaries.ts`
- **Change**: now sends `{ max_flows, concurrency: 4 }` when starting the scan.

### UX: make scan modal usable while watching live updates
- **Close AI drawer when opening scan modal**
  - **File**: `web/src/js/components/ProxyApp.tsx`
  - `openAIFlowSummaryScanModal()` now closes the AI drawer so you can see the flow list behind the modal.

- **Smart Search toggle visible as soon as summaries exist**
  - **File**: `web/src/js/components/ProxyApp.tsx`
  - Smart Search button is now shown whenever `aiFlowSummaryCount > 0` (even while scan is running).
  - The `smart_search` flag sent to `/ai/chat` is now enabled whenever:
    - the Smart Search toggle is on, and
    - at least one summary exists.


## 3) AI drawer UI polish

### Drawer header icon
- **Goal**: show the AgentForce icon next to the “Ask AgentForce” title.
- **Files**:
  - `web/src/js/components/ProxyApp.tsx`
  - `web/src/css/layout.less`
- **Implementation**:
  - Added an `<img src="/static/agentforce.png">` into the header title.
  - Styled it with `filter: none` so it is **not inverted**, and aligned it with the title text.


## 4) Deployment: EC2 + HTTPS ALB template

### Goal
Provide an IaC template that:
- provisions an EC2 instance to run mitmweb,
- exposes it securely over HTTPS using an ALB + ACM cert,
- clones/builds the repo on boot,
- makes it reachable from outside.

### Template added
- **File**: `deploy/mitmweb-ec2-alb.yaml`

### What it provisions
- **Application Load Balancer**:
  - Port 80 redirects to 443.
  - Port 443 terminates TLS using your `AcmCertificateArn`.
- **EC2 instance**:
  - `git clone` your repo and checkout `RepoRef`.
  - Build web assets (`web/npm ci` + `npm run ci-build-release`).
  - Create a Python venv and install mitmproxy (`pip install -e .`).
  - Run `mitmweb` as a **systemd service** with:
    - `--set web_host=0.0.0.0`
    - `--set web_port=<WebPort>`
  - `--set web_open_browser=false`
    - `--set web_password=$MITMWEB_PASSWORD`
- **SSM Parameter Store**:
  - Instance role can read two SecureString parameters:
    - `SsmOpenAiApiKeyParam`
    - `SsmWebPasswordParam`
  - Template includes permissive `kms:Decrypt` (can be tightened to a specific KMS key if desired).
- **Optional Route53 alias record**:
  - If `DomainName` and `HostedZoneId` are provided.

### Notes
- The template pins Node.js to **24.x** (matches repo’s `.github/node-version.txt`).
- If your repo is private, the `git clone` step needs additional auth wiring (deploy key, token in SSM, CodeCommit, etc.).


## Where to look (quick index)
- **AI assistant UI**: `web/src/js/components/ProxyApp.tsx`
- **AI transcribe + flow summaries backend**: `mitmproxy/tools/web/app.py`
- **Flow scan Redux/duck**: `web/src/js/ducks/aiFlowSummaries.ts`
- **AI assistant styling**: `web/src/css/layout.less`
- **EC2+ALB deploy template**: `deploy/mitmweb-ec2-alb.yaml`


## Open items / manual checks
- Manually verify in the UI:
  - recording waveform animates,
  - Cancel discards,
  - Send transcribes and fills the textbox,
  - transcribing shows loading animation,
  - scan shows live per-flow lightbulbs while modal is open,
  - Smart Search toggle remains visible once at least one summary exists.
