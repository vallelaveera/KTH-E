"""
Patches MuseTalk's preprocessing.py to use absolute paths.
Run this during Docker image build.
"""
path = "/workspace/MuseTalk/musetalk/utils/preprocessing.py"

with open(path, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "config_file" in line and "rtmpose" in line:
        line = "config_file = '/workspace/MuseTalk/musetalk/utils/dwpose/rtmpose-l_8xb32-270e_coco-ubody-wholebody-384x288.py'\n"
        print(f"Patched config_file line")
    if "checkpoint_file" in line and "dw-ll" in line:
        line = "checkpoint_file = '/workspace/MuseTalk/models/dwpose/dw-ll_ucoco_384.pth'\n"
        print(f"Patched checkpoint_file line")
    new_lines.append(line)

with open(path, "w") as f:
    f.writelines(new_lines)

print("Done patching preprocessing.py")

# Verify
with open(path, "r") as f:
    for i, line in enumerate(f.readlines()):
        if "config_file" in line or "checkpoint_file" in line:
            if "rtmpose" in line or "dw-ll" in line:
                print(f"Line {i+1}: {line.rstrip()}")
