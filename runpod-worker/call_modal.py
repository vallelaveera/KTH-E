import sys
import json
import modal

img_b64   = open(sys.argv[1]).read().strip()
audio_b64 = open(sys.argv[2]).read().strip()
out_path  = sys.argv[3]

MuseTalkWorker = modal.Cls.from_name("muse-talk", "MuseTalkWorker")
instance = MuseTalkWorker()
frames = instance.infer.remote(img_b64, audio_b64, 16000)

with open(out_path, "w") as f:
    json.dump(frames, f)

print("Done:", len([f for f in frames if not f.get("done")]), "frames")