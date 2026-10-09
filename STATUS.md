# Live fleet status (2026-10-08)

Calls below are the latest row per pack in `data/v2/status_calls.csv`. The wording is the analyst's text. Lamp colour on the site is mapped from that text.

| Pack | UID | Status | Call |
| --- | --- | --- | --- |
| D-1 | CNHL-2026-001 | D pool / no parallel | 2026-10-08 |
| C1-P2 | CNHL-2026-002 | GO | 2026-09-27 |
| C1-P3 | CNHL-2026-003 | CAUTION | 2026-09-27 |
| C1-P4 | CNHL-2026-004 | CAUTION onboard | 2026-09-27 |
| C1-P5 | CNHL-2026-005 | Watch | 2026-10-08 |
| C1-P6 | CNHL-2026-006 | GO | 2026-09-27 |
| C2-P1 | CNHL-2026-007 | GO | 2026-09-30 |
| C2-P2 | CNHL-2026-008 | CAUTION floor EYE | 2026-09-30 |
| C2-P3 | CNHL-2026-009 | GO | 2026-09-30 |
| C2-P4 | CNHL-2026-010 | GO | 2026-09-30 |
| C2-P5 | CNHL-2026-011 | GO | 2026-09-30 |
| C2-P6 | CNHL-2026-012 | GO | 2026-09-30 |

C1-P1 is empty. CNHL-2026-001 moved to D-1 on 2026-10-08 and is charged individually. C1-P5 is charged individually (Rule B N/A). Next parallel, from `data/v2/next.json` as of 2026-10-08: C1 is C1-P2, C1-P3, C1-P4, C1-P6. C2 is the full six.

## Gaps
- C1 last measured 2026-09-27; C2 last measured 2026-09-30 — label dates on UI
- Partial nights stay incomplete in the store and are never filled in. On every line chart, a not-charged night between two readings in the same service span is a faint dotted join with no invented value. A not-charged night before the first reading or after the last is a hollow ring on the bottom edge, with no value. Series mean IR and Rule B rest-Δ use the same marks when that series has no value. Nights before commission and nights after a move are not marked. A star on the night label (partial night) is a different mark. Legend: dotted = not charged · ○ = not charged (start/end).
- No capacity in/out series — DX8 Storage logs are IR/voltage only
- DX8 absolute IR (~400–600 charger units per cell) does NOT map to Oscar/CNHL absolute retire bins — relative rules only. The integers are not labeled as milliohms. The scale is not confirmed.
- Soft FP advisory can FAIL without remapping
- No C3/C4; second brand not owned yet (bake-off cards use BUY-summary prices only)
- Dual-DX8 HOLD until replacement DX8-2 is seen
