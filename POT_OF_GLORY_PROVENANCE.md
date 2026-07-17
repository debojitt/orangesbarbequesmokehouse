# Pot of Glory provenance

Pot of Glory is an original React, Canvas, and Matter.js implementation for
Orange's Barbeque Smokehouse.

The public Unity repository at
https://github.com/rossning92/getting-0ver-it was reviewed on 2026-07-17 only
to understand broad interaction concepts used by physics-climbing games. The
repository did not declare a software or asset license.

No source code, assets, audio, scene geometry, collider vertices, character
art, level layout, or numeric tuning values were imported from that
repository. Pot of Glory uses original code, procedural Canvas artwork, an
original smokehouse setting, and independently designed terrain.

Mountain surfaces are rendered procedurally at the device canvas resolution.
Their facets, strata, cracks, highlights, and silhouettes are original and
are drawn from the same polygon vertices used by Matter.js collision bodies.

The clean-room implementation uses general gameplay concepts including:

- pointer-directed tool movement;
- fixed-reach, contact-based leverage;
- a damped body-follow camera;
- static terrain with increasingly precise climbing grips; and
- fixed-step physics with mobile stability limits.
