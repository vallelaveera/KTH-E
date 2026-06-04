"""
muse_talk - Modal GPU Worker v14
MuseTalk lip sync inference

Deploy:  python -m modal deploy handler.py
Test:    python -m modal run handler.py::test
"""

import base64
import os
import sys
import time
import wave
import logging
import numpy as np

import modal

log = logging.getLogger("muse_talk")

musetalk_image = (
    modal.Image.from_registry(
        "nvidia/cuda:11.7.1-cudnn8-devel-ubuntu20.04",
        add_python="3.10",
    )
    .run_commands(
        "ln -fs /usr/share/zoneinfo/UTC /etc/localtime",
        "echo UTC > /etc/timezone",
        "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata",
        "DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -f noninteractive tzdata",
    )
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0", "wget")
    .pip_install("numpy==1.26.4", "setuptools", "wheel")
    .pip_install(
        "torch==2.0.1",
        "torchvision==0.15.2",
        "torchaudio==2.0.2",
        index_url="https://download.pytorch.org/whl/cu117",
    )
    .pip_install(
        "opencv-python-headless",
        "pillow",
        "imageio",
        "imageio-ffmpeg",
        "einops",
        "omegaconf",
        "tqdm",
        "scipy==1.11.4",
        "huggingface_hub==0.21.4",
        "safetensors",
        "accelerate==0.28.0",
        "transformers==4.39.2",
        "diffusers==0.27.2",
        "openai-whisper",
        "face-alignment",
        "openmim",
        "gdown",
        "moviepy",
        "soundfile",
        "ffmpeg-python",
    )
    .run_commands(
        "mim install mmengine",
        "mim install 'mmcv==2.1.0'",
        "mim install mmdet",
        "mim install mmpose",
    )
    .run_commands(
        "git clone https://huggingface.co/spaces/TMElyralab/MuseTalk /workspace/MuseTalk",
        "mkdir -p /workspace/MuseTalk/musetalk/utils/dwpose",
        "wget -q -O /workspace/MuseTalk/musetalk/utils/dwpose/rtmpose-l_8xb32-270e_coco-ubody-wholebody-384x288.py https://huggingface.co/spaces/TMElyralab/MuseTalk/raw/main/musetalk/utils/dwpose/rtmpose-l_8xb32-270e_coco-ubody-wholebody-384x288.py",
        "wget -q -O /workspace/MuseTalk/musetalk/utils/dwpose/default_runtime.py https://huggingface.co/spaces/TMElyralab/MuseTalk/raw/main/musetalk/utils/dwpose/default_runtime.py",
        "sed -i 's|./models/|/workspace/MuseTalk/models/|g' /workspace/MuseTalk/musetalk/utils/preprocessing.py",
        "sed -i 's|./models/|/workspace/MuseTalk/models/|g' /workspace/MuseTalk/musetalk/utils/utils.py",
        "sed -i 's|./models/|/workspace/MuseTalk/models/|g' /workspace/MuseTalk/musetalk/models/unet.py",
        "sed -i 's|./models/|/workspace/MuseTalk/models/|g' /workspace/MuseTalk/musetalk/models/vae.py",
        "sed -i 's|./models/|/workspace/MuseTalk/models/|g' /workspace/MuseTalk/musetalk/utils/blending.py",
        "sed -i 's|./models/|/workspace/MuseTalk/models/|g' /workspace/MuseTalk/musetalk/utils/face_parsing/__init__.py",
        "wget -q -O /workspace/MuseTalk/musetalk/whisper/whisper/assets/mel_filters.npz https://raw.githubusercontent.com/openai/whisper/main/whisper/assets/mel_filters.npz",
    )
    .run_commands(
        "mkdir -p /workspace/MuseTalk/models/whisper && wget -q -O /workspace/MuseTalk/models/whisper/tiny.pt https://openaipublic.azureedge.net/main/whisper/models/65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9/tiny.pt",
        "python3 -c \"from huggingface_hub import snapshot_download; snapshot_download(repo_id='TMElyralab/MuseTalk', local_dir='/workspace/MuseTalk/models/musetalk')\"",
        "python3 -c \"from huggingface_hub import snapshot_download; snapshot_download(repo_id='stabilityai/sd-vae-ft-mse', local_dir='/workspace/MuseTalk/models/sd-vae-ft-mse')\"",
        # snapshot_download creates a nested musetalk/musetalk/ folder - fix with symlinks
        "ln -sf /workspace/MuseTalk/models/musetalk/musetalk/musetalk.json /workspace/MuseTalk/models/musetalk/musetalk.json",
        "ln -sf /workspace/MuseTalk/models/musetalk/musetalk/pytorch_model.bin /workspace/MuseTalk/models/musetalk/pytorch_model.bin",
        "mkdir -p /workspace/MuseTalk/models/dwpose && wget -q -O /workspace/MuseTalk/models/dwpose/dw-ll_ucoco_384.pth https://huggingface.co/yzd-v/DWPose/resolve/main/dw-ll_ucoco_384.pth",
        "mkdir -p /workspace/MuseTalk/models/face-parse-bisent && wget -q -O /workspace/MuseTalk/models/face-parse-bisent/resnet18-5c106cde.pth https://download.pytorch.org/models/resnet18-5c106cde.pth",
        "wget -q -O /workspace/MuseTalk/models/face-parse-bisent/79999_iter.pth https://huggingface.co/camenduru/MuseTalk/resolve/main/face-parse-bisent/79999_iter.pth",
        # Pre-download s3fd so it doesnt download at runtime
        "mkdir -p /root/.cache/torch/hub/checkpoints && wget -q -O /root/.cache/torch/hub/checkpoints/s3fd-619a316812.pth https://www.adrianbulat.com/downloads/python-fan/s3fd-619a316812.pth",
        # Verify
        "ls -la /workspace/MuseTalk/models/musetalk/musetalk.json",
        "ls -la /workspace/MuseTalk/models/musetalk/pytorch_model.bin",
    )
    .env({
        "PYTHONPATH": "/workspace/MuseTalk",
        "MUSETALK_PATH": "/workspace/MuseTalk",
        "MODELS_PATH": "/workspace/MuseTalk/models",
    })
)

app = modal.App("muse-talk")

@app.cls(
    image=musetalk_image,
    gpu="A10G",
    timeout=300,
    scaledown_window=60,
)
class MuseTalkWorker:

    @modal.enter()
    def __enter__(self):
        os.chdir("/workspace/MuseTalk")
        sys.path.insert(0, "/workspace/MuseTalk")

        from musetalk.utils.utils import load_all_model
        from musetalk.utils.preprocessing import get_landmark_and_bbox

        log.info("Loading MuseTalk models...")
        t = time.time()

        self.audio_processor, self.vae, self.unet, self.pe = load_all_model()
        self.get_landmark_and_bbox = get_landmark_and_bbox
        self.TARGET_FPS = 25
        self.BATCH_SIZE = 8

        log.info(f"Models ready in {time.time() - t:.1f}s")

    @modal.method()
    def infer(self, image_b64: str, audio_b64: str, sample_rate: int = 16000):
        import cv2
        import torch
        import tempfile
        import shutil
        from musetalk.utils.preprocessing import coord_placeholder
        from musetalk.utils.blending import get_image as get_image_blending

        os.chdir("/workspace/MuseTalk")

        tmp = tempfile.mkdtemp()
        frames_out = []

        try:
            img_path = self._save_image(image_b64, tmp)
            audio_path = self._save_audio(audio_b64, sample_rate, tmp)

            coord_list, frame_list, latent_list = self._preprocess_avatar(
                img_path, coord_placeholder
            )

            whisper_chunks = self.audio_processor.audio2feat(audio_path)

            ms_per_frame = 1000.0 / self.TARGET_FPS
            frame_index = 0

            for w_batch, l_batch in self._datagen(whisper_chunks, latent_list):
                latent_t = torch.cat(l_batch, dim=0)
                whisper_t = torch.FloatTensor(np.array(w_batch)).to(self.unet.device)

                with torch.no_grad():
                    timesteps = torch.zeros(latent_t.shape[0]).long().to(latent_t.device)
                    pred = self.unet.model(
                        latent_t,
                        timesteps,
                        encoder_hidden_states=whisper_t
                    ).sample

                recon_frames = self.vae.decode_latents(pred)

                for recon in recon_frames:
                    idx = frame_index % len(coord_list)
                    bbox = coord_list[idx]
                    bg = frame_list[idx].copy()

                    if bbox is not None:
                        x1, y1, x2, y2 = bbox
                        recon_r = cv2.resize(
                            recon, (x2 - x1, y2 - y1),
                            interpolation=cv2.INTER_LANCZOS4
                        )
                        bg = get_image_blending(bg, recon_r, bbox)

                    _, buf = cv2.imencode(
                        ".jpg", bg,
                        [cv2.IMWRITE_JPEG_QUALITY, 85]
                    )
                    frames_out.append({
                        "frame_b64": base64.b64encode(buf).decode(),
                        "timestamp_ms": int(frame_index * ms_per_frame),
                        "frame_index": frame_index,
                        "done": False,
                    })
                    frame_index += 1

            frames_out.append({
                "done": True,
                "total_frames": frame_index,
                "duration_ms": int(frame_index * ms_per_frame),
            })

        finally:
            shutil.rmtree(tmp, ignore_errors=True)

        return frames_out

    def _save_image(self, b64: str, tmp: str) -> str:
        path = os.path.join(tmp, "avatar.png")
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
        return path

    def _save_audio(self, b64: str, sample_rate: int, tmp: str) -> str:
        pcm = np.frombuffer(base64.b64decode(b64), dtype=np.int16)
        path = os.path.join(tmp, "audio.wav")
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm.tobytes())
        return path

    def _preprocess_avatar(self, img_path: str, coord_placeholder):
        import cv2
        coord_list, frame_list = self.get_landmark_and_bbox(
            [img_path]
        )
        latent_list = []
        for bbox, frame in zip(coord_list, frame_list):
            if bbox == coord_placeholder:
                continue
            x1, y1, x2, y2 = bbox
            crop = frame[y1:y2, x1:x2]
            crop = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_LANCZOS4)
            latent = self.vae.get_latents_for_unet(crop)
            latent_list.append(latent)

        coord_list = coord_list + coord_list[::-1]
        frame_list = frame_list + frame_list[::-1]
        latent_list = latent_list + latent_list[::-1]

        return coord_list, frame_list, latent_list

    def _datagen(self, whisper_chunks, latent_list):
        wb, lb = [], []
        for i, w in enumerate(whisper_chunks):
            wb.append(w)
            lb.append(latent_list[i % len(latent_list)])
            if len(wb) >= self.BATCH_SIZE:
                yield wb, lb
                wb, lb = [], []
        if wb:
            yield wb, lb


@app.local_entrypoint()
def test():
    import pathlib

    print("\n-- muse_talk Modal test -----------------")

    img_path = pathlib.Path("avatar.png")
    if img_path.exists():
        image_b64 = base64.b64encode(img_path.read_bytes()).decode()
        print(f"Image : avatar.png ({img_path.stat().st_size // 1024}KB)")
    else:
        print("ERROR: avatar.png not found")
        return
    import wave
    with wave.open("speech.wav", "rb") as wf:
        sample_rate = wf.getframerate()
        pcm = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16)
    audio_b64 = base64.b64encode(pcm.tobytes()).decode()
    print(f"Audio : speech.wav ({len(pcm)//sample_rate}s at {sample_rate}Hz)")


    print("\nSending to Modal GPU worker...")
    t_start = time.time()

    worker = MuseTalkWorker()
    frames = worker.infer.remote(image_b64, audio_b64, sample_rate)

    elapsed = time.time() - t_start

    real_frames = [f for f in frames if not f.get("done")]
    summary = next(f for f in frames if f.get("done"))

    print(f"\n-- Results ------------------------------")
    print(f"Total frames : {summary['total_frames']}")
    print(f"Video length : {summary['duration_ms']}ms")
    print(f"Wall time    : {elapsed:.2f}s")
    print(f"Frame size   : {len(real_frames[0]['frame_b64']) // 1024}KB (JPEG)")
    if elapsed > 0:
        print(f"Speed        : {summary['total_frames'] / elapsed:.1f} frames/sec")

    # Save all frames as video
    import cv2
    
    first = base64.b64decode(real_frames[0]['frame_b64'])
    first_arr = cv2.imdecode(np.frombuffer(first, np.uint8), cv2.IMREAD_COLOR)
    h, w = first_arr.shape[:2]
    
    out = cv2.VideoWriter('output_video.mp4', cv2.VideoWriter_fourcc(*'mp4v'), 25, (w, h))
    for f in real_frames:
        arr = cv2.imdecode(np.frombuffer(base64.b64decode(f['frame_b64']), np.uint8), cv2.IMREAD_COLOR)
        out.write(arr)
    out.release()
    print(f"Video saved as output_video.mp4!")

    print(f"\nSUCCESS - MuseTalk is working on Modal GPU!")
    print(f"Next: wire in real Soniox TTS audio.\n")
