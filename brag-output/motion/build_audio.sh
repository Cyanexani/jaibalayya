#!/bin/bash
# "Sucker" straight through, 0.90-65.31: intro, verse, break, pre-chorus, chorus, post-chorus, drop-out, return
set -e
M=../composition/assets/music/sucker.mp3
S=../../.claude/skills/brag/assets/sfx
ffmpeg -v error -y -ss 0.90 -t 64.41 -i $M -af "afade=t=out:st=63.58:d=0.83,aresample=44100" music.wav
# sfx: file|time|gain
SFX=(
"interface/drop_001.ogg|3.732|0.45" "impact/impactGlass_light_001.ogg|4.174|0.22" "impact/impactGlass_light_002.ogg|4.603|0.22" "impact/impactGlass_light_003.ogg|5.021|0.22"
"casino/card-slide-1.ogg|7.18|0.3" "casino/card-shove-1.ogg|8.9|0.3" "casino/card-slide-2.ogg|14.15|0.3" "casino/card-slide-3.ogg|15.9|0.35"
"interface/select_008.ogg|18.071|0.3" "interface/click_001.ogg|18.5|0.15" "interface/click_002.ogg|18.942|0.15" "interface/click_003.ogg|19.383|0.15"
"interface/click_004.ogg|19.812|0.15" "interface/click_005.ogg|20.253|0.15" "interface/click_001.ogg|20.671|0.15" "interface/click_002.ogg|21.124|0.15"
"casino/card-slide-4.ogg|21.124|0.25" "casino/card-slide-5.ogg|21.983|0.25" "casino/card-slide-6.ogg|22.866|0.25" "casino/card-slide-7.ogg|23.725|0.25"
"casino/card-shove-2.ogg|24.596|0.3" "casino/chip-lay-1.ogg|25.443|0.3" "casino/chip-lay-2.ogg|25.896|0.3" "casino/chip-lay-3.ogg|26.314|0.3"
"casino/chips-stack-1.ogg|26.767|0.3" "casino/card-place-1.ogg|28.079|0.35" "ui/mouseclick1.ogg|28.94|0.35" "interface/switch_002.ogg|29.797|0.5"
"interface/switch_004.ogg|31.562|0.4" "casino/card-slide-8.ogg|32.862|0.3" "casino/chip-lay-1.ogg|35.474|0.35" "casino/chip-lay-2.ogg|35.904|0.35"
"casino/chip-lay-3.ogg|36.333|0.35" "interface/drop_002.ogg|36.774|0.4" "impact/impactPlate_light_000.ogg|37.645|0.3" "impact/impactSoft_medium_000.ogg|40.15|0.45"
"casino/card-fan-1.ogg|40.257|0.45" "ui/mouseclick1.ogg|44.17|0.5" "interface/drop_001.ogg|44.6|0.4" "impact/impactPlate_light_000.ogg|47.212|0.35"
"casino/chip-lay-2.ogg|48.942|0.35" "casino/chip-lay-3.ogg|49.383|0.35" "casino/card-fan-2.ogg|50.683|0.45" "ui/mouseclick1.ogg|53.702|0.5"
"casino/card-place-2.ogg|54.166|0.3" "casino/card-place-3.ogg|54.596|0.3" "casino/card-place-4.ogg|55.025|0.3" "casino/card-place-1.ogg|55.466|0.3"
"casino/card-place-2.ogg|55.908|0.3" "casino/card-slide-5.ogg|58.52|0.25" "impact/impactSoft_medium_001.ogg|59.379|0.3" "impact/impactSoft_medium_002.ogg|59.82|0.3"
"impact/impactSoft_medium_003.ogg|60.261|0.3" "impact/impactBell_heavy_000.ogg|60.691|0.5"
)
IN="-i music.wav"; F=""; L="[0:a]volume=0.82[m];"; n=1; MIX="[m]"
for s in "${SFX[@]}"; do IFS='|' read f t g <<< "$s"; IN="$IN -i $S/$f"; ms=$(python3 -c "print(int(round($t*1000)))"); L="$L[$n:a]aresample=44100,adelay=$ms|$ms,volume=$g[s$n];"; MIX="$MIX[s$n]"; n=$((n+1)); done
ffmpeg -v error -y $IN -filter_complex "$L${MIX}amix=inputs=$n:normalize=0:duration=first,alimiter=limit=0.95,afade=t=out:st=63.81:d=0.6" -ar 44100 -ac 2 mix.wav
