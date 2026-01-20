Implement [LOGO_VISIBILITY_BOOST].

Context: The current logo is invisible on the dark landing page. It looks like a faint smudge.
We need to increase contrast, stroke width, and brightness significantly.

Requirements:

1. UPDATE 'src/components/LogoIcon.tsx':
   - **Thicken Lines:** Increase stroke-width to `2px` (or `3px` for the hero).
   - **Brighten Fills:** Change the back-face opacity from 0.3 to **0.6**.
   - **Add Internal Light:** Add a central radial gradient that starts at **Pure White (#FFFFFF)** and fades to Cyan. This simulates a light bulb inside the glass.
   - **Neon Stroke:** Change the stroke color to `#38bdf8` (Sky-400) and add `drop-shadow(0 0 10px rgba(56,189,248,0.8))` (Heavy Glow).

2. UPDATE 'src/components/LogoHero.tsx':
   - **Scale Up:** Ensure the icon wrapper is explicitly `w-32 h-32` (128px) so it dominates the hero section.
   - **Text Alignment:** Ensure "PLATOVUE" is vertically centered with the new larger icon.

3. VERIFICATION:
   - The logo must be clearly visible against a #0f172a (Dark Slate) background.
   - It should look like a "Neon Hologram," not a "Faint Sketch."

Output "LOGO_BRIGHTENED" when the component is updated.
