# solid

A small solid-modelling playground that runs entirely in your browser: type a short program on the left, see the solid on the right, in the manner of OpenSCAD. It reports volume, surface area, bounding box and whether the result is a valid manifold, and downloads the result as binary STL.

**Try it: https://tsmarsh.github.io/solid/**

The geometry (primitives, transforms, and union, difference and intersection on triangle meshes with exact predicates) is a library written in [fibber](https://github.com/tailoredshapes/fibber), a Lisp with memory safety and no garbage collector. fibber's JavaScript backend compiles the library, and the page runs it in a Web Worker: there is no server. The viewer is raw WebGL with no framework and no build step.

This repository is the built page only (`solid.mjs` is generated code). The library's source is not published yet.

## What to expect
- A program is a small s-expression language: a whitelist of operations, `def`, `let` and `repeat`, no input or output. Errors point to a line and column. The page has thirteen examples, including one slow one and three that fail on purpose.
- It is an experimenting tool, not an engineering one. Inputs must be closed manifolds; the operations return an error rather than a wrong mesh when they can tell. A few unusual scenes (a first operand that crosses itself at every perturbation the library tries) still come back as an error.
- The compiled JavaScript is much slower than the native library (the bolt example: about 10 s in the browser build against about 0.5 s as a native binary, on the author's machine, because fibber's JavaScript backend emulates a 64-bit machine; a faster backend is possible and not built yet) and runs on one thread. Examples marked "(slow)" take seconds on a laptop and longer on a phone.
- Only Chromium has been tested (with software WebGL). Firefox, Safari, phones and real touch input have not.

BSD 3-Clause licence; see `LICENSE`.
