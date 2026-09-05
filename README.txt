Handball Scoreboard 3.0 - v0.8.2

Shot Analysis changes:
- Each player has personal shot numbering: 1, 2, 3...
- All Players view uses match shot order.
- Shot origin dot is light.
- Goal = green target dot in goal.
- Save = red target dot in goal.
- Post = orange target dot in goal.
- Miss = light/grey target dot in goal area.
- Block = purple dot only at shot origin; no target dot is created.
- 7 m skips the origin step and goes directly to the goal.
- Tooltips include player number, personal shot number, match shot number and result.
- Existing handball background, responsive layout, ad slot, line-up and help system retained.

v0.8.3:
- Quick Stats now has Start/Pause clock control.
- Clock button stays synchronized with the main scoreboard clock.
- Quick Stats clock is explicitly centered on tablet and mobile.
- Mobile layout no longer pushes the clock toward the right edge.

v0.8.4:
- Quick Stats clock itself is now the Start/Pause trigger.
- Play icon overlays the clock before start; pause icon overlays it while running.
- Keyboard Enter/Space also toggles the clock when focused.
- Back buttons now return to the actual previous screen using screen history.
- Quick Stats event buttons are smaller.
- Score digits are significantly larger on desktop and mobile.

v0.8.5:
- Quick Stats play/pause overlay no longer permanently covers the clock.
- Initial Play icon is visible before first start; after interaction icons only flash briefly.
- Quick Stats team scores stay side-by-side on mobile.
- Score digits enlarged further.
- Shot Analysis now supports zoom in/out/reset.
- Mouse wheel zoom supported on desktop.
- Drag/pan supported while zoomed.

v0.8.6:
- Tap the selected shot-origin dot again before saving to clear/reselect the shot position.
- After clearing, next court tap chooses the corrected origin.
- Added Edit last shot for the selected player.
- Editing preserves the shot's player number and both personal/match sequence numbers.

v0.8.7:
- Fixed click coordinate mapping while Shot Analysis is zoomed/panned.
- Clicks are converted back into the original untransformed image coordinate system.
- Tapping the selected goal point again clears it.
- After clearing the goal point, the next click inside the goal sets the corrected target.
- Origin correction behavior remains available.

v0.9:
- 2nd half / next phase only appears after current period reaches 00:00.
- Manual time correction.
- Match timeline with score snapshots.
- Player court time tracking.
- Match Report screen with score progression, goal/turnover timeline, player minutes and event list.
- Share via native Web Share (WhatsApp etc. where supported), fallback copy.
- JSON report export.

v0.10:
- New Match Control Hub with score/time at top and both team rosters underneath.
- Green/red on-court switches.
- Player count validation against 7 active players minus active 2-minute penalties.
- Per-player 2-minute penalty control and countdown.
- Player quick stat (goals/shots), minutes on court and last five actions.
- Last-five action colors: goal green, save red, block purple, post orange, miss light, turnover grey.
- Complete Statistics rebuilt with player names, numbers, playing time, goals, shots, efficiency, saves against, blocks, posts, misses, turnovers, last five actions, current lineups, substitutions and full match timeline.

v0.11:
- Match Control Hub simplified for opponent team.
- AWAY no longer tracks lineup/substitutions in Hub.
- HOME keeps on-court switches.
- Both HOME and AWAY player rows now have Goal / Miss / Block / Post quick actions.
- Each player row has an ◎ button to open detailed Shot Analysis for that exact player.
- Shot Analysis opened from Hub returns automatically to Hub after the shot is confirmed.
- Hub warnings now validate HOME active player count only.

v0.12:
- Added global Undo one-step control.
- HOME and AWAY player names in Match Control Hub open Shot Analysis directly for that player.
- After confirming a shot launched from Hub, app returns automatically to Hub.
- Added Turnover / Error flow in Shot Analysis.
- Select player -> Turnover / Error -> tap court position -> classify FAULT or BM.
- Error locations are stored and displayed on the court map.
- Player turnover count and last-five actions update after FAULT/BM.
