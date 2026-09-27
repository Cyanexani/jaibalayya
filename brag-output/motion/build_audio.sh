#!/bin/bash
# Re-cut "Sucker" on downbeats: intro+verse (0.90-18.54) | pre-chorus+chorus (34.19-55.07) | last bar + drop-out (60.28-65.31)
set -e
M=../composition/assets/music/sucker.mp3
S=../../.claude/skills/brag/assets/sfx
ffmpeg -v error -y -ss 0.90 -t 17.64 -i $M -ss 34.19 -t 20.88 -i $M -ss 60.28 -t 5.03 -i $M -filter_complex \
"[0:a]afade=t=out:st=17.62:d=0.02[a];[1:a]afade=t=in:d=0.02,afade=t=out:st=20.86:d=0.02[b];[2:a]afade=t=in:d=0.02,afade=t=out:st=4.2:d=0.83[c];[a][b][c]concat=n=3:v=0:a=1,aresample=44100" music.wav
# sfx: file|time|gain
SFX=(
"interface/drop_001.ogg|3.732|0.45" "impact/impactGlass_light_001.ogg|4.174|0.22" "impact/impactGlass_light_002.ogg|4.603|0.22" "impact/impactGlass_light_003.ogg|5.021|0.22"
"casino/card-slide-1.ogg|7.18|0.3" "casino/card-shove-1.ogg|8.9|0.3" "casino/card-slide-2.ogg|14.15|0.3" "casino/card-slide-3.ogg|15.9|0.35"
"casino/chip-lay-1.ogg|19.824|0.35" "casino/chip-lay-2.ogg|20.254|0.35" "casino/chip-lay-3.ogg|20.683|0.35"
"interface/drop_002.ogg|21.124|0.4" "impact/impactPlate_light_000.ogg|21.995|0.3" "impact/impactSoft_medium_000.ogg|24.5|0.45"
"casino/card-fan-1.ogg|24.607|0.45" "ui/mouseclick1.ogg|28.52|0.5" "interface/drop_001.ogg|28.95|0.4" "impact/impactPlate_light_000.ogg|31.562|0.35"
"casino/chip-lay-2.ogg|33.292|0.35" "casino/chip-lay-3.ogg|33.733|0.35" "casino/card-fan-2.ogg|35.033|0.45" "ui/mouseclick1.ogg|38.052|0.5"
"impact/impactSoft_medium_001.ogg|38.519|0.3" "impact/impactSoft_medium_002.ogg|38.96|0.3" "impact/impactSoft_medium_003.ogg|39.401|0.3" "impact/impactBell_heavy_000.ogg|39.831|0.5"
)
IN="-i music.wav"; F=""; L="[0:a]volume=0.82[m];"; n=1; MIX="[m]"
for s in "${SFX[@]}"; do IFS='|' read f t g <<< "$s"; IN="$IN -i $S/$f"; ms=$(python3 -c "print(int(round($t*1000)))"); L="$L[$n:a]aresample=44100,adelay=$ms|$ms,volume=$g[s$n];"; MIX="$MIX[s$n]"; n=$((n+1)); done
ffmpeg -v error -y $IN -filter_complex "$L${MIX}amix=inputs=$n:normalize=0:duration=first,alimiter=limit=0.95,afade=t=out:st=42.95:d=0.6" -ar 44100 -ac 2 mix.wav
