# -*- coding: utf-8 -*-
# One-shot surgical block deletion for river-hero.js (anchor-verified).
import sys

P = r"C:\Users\leecl\blog\source\hero\river-hero.js"
raw = open(P, encoding="utf-8", newline="").read()
if raw.count("\r\n") != raw.count("\n") or "\r" in raw.replace("\r\n", ""):
    sys.exit("file is not pure CRLF — aborting")
s = raw.replace("\r\n", "\n")   # work in LF; restore CRLF on write

def cut(s, start, end, label):
    if s.count(start) != 1:
        sys.exit(f"{label}: start anchor count = {s.count(start)}")
    if s.count(end) != 1:
        sys.exit(f"{label}: end anchor count = {s.count(end)}")
    i = s.index(start)
    j = s.index(end)
    if i >= j:
        sys.exit(f"{label}: start after end")
    removed = s[i:j]
    print(f"{label}: removed {removed.count(chr(10))} lines / {len(removed)} chars")
    return s[:i] + s[j:]

# A: FS_COMMON dead GLSL — worley + cloudDensity (keep 3D cloud noise below)
s = cut(s,
    "    // ── Smooth Worley (cellular) noise",
    "    // ── Volumetric clouds (3D raymarch, ported from the aurora sandbox) ──",
    "A worley/cloudDensity")

# B: FS_COMMON dead GLSL — hue2rgb .. field() (keep canyon family)
s = cut(s,
    "    // Pure-hue → RGB (full saturation/value)",
    "    // ── In-valley meandering canyon (smooth, reference-style)",
    "B hue2rgb..field")

# C: dead glyph() (samples u_atlas, calls field)
s = cut(s,
    "    // Glyph coverage at a device-pixel position",
    "    void main(){\n      vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);       // y down — 全 canvas [0,1]",
    "C glyph()")

# D1: main() live-path bankUV/P leftovers
old = ("      vec2 P  = uv * u_res;                       // screen px (glyph grid)\n"
       "      vec2 uvR = bankUV(uv);                      // banked uv for the horizon\n")
if s.count(old) != 1:
    sys.exit(f"D1: anchor count = {s.count(old)}")
s = s.replace(old, "", 1)
print("D1 main P/uvR: removed 2 lines")

# D2: main() dead tail after gl_FragColor — return; + #if 0 block + unreachable post
s = cut(s,
    "      return;\n#if 0",
    "    }\n  `;\n\n  // ── Offscreen sky pass",
    "D2 main dead tail")

# E: terrain worker promise + TDZ comment block
s = cut(s,
    "  // Terrain build runs in a Web Worker while the driver compiles — it is pure",
    "  let parCompile = gl.getExtension(\"KHR_parallel_shader_compile\");",
    "E terrainPromise block")

# F: glyph atlas pipeline (RAMP_*/TILE/ac/a2/tex/buildAtlas/buildDotAtlas/applyAtlas)
s = cut(s,
    "  // Glyph atlas — ramp rendered into a horizontal strip.",
    "  // Initial default uniforms + the ones reapplied after a context restore share",
    "F atlas pipeline")

# G: terrain texture builder + worker + upload (keep cam)
s = cut(s,
    "  // Generated terrain map. RG = 16-bit altitude; BA reserved for future valley/river data.",
    "  const cam = { clock: 0, lastNow: null };",
    "G terrain JS pipeline")

# H: rebuild — atlas texture section
s = cut(s,
    "    // Glyph atlas texture (recreate + re-param + re-upload the active ramp).",
    "    // Re-apply the slider/config defaults shared with the cold-start path.",
    "H rebuild atlas")

# I: rebuild — terrain texture section
s = cut(s,
    "    // Terrain texture (recreate + re-param + re-upload the persistent CPU data).",
    "    // In-shader text layer texture (recreate + re-param + re-upload current text).",
    "I rebuild terrain")

# J: day-1 sunset solver family (solveStartMin/vCenterJS/riverHorizonX/todWarp + consts)
s = cut(s,
    "  // ── Day-1 sunset → river alignment",
    "  const todStartMin = 510;",
    "J solver family")

open(P, "w", encoding="utf-8", newline="").write(s.replace("\n", "\r\n"))
print("OK — wrote", len(s.splitlines()), "lines /", len(s.replace("\n", "\r\n").encode("utf-8")), "bytes")
