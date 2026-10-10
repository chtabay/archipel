# Le chemin: source package for reviewers

This archive rebuilds the submitted extension package, file for file. It is made by the repository's continuous
integration (`.github/workflows/extension.yml`), which also checks that it rebuilds the package identically.
Repository: https://github.com/chtabay/archipel (folder `chemin/`).

## What is minified

Only `chemin/vendor/three-chemin.min.js`: three.js 0.186.1 reduced to the modules the extension uses, with GLTFLoader
and the meshopt decoder that three.js ships (meshoptimizer 1.1, MIT, Arseny Kapoulkine), bundled and minified by
esbuild 0.28.2. Every other JavaScript file is the original, hand-written source, copied as is.

## Build

From the root of this archive, with Node 20 or later and npm (the continuous integration uses Ubuntu 24.04 and Node 22;
esbuild is a pinned binary, so the output bytes depend only on the pinned versions):

    cd chemin/outils/three && npm ci && cd ../../..   # installs three@0.186.1 and esbuild@0.28.2, pinned by package-lock.json
    node chemin/outils/fabriquer-three.mjs            # rewrites chemin/vendor/three-chemin.min.js, prints its size and sha256
    node chemin/extension/fabriquer.js                # assembles the extension in chemin/extension/dist

Expected: `chemin/vendor/three-chemin.min.js` is 648,259 bytes, with sha256
`4315d97fdeb75a7bdadf3cac76beffc15cd511a900832b6c5a2f13074c2463dd`, and `chemin/extension/dist` holds the same files as
the submitted package. `node chemin/outils/fabriquer-three.mjs --verifier` compares without writing, and exits with
code 1 on any difference. The three.js entry point and the esbuild options are written out in
`chemin/outils/fabriquer-three.mjs` and `chemin/vendor/LISEZMOI.txt`.

## Data, not code

- `chemin/objets/`: 3D models (glTF), CC0. Authors in `chemin/objets/LISEZMOI.txt`.
- `chemin/sens/`: word vectors derived from fastText (CC BY-SA 3.0), and word lists. See `chemin/sens/LISEZMOI.txt`.
- `fonts/nunito.woff2`: Nunito, SIL Open Font License (`fonts/OFL.txt`).
- `vendor/LICENSE-three.txt`: the three.js MIT license, also included in the package.

## No network

The extension makes no request outside itself. Its content security policy sets `connect-src 'self'`, and the only
`fetch` calls load files of the package: the word vectors, the catalogue, the 3D models. `'wasm-unsafe-eval'` is there
for the meshopt decoder embedded in three.js, which decompresses the packaged 3D models.
