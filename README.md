# solid

A small solid-modelling playground that runs entirely in your browser: type a short program on the left, see the solid on the right, in the manner of OpenSCAD. It reports volume, surface area, bounding box and whether the result is a valid manifold, and downloads the result as binary STL.

**Try it: https://tsmarsh.github.io/solid/**

The geometry (primitives, transforms, and union, difference and intersection on triangle meshes with exact predicates) is a library written in [fibber](https://github.com/tailoredshapes/fibber), a Lisp with memory safety and no garbage collector. fibber compiles the library to WebAssembly (`solid.wasm`), and the page runs it in a Web Worker: there is no server. Where a browser cannot run the module the page falls back to the same program compiled to JavaScript (`solid.mjs`, fibber's JavaScript backend); the status line says which ran, "(wasm)" or "(JavaScript)". The viewer is raw WebGL with no framework and no build step.

This repository is the built page only (`solid.wasm` and `solid.mjs` are generated code). The library's source is not published yet.

## What to expect
- A program is a small s-expression language: a whitelist of operations, `def`, `let` and `repeat`, no input or output. Errors point to a line and column. The page has thirteen examples, including three that fail on purpose.
- It is an experimenting tool, not an engineering one. Inputs must be closed manifolds; the operations return an error rather than a wrong mesh when they can tell. A few unusual scenes (a first operand that crosses itself at every perturbation the library tries) still come back as an error.
- The WebAssembly build is within about 1.4 times of a native binary (the bolt example: 0.66 s in headless Chromium, 0.53 s as a native binary, on the author's machine) and runs on one thread. The JavaScript fallback is 14 to 23 times slower than wasm (bolt: about 9 s) because fibber's JavaScript backend emulates a 64-bit machine; examples marked "(slow)" in the list, if any, are slow on the fallback. A render over 45 s is stopped.
- Only Chromium has been tested (headless, with software WebGL). Firefox, Safari, phones and real touch input have not, and neither has the fallback on a browser that really lacks WebAssembly features.

BSD 3-Clause licence; see `LICENSE`.
