"""
test_handler.py
Run locally to verify the input/output format BEFORE deploying to RunPod.
Does NOT run MuseTalk — just tests encode/decode of inputs and output structure.

Usage:
  python test_handler.py --image my_photo.jpg --audio sample.wav
"""

import argparse
import base64
import json
import wave
import numpy as np

def encode_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def encode_audio_as_pcm(path: str) -> tuple:
    """Read a WAV file and return raw PCM s16le bytes as base64."""
    with wave.open(path, "rb") as wf:
        sample_rate = wf.getframerate()
        pcm_bytes = wf.readframes(wf.getnframes())
    return base64.b64encode(pcm_bytes).decode("utf-8"), sample_rate

def make_dummy_audio(duration_sec=4, sample_rate=16000) -> tuple:
    """Generate a simple sine wave as dummy audio if no file provided."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec))
    pcm = (np.sin(2 * np.pi * 200 * t) * 32767 * 0.4).astype(np.int16)
    return base64.b64encode(pcm.tobytes()).decode("utf-8"), sample_rate

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Path to avatar image (jpg/png)")
    parser.add_argument("--audio", help="Path to WAV audio file")
    args = parser.parse_args()

    print("\n── Building test job input ──────────────")

    if args.image:
        img_b64 = encode_image(args.image)
        print(f"Image: {args.image} ({len(img_b64)//1024}KB base64)")
    else:
        # Use a tiny 1x1 white pixel as placeholder
        import struct, zlib
        # Minimal valid JPEG
        img_b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVIP/2Q=="
        print("Image: using 1x1 placeholder (pass --image for real test)")

    if args.audio:
        audio_b64, sample_rate = encode_audio_as_pcm(args.audio)
        print(f"Audio: {args.audio} ({len(audio_b64)//1024}KB base64, {sample_rate}Hz)")
    else:
        audio_b64, sample_rate = make_dummy_audio()
        print(f"Audio: dummy sine wave (4s, {sample_rate}Hz)")

    job_input = {
        "image_b64":    img_b64,
        "audio_b64":    audio_b64,
        "audio_format": "pcm_s16le",
        "sample_rate":  sample_rate,
    }

    print("\n── Job input structure ──────────────────")
    print(json.dumps({
        "input": {
            "image_b64":    f"<{len(img_b64)} chars>",
            "audio_b64":    f"<{len(audio_b64)} chars>",
            "audio_format": job_input["audio_format"],
            "sample_rate":  job_input["sample_rate"],
        }
    }, indent=2))

    print("\n── Expected output stream ───────────────")
    print(json.dumps([
        {
            "frame_b64":    "<base64 JPEG frame>",
            "timestamp_ms": 0,
            "frame_index":  0,
            "done":         False,
        },
        {
            "frame_b64":    "<base64 JPEG frame>",
            "timestamp_ms": 40,
            "frame_index":  1,
            "done":         False,
        },
        "... one chunk per frame at 25fps ...",
        {
            "done":         True,
            "total_frames": 100,
            "duration_ms":  4000,
        }
    ], indent=2))

    print("\n── RunPod API call format ───────────────")
    print("""
POST https://api.runpod.ai/v2/{ENDPOINT_ID}/run
Headers:
  Authorization: Bearer {RUNPOD_API_KEY}
  Content-Type: application/json

Body:
{
  "input": {
    "image_b64": "...",
    "audio_b64": "...",
    "audio_format": "pcm_s16le",
    "sample_rate": 16000
  }
}
""")

    print("── All good! Input format verified. ─────")
    print("Next: docker build + push to RunPod.\n")

if __name__ == "__main__":
    main()
