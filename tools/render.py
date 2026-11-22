#!/usr/bin/env python3
"""把 fatfish 录下的像素帧转成 PNG / GIF / WebP。只在开发时用。"""
import argparse
import json
import os

from PIL import Image


def load(base):
    meta = json.load(open(base + ".json", encoding="utf-8"))
    raw = open(base + ".bin", "rb").read()
    w, h, n = meta["w"], meta["h"], meta["frames"]
    assert len(raw) == w * h * 3 * n, (len(raw), w * h * 3 * n)
    return meta, raw


def frame_image(raw, w, h, i, scale):
    o = i * w * h * 3
    im = Image.frombuffer("RGB", (w, h), raw[o:o + w * h * 3], "raw", "RGB", 0, 1)
    return im.resize((w * scale, h * scale), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="base", required=True)
    ap.add_argument("--png")
    ap.add_argument("--gif")
    ap.add_argument("--webp")
    ap.add_argument("--frame", type=int, default=0)
    ap.add_argument("--scale", type=int, default=5)
    ap.add_argument("--colors", type=int, default=128)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--fps", type=int, default=0)
    a = ap.parse_args()

    meta, raw = load(a.base)
    w, h, n = meta["w"], meta["h"], meta["frames"]
    fps = a.fps or meta["fps"]

    if a.png:
        frame_image(raw, w, h, a.frame, a.scale).save(a.png)
        print("png ", a.png, "%dx%d" % (w * a.scale, h * a.scale))

    if a.gif:
        imgs = [
            frame_image(raw, w, h, i, a.scale).quantize(
                colors=a.colors, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG
            )
            for i in range(n)
        ]
        imgs[0].save(
            a.gif, save_all=True, append_images=imgs[1:],
            duration=round(1000 / fps), loop=0, optimize=True, disposal=1,
        )
        print("gif ", a.gif, "%d frames" % n, os.path.getsize(a.gif) // 1024, "KB")

    if a.webp:
        frames = [frame_image(raw, w, h, i, a.scale) for i in range(n)]
        frames[0].save(
            a.webp, save_all=True, append_images=frames[1:],
            duration=round(1000 / fps), loop=0, quality=a.quality, method=4,
        )
        print("webp", a.webp, os.path.getsize(a.webp) // 1024, "KB")


main()
