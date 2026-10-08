# Live fleet status (Lipo Lary, relayed 2026-10-08)

- C1 call date: **2026-09-27**
- C2 call date: **2026-09-30**

| Pack | Status | Reason | Call date |
| --- | --- | --- | --- |
| C1-P1 | **OFF** | Chronic Cell6 self-discharge (floor 3509 mV, imb 191 mV ≥~150 SD) | 2026-09-27 |
| C1-P2 | **OK** | spr 26; floor OK | 2026-09-27 |
| C1-P3 | **Caution** | spr 40 + floor 3578 EYE (<3600); imb 122 not SD — still ON next board | 2026-09-27 |
| C1-P4 | **Caution** | Chronic Cell1 pack-max IR 561; spr 45 Caution; floor OK (not SD); reduced C1 amps; not scrap | 2026-09-27 |
| C1-P5 | **OFF** | floor 3539 EYE + lowest rest; spr 33 Go / imb 71 not SD — not scrap; off keeps board rest-Δ GO (prefer off tonight) | 2026-09-27 |
| C1-P6 | **OK** | spr 16 | 2026-09-27 |
| C2-P1 | **OK** | spr 17 | 2026-09-30 |
| C2-P2 | **Caution** | floor 3597 EYE; imb 103 not SD; spr 26 Go — still ON | 2026-09-30 |
| C2-P3 | **OK** | spr 26 | 2026-09-30 |
| C2-P4 | **OK** | spr 17 | 2026-09-30 |
| C2-P5 | **OK** | spr 19 | 2026-09-30 |
| C2-P6 | **OK** | spr 18; lowest C2 pack avg | 2026-09-30 |

## Next parallel
- C1: ON C1-P2, C1-P3, C1-P4, C1-P6; OFF C1-P1, C1-P5; rest Δ 0.13 V GO; reduced amps (as of 2026-09-27)
- C2: ON C2-P1, C2-P2, C2-P3, C2-P4, C2-P5, C2-P6; rest Δ 0.154 V GO (as of 2026-09-30)

## Gaps
- C1 last measured 2026-09-27; C2 last measured 2026-09-30 — label dates on UI
- Partial nights: never interpolate missing fleet
- No capacity in/out series — DX8 Storage logs are IR/voltage only
- DX8 absolute IR (~400–600 mΩ/cell) does NOT map to Oscar/CNHL absolute retire bins — relative rules only
- Soft FP advisory can FAIL without remapping
- No C3/C4; second brand not owned yet (bake-off cards use BUY-summary prices only)
- Dual-DX8 HOLD until replacement DX8-B is seen
