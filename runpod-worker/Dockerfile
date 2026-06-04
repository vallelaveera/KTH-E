FROM runpod/base:0.4.0-cuda11.8.0

WORKDIR /workspace

# System deps
RUN apt-get update -qq && apt-get install -y -qq \
    git ffmpeg libgl1 libglib2.0-0 \
    python3-pip wget && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clone MuseTalk 1.5
RUN git clone https://github.com/TMElyralab/MuseTalk.git /workspace/MuseTalk

# Download model weights at build time so worker starts instantly
RUN python3 -c "\
from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='TMElyralab/MuseTalk', local_dir='/workspace/MuseTalk/models/musetalk'); \
snapshot_download(repo_id='stabilityai/sd-vae-ft-mse', local_dir='/workspace/MuseTalk/models/sd-vae-ft-mse'); \
"

# Download Whisper tiny
RUN python3 -c "\
import whisper; \
whisper.load_model('tiny', download_root='/workspace/MuseTalk/models/whisper'); \
"

# Download DWPose
RUN mkdir -p /workspace/MuseTalk/models/dwpose && \
    wget -q -O /workspace/MuseTalk/models/dwpose/dw-ll_ucoco_384.pth \
    https://huggingface.co/yzd-v/DWPose/resolve/main/dw-ll_ucoco_384.pth

# Copy handler
COPY handler.py /workspace/handler.py

ENV MUSETALK_PATH=/workspace/MuseTalk
ENV MODELS_PATH=/workspace/MuseTalk/models
ENV PYTHONPATH=/workspace/MuseTalk
ENV BATCH_SIZE=8

CMD ["python3", "-u", "/workspace/handler.py"]
