/**
 * muse_talk — Interview Server
 * Orchestrates: Soniox STT → Claude → Soniox TTS → Modal MuseTalk
 */

require("dotenv").config();

const { SonioxNodeClient } = require("@soniox/node");
const sonioxClient = new SonioxNodeClient();

const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
const http = require("http");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: "50mb" }));
app.use(express.static("../browser"));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
async function transcribeAudio(audioB64, mimeType) {
  const audioBuffer = Buffer.from(audioB64, 'base64');
  const response = await axios.post(
    'https://api.soniox.com/v1/speech/transcribe',
    audioBuffer,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SONIOX_API_KEY}`,
        'Content-Type': mimeType || 'audio/webm',
      }
    }
  );
  return response.data.text || response.data.transcript || 'Could not transcribe';
}

// ── Interview state per session ───────────────────────────────────────────────

const sessions = new Map();

function createSession(ws) {
  return {
    ws,
    history: [],
    questionCount: 0,
    candidateName: "Candidate",
  };
}

// ── Claude — generate next interview question ─────────────────────────────────

async function generateQuestion(session, candidateAnswer = null) {
  const systemPrompt = `You are an AI interviewer conducting a professional job interview.
Ask one clear, concise interview question at a time.
If this is the first question, introduce yourself briefly and ask the first question.
Base follow-up questions on the candidate's previous answer.
Keep questions focused and under 3 sentences.
After 5-6 questions, wrap up the interview professionally.`;

  if (candidateAnswer) {
    session.history.push({
      role: "user",
      content: `Candidate answered: "${candidateAnswer}"`,
    });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    system: systemPrompt,
    messages:
      session.history.length > 0
        ? session.history
        : [{ role: "user", content: "Start the interview. Ask the first question." }],
  });

  const question = response.content[0].text;

  session.history.push({ role: "assistant", content: question });
  session.questionCount++;

  return question;
}

// ── Soniox TTS — text to PCM audio ───────────────────────────────────────────

async function textToSpeech(text) {
  const audio = await sonioxClient.tts.generate({
    text,
    voice: "Adrian",
    model: "tts-rt-v1",
    language: "en",
    audio_format: "pcm_s16le",
    sample_rate: 16000,
  });
  return Buffer.from(audio);
}

// ── Modal MuseTalk — PCM audio + image → video frames ────────────────────────
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

async function generateVideo(imageB64, audioPcmBuffer) {
  // Write inputs to temp files
  const tmpImg = path.join(__dirname, "tmp_img.b64");
  const tmpAudio = path.join(__dirname, "tmp_audio.b64");
  const tmpOut = path.join(__dirname, "tmp_frames.json");

  fs.writeFileSync(tmpImg, imageB64);
  fs.writeFileSync(tmpAudio, audioPcmBuffer.toString("base64"));

  // Call Python script that uses Modal
  await new Promise((resolve, reject) => {
    execFile("python", [
      path.join(__dirname, "../runpod-worker/call_modal.py"),
      tmpImg, tmpAudio, tmpOut
    ], { timeout: 120000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const frames = JSON.parse(fs.readFileSync(tmpOut, "utf8"));
  return frames;
}

// ── Full pipeline: text → audio → video frames ───────────────────────────────

async function questionToVideo(session, questionText) {
  const ws = session.ws;

  // Notify client we're generating
  ws.send(JSON.stringify({ type: "generating", text: questionText }));

  // Step 1: TTS
  ws.send(JSON.stringify({ type: "status", message: "Generating speech..." }));
  const audioPcm = await textToSpeech(questionText);

  // Step 2: MuseTalk
  ws.send(JSON.stringify({ type: "status", message: "Generating video..." }));
  const frames = await generateVideo(session.avatarB64, audioPcm);

  // Step 3: Send frames to browser
  const realFrames = frames.filter((f) => !f.done);
  const summary = frames.find((f) => f.done);

  ws.send(
    JSON.stringify({
      type: "video_ready",
      text: questionText,
      frames: realFrames,
      duration_ms: summary?.duration_ms || 0,
      audio_b64: audioPcm.toString("base64"),
    })
  );
}

// ── WebSocket handler ─────────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  console.log("Client connected");
  const session = createSession(ws);

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        // Client sends avatar image and starts interview
        case "start_interview": {
          session.avatarB64 = msg.avatar_b64;
          session.candidateName = msg.candidate_name || "Candidate";

          console.log(`Interview started for ${session.candidateName}`);

          const question = await generateQuestion(session);
          await questionToVideo(session, question);
          break;
        }

        // Client sends candidate's transcribed answer
        case "candidate_answer": {
          const answer = msg.text;
          console.log(`Candidate answered: ${answer.substring(0, 50)}...`);

          if (session.questionCount >= 6) {
            // End interview
            const closing =
              "Thank you so much for your time today. We really enjoyed learning about your experience. We'll be in touch soon with next steps. Have a great day!";
            await questionToVideo(session, closing);
            ws.send(JSON.stringify({ type: "interview_complete" }));
          } else {
            const question = await generateQuestion(session, answer);
            await questionToVideo(session, question);
          }
          break;
        }

        // Client sends live audio chunk for STT
        case "audio_chunk": {
          // Forward to Soniox STT
          // For now just acknowledge — full STT streaming comes next
          ws.send(JSON.stringify({ type: "stt_ready" }));
          break;
        }

        case 'audio_answer': {
          const transcribed = await transcribeAudio(msg.audio_b64, msg.mime_type);
          console.log(`Candidate: ${transcribed}`);
          ws.send(JSON.stringify({ type: 'candidate_transcribed', text: transcribed }));
          const question = await generateQuestion(session, transcribed);
          await questionToVideo(session, question);
          break;
        }
      }
    } catch (err) {
      console.error("Error handling message:", err.message);
      ws.send(JSON.stringify({ type: "error", message: err.message }));
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    sessions.delete(ws);
  });

  // Send ready signal
  ws.send(JSON.stringify({ type: "connected", message: "Interview server ready" }));
});

// ── Start server ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  muse_talk server running
  ─────────────────────────
  http://localhost:${PORT}
  WebSocket: ws://localhost:${PORT}
  `);
});
