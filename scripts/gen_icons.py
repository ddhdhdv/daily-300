# -*- coding: utf-8 -*-
"""
生成 PWA 图标（纯标准库：struct + zlib 手写 PNG 编码）。
图标：蓝色渐变圆角方块 + 白色进度环（顶部缺口）+ 中心白点。
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'icons')

TOP = (86, 118, 248)     # 顶部渐变色
BOTTOM = (62, 88, 240)   # 底部渐变色
WHITE = (255, 255, 255)


def png_chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + r for r in rows)
    data = b'\x89PNG\r\n\x1a\n'
    data += png_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    data += png_chunk(b'IDAT', zlib.compress(raw, 9))
    data += png_chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


def gen(size, path, maskable=False):
    half = size / 2.0
    if maskable:
        # maskable：背景全填充，内容缩到安全区（约 80%）
        r_out, r_in, r_dot = size * 0.26, size * 0.185, size * 0.048
        corner = 0.0
    else:
        r_out, r_in, r_dot = size * 0.335, size * 0.245, size * 0.062
        corner = size * 0.225

    rows = []
    for y in range(size):
        py = y + 0.5
        row = bytearray()
        for x in range(size):
            px = x + 0.5
            # 圆角透明背景
            alpha = 255
            if corner > 0:
                dx = max(abs(px - half) - (half - corner), 0.0)
                dy = max(abs(py - half) - (half - corner), 0.0)
                if math.hypot(dx, dy) > corner:
                    alpha = 0
            # 垂直渐变
            t = py / size
            r = int(TOP[0] + (BOTTOM[0] - TOP[0]) * t)
            g = int(TOP[1] + (BOTTOM[1] - TOP[1]) * t)
            b = int(TOP[2] + (BOTTOM[2] - TOP[2]) * t)
            # 进度环（缺口在顶部 60°~120°）
            ddx = px - half
            ddy = py - half
            dist = math.hypot(ddx, ddy)
            if r_in <= dist <= r_out:
                ang = math.degrees(math.atan2(-ddy, ddx))  # 右=0，上=90
                if not (60 < ang < 120):
                    r, g, b = WHITE
            elif dist <= r_dot:
                r, g, b = WHITE
            row += bytes((r, g, b, alpha))
        rows.append(bytes(row))
    write_png(path, size, rows)


def main():
    os.makedirs(OUT, exist_ok=True)
    gen(192, os.path.join(OUT, 'icon-192.png'))
    gen(512, os.path.join(OUT, 'icon-512.png'))
    gen(512, os.path.join(OUT, 'maskable-512.png'), maskable=True)
    print('icons generated at', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
