Implement [UI_OVERHAUL_GLASSMORPHISM].

Context: The UI currently has critical contrast issues (dark text on dark backgrounds). We need to enforce a strict "High-Contrast Dark Glass" theme.

Requirements:
1. [Global CSS] Enforce Text Contrast:
   - FORCE all primary body/header text to `color: #F8FAFC (Slate-50)` or `white`.
   - FORCE all secondary text/labels to `color: #94A3B8 (Slate-400)`.
   - *Constraint:* Search for any instances of `text-gray-900`, `text-black`, `text-slate-800` in dark mode containers and flip them to white.

2. [Aesthetic] Apply Glassmorphism (The "Modern" Look):
   - Update the `.card`, `.panel`, and `.sidebar` classes to use:
     - Background: `rgba(30, 41, 59, 0.7)` (Semi-transparent dark blue/slate)
     - Backdrop Filter: `backdrop-filter: blur(12px)` (The "Frosted" effect)
     - Border: `1px solid rgba(255, 255, 255, 0.1)` (Subtle white edge)
     - Shadow: `0 4px 6px -1px rgba(0, 0, 0, 0.5)`

3. [Component Audit] inputs & Tables:
   - Inputs: Must have `bg-transparent`, `border-b`, and `text-white`. Remove default white backgrounds.
   - Tables: Ensure row text is white. Header row should have a distinct glass background (`rgba(255,255,255,0.05)`).

4. [Verification] Safety Check:
   - Verify that NO component renders black text on a dark background.
   - Ensure the "Glass" effect doesn't break readability (background opacity must be > 0.6).

Success Criteria:
- All cards feature the `backdrop-filter` blur effect.
- Primary text is clearly legible (White/Off-White) against the glass backgrounds.
- No "Dark-on-Dark" contrast violations remain.

Output "COMPLETE" when visual styles are updated.
