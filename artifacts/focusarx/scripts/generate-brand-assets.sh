#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FocusArx brand asset pipeline (ImageMagick 6+).
#
# Renders the mark (authored in SVG at public/brand/focusarx-mark.svg) into
# the raster set the product ships: favicon, PWA icons (any + maskable),
# apple-touch icon, org logo and the social OG card. The SVG is the single
# authored source of truth; run this script after editing it and commit the
# refreshed PNGs. Pure IM primitives — no rsvg delegate required.
#
# Tiles:   iris gradient (#8A5CFF → #4E7CFF, NW→SE) inside a 22.3% rounded
#          squircle, specular sheen at the top, soft inner glow, white
#          focus reticle (ring r .309 · dot r .071 of canvas — keep these
#          ratios in sync with the SVG and components/ui/brand.tsx).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/../public"

GRAD_FROM="#8A5CFF"
GRAD_TO="#4E7CFF"
CORNER=228                       # 22.3% of the 1024 canvas
SIZE=1024
SHEEN_DEPTH=$((SIZE * 42 / 100)) # where the specular fades out

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1 ── Diagonal iris gradient base (light NW → deep azure SE) ────────────────
convert -size ${SIZE}x${SIZE} \
  -define gradient:direction=SouthEast \
  gradient:"${GRAD_FROM}"-"${GRAD_TO}" "$TMP/base.png"

# 2 ── Squircle alpha mask ────────────────────────────────────────────────────
convert -size ${SIZE}x${SIZE} xc:black -fill white \
  -draw "roundrectangle 0,0,$((SIZE-1)),$((SIZE-1)) ${CORNER},${CORNER}" \
  "$TMP/mask.png"

# 3 ── Tile: gradient clipped to the squircle ─────────────────────────────────
convert "$TMP/base.png" "$TMP/mask.png" -alpha off \
  -compose CopyOpacity -composite "$TMP/tile.png"

# 4 ── Specular sheen: white fading to nothing 42% down the tile ──────────────
convert -size ${SIZE}x${SHEEN_DEPTH} gradient:"#FFFFFF"-"#000000" "$TMP/sheen-gray.png"
convert -size ${SIZE}x${SIZE} xc:black "$TMP/sheen-gray.png" \
  -gravity north -composite "$TMP/sheen-mask.png"
convert -size ${SIZE}x${SIZE} xc:white "$TMP/white.png"
convert "$TMP/white.png" "$TMP/sheen-mask.png" -alpha off \
  -compose CopyOpacity -composite "$TMP/sheen.png"
# Clip the sheen to the squircle (multiply alpha channels).
convert "$TMP/sheen.png" "$TMP/tile.png" -alpha set \
  -compose DstIn -composite "$TMP/sheen.png"

# 5 ── Soft inner glow behind the reticle ─────────────────────────────────────
convert -size ${SIZE}x${SIZE} \
  radial-gradient:"rgba(255,255,255,0.30)"-"rgba(255,255,255,0)" "$TMP/glow.png"
convert "$TMP/glow.png" "$TMP/tile.png" -alpha set \
  -compose DstIn -composite "$TMP/glow.png"

# 6 ── Compose the full-bleed 1024 mark ───────────────────────────────────────
convert "$TMP/tile.png" "$TMP/glow.png" -compose over -composite "$TMP/mark-a.png"
convert "$TMP/mark-a.png" "$TMP/sheen.png" -compose over -composite "$TMP/mark-b.png"
convert "$TMP/mark-b.png" \
  -stroke "#FFFFFF" -strokewidth 98 -fill none \
  -draw "circle 512,512 828,512" \
  -stroke none -fill "#FFFFFF" \
  -draw "circle 512,512 585,512" \
  "$TMP/mark-1024.png"

# 7 ── Emit the raster set ────────────────────────────────────────────────────
render() { # src size out
  convert "$1" -filter Lanczos -resize "${2}x${2}" \
    -depth 8 -define png:color-type=6 "$3"
}

render "$TMP/mark-1024.png" 48  favicon.png
render "$TMP/mark-1024.png" 180 icon-180.png
render "$TMP/mark-1024.png" 192 icon-192.png
render "$TMP/mark-1024.png" 512 icon-512.png
render "$TMP/mark-1024.png" 512 logo.png

# Maskable: content kept inside the central 80% safe zone (tile at 74%).
convert -size ${SIZE}x${SIZE} xc:none \
  \( "$TMP/mark-1024.png" -resize 758x758 \) -gravity center -composite \
  -filter Lanczos -resize 512x512 -depth 8 -define png:color-type=6 icon-maskable-512.png

# 8 ── OG card (1200×630): deep ink field, brand auroras, mark + halo ────────
convert -size 1200x630 gradient:"#0B0E19"-"#131A33" "$TMP/og-bg.png"
convert -size 900x900 radial-gradient:"rgba(138,92,255,0.34)"-"rgba(138,92,255,0)" "$TMP/og-a.png"
convert -size 900x900 radial-gradient:"rgba(78,124,255,0.30)"-"rgba(78,124,255,0)" "$TMP/og-b.png"
convert "$TMP/og-bg.png" \
  \( "$TMP/og-a.png" -resize 720x720 \) \
  -gravity northwest -geometry +40-260 -compose over -composite "$TMP/og-1.png"
convert "$TMP/og-1.png" \
  \( "$TMP/og-b.png" -resize 900x900 \) \
  -gravity southeast -geometry +40+40 -compose over -composite "$TMP/og-2.png"
convert "$TMP/og-2.png" \
  -strokewidth 2 -stroke "rgba(255,255,255,0.09)" -fill none \
  -draw "circle 600,315 960,315" \
  "$TMP/og-3.png"
convert "$TMP/og-3.png" \
  \( "$TMP/mark-1024.png" -resize 316x316 \) \
  -gravity center -compose over -composite "$TMP/og-card.png"
convert "$TMP/og-card.png" -strip -quality 90 opengraph.jpg

echo "brand assets written: $(ls -1 favicon.png icon-180.png icon-192.png icon-512.png icon-maskable-512.png logo.png opengraph.jpg | tr '\n' ' ')"
