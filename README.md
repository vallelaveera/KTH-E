# muse_talk

Real-time AI video interview platform. Candidate sees a talking AI avatar in a small corner video, their own webcam takes the main screen — exactly like a video call.

## How it works

```
Candidate speaks (live mic)
        ↓
Soniox STT → real-time transcript
        ↓
Claude Sonnet → generates next interview question
        ↓
Soniox TTS → streams PCM audio (pcm_s16le, 16kHz)
        ↓
MuseTalk 1.5 → lip sync video frames (~30fps)
        ↓
WebRTC → streams to browser in real time
        ↓
Browser → AI avatar in corner, candidate webcam full screen
```

## Target latency

~1.8 seconds from candidate finishing answer to AI avatar speaking next question.

## Stack

| Layer | Tech |
|---|---|
| Lip sync | MuseTalk 1.5 (open source, Tencent) |
| STT | Soniox real-time streaming |
| TTS | Soniox real-time streaming (pcm_s16le) |
| LLM | Claude Sonnet (Anthropic) |
| GPU | RunPod Serverless (RTX 4090) |
| Server | Node.js + WebSocket |
| Browser | Vanilla JS + Canvas + Web Audio API |
| Deploy | Vercel (browser) + RunPod (GPU worker) |

## Repo structure

```
muse_talk/
├── runpod-worker/        ← Python, runs on GPU
│   ├── handler.py        ← RunPod serverless entry point
│   ├── musetalk.py       ← MuseTalk 1.5 wrapper
│   ├── requirements.txt
│   └── Dockerfile
│
├── server/               ← Node.js orchestration
│   ├── index.js          ← WebSocket server
│   ├── soniox.js         ← STT + TTS streaming
│   ├── claude.js         ← question generation
│   └── package.json
│
└── browser/              ← Frontend, deployed on Vercel
    ├── index.html        ← interview UI
    ├── buffer.js         ← jitter buffer (10 frame minimum)
    ├── renderer.js       ← canvas + audio sync engine
    └── capture.js        ← webcam + mic capture
```

## Why this is different

Tavus and HeyGen charge $30–80 per interview. This stack costs ~$0.80 per interview. The core technical moat is the MuseTalk → WebRTC streaming pipeline — taking MuseTalk's variable-rate frame output and converting it into a smooth 30fps WebRTC stream with audio locked to video via timestamps. Nobody has open sourced this cleanly.

## Build order

1. `runpod-worker/` — get MuseTalk outputting timestamped frames from PCM audio
2. `browser/` — get canvas + audio playing in sync from dummy data
3. Wire them together — real frames, real audio, measure latency
4. `server/` — add Claude + Soniox for full interview loop

## Environment variables

```
SONIOX_API_KEY=
ANTHROPIC_API_KEY=
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=
```

## Status

- [ ] RunPod worker — MuseTalk 1.5 + PCM input + timestamped frame output
- [ ] Browser renderer — jitter buffer + canvas + Web Audio sync
- [ ] Server orchestration — Soniox STT/TTS + Claude + RunPod
- [ ] Full interview loop — end to end test
