#!/usr/bin/env python3
"""Generate Toole app icons and splash screens."""

from PIL import Image, ImageDraw, ImageFont
import os

ASSETS = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')

PRIMARY = (29, 158, 117)      # #1D9E75
PRIMARY_DARK = (15, 110, 86)  # #0F6E56
WHITE = (255, 255, 255)

def make_icon(size, filename, transparent=False, padding_ratio=0.0):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent else PRIMARY)
    draw = ImageDraw.Draw(img)

    pad = int(size * padding_ratio)
    if transparent:
        # Draw filled circle bg
        draw.ellipse([pad, pad, size - pad, size - pad], fill=PRIMARY)

    # Draw a rounded "T" mark (package)
    # Box outline (package)
    inner = int(size * 0.28)
    box_pad = int(size * 0.22)
    x1, y1 = box_pad, box_pad
    x2, y2 = size - box_pad, size - box_pad
    r = int(size * 0.06)

    # Rounded rectangle (package body)
    draw.rounded_rectangle([x1, y1, x2, y2], radius=r, outline=WHITE, width=int(size * 0.035))
    # Top flap line
    mid_y = y1 + (y2 - y1) // 3
    draw.line([(x1, mid_y), (x2, mid_y)], fill=WHITE, width=int(size * 0.035))
    # Handle/label
    handle_w = int(size * 0.14)
    handle_cx = (x1 + x2) // 2
    draw.rectangle(
        [handle_cx - handle_w // 2, y1 - int(size * 0.06), handle_cx + handle_w // 2, y1 + int(size * 0.02)],
        fill=WHITE,
    )

    img.save(os.path.join(ASSETS, filename), 'PNG')
    print(f'Generated {filename} ({size}x{size})')


def make_splash(filename):
    size = 1242
    img = Image.new('RGBA', (size, size), PRIMARY)
    draw = ImageDraw.Draw(img)

    # Centered package icon (70% of canvas)
    icon_size = int(size * 0.4)
    off = (size - icon_size) // 2
    box_pad = int(icon_size * 0.1)
    x1, y1 = off + box_pad, off + box_pad
    x2, y2 = off + icon_size - box_pad, off + icon_size - box_pad
    r = int(icon_size * 0.06)

    draw.rounded_rectangle([x1, y1, x2, y2], radius=r, outline=WHITE, width=int(icon_size * 0.035))
    mid_y = y1 + (y2 - y1) // 3
    draw.line([(x1, mid_y), (x2, mid_y)], fill=WHITE, width=int(icon_size * 0.035))
    handle_w = int(icon_size * 0.14)
    handle_cx = (x1 + x2) // 2
    draw.rectangle(
        [handle_cx - handle_w // 2, y1 - int(icon_size * 0.06), handle_cx + handle_w // 2, y1 + int(icon_size * 0.02)],
        fill=WHITE,
    )

    img.save(os.path.join(ASSETS, filename), 'PNG')
    print(f'Generated {filename}')


if __name__ == '__main__':
    make_icon(1024, 'icon.png')
    make_icon(1024, 'adaptive-icon.png', transparent=True, padding_ratio=0.1)
    make_icon(48, 'favicon.png')
    make_splash('splash-icon.png')
    print('Done!')
