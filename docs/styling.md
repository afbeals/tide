# Styling and accessibility

Tide uses IBM Plex Sans, CSS variables and shared components inspired by Desk / Ink & amber. Main dark tokens: canvas `#171a20`, panel `#20242d`, sidebar `#111419`, text `#f1f1ea`, border `#343a46`, amber `#e8ba72`.

Global foundations and responsive shell live in `src/app/globals.css`; calendar integration lives in `calendar.css`. Light/Dark/System and Comfortable/Compact are independent settings. Reduced motion follows the system or an explicit preference.

1280+: 200px sidebar and 352px docked inspector. 1024–1279: 72px rail and docked inspector. 768–1023: rail and overlay inspector. Mobile: full-screen details/editors and simplified navigation. Keep fields/actions, independent scrolling, visible Close, focus containment/restoration, and 44px mobile controls.

Use semantic labels, visible focus, non-color status cues, keyboard operation and alternatives to dragging. Consult the complete Figma register for exact component/state references rather than copying prototype screenshots as assets.
