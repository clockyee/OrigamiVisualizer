# Origami CP Web Viewer

Vite + Three.js prototype for CP-to-folding visualization.

## Run

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Current Features

- built-in single-crease FOLD example;
- built-in Miura-ori rigid-panel preview with a rectangular CP display;
- intentionally broken FOLD example for check validation;
- extra examples: book fold, blintz base preview, waterbomb base preview, crane-base draft, rabbit-ear constrained preview, open sink constrained preview;
- experimental raster image CP import through the `Image CP` button;
- 2D crease pattern canvas;
- true Three.js/WebGL 3D folded-state viewport with rotate, pan, zoom, and reset;
- fold progress slider and playback;
- interactive CP/Graph and Inspector/Dataset tabs;
- parse, planar graph, and origami check groups with issue localization;
- basic CP editing:
  - select vertices and edges;
  - add vertices;
  - snap a new vertex onto a nearby edge;
  - split an edge with the `Point on Edge` tool;
  - drag selected vertices in Editor mode;
- connect two selected vertices with a chosen assignment;
- mark selected edges with `M/V/B/F/U` buttons or keyboard shortcuts;
- tune the selected crease with an individual fold factor while retaining the global fold progress slider;
- lock selected edges; boundary edges are treated as locked by default;
- delete selected edge or vertex using buttons or Delete/Backspace;
- basic planar face extraction after edits;
- solver diagnostics for edge strain, face area error, and non-adjacent face intersections;
- face-rigid folding preview based on crease edge adjacency;
- Miura-style rigid-panel preview that preserves edge lengths/areas and reports coupled-crease conflicts;
- sequential two-step folding preview example;
- constraint-relaxation preview for Waterbomb-style multi-crease vertices;
- crane-base draft example as the first stage toward a paper-crane sequence;
- rabbit-ear constrained preview with an explicit 4-5-2 face and one connected vertex mesh;
- open sink constrained macro preview with residual warnings;
- solver trace export for prediction datasets.

## Current Limits

- this is not a complete general origami solver;
- global layer ordering is not solved;
- contact response is not solved; non-adjacent face intersections are detected and highlighted as warnings;
- external FOLD import is not implemented yet;
- SVG/image CP import is not implemented yet;
- face extraction is basic and expects a clean planar graph;
- Miura uses a per-crease rigid-panel preview, not a full coupled Miura mechanism solver;
- Waterbomb uses an experimental constraint-relaxation preview because the simple face-rigid stepper cannot solve coupled vertex constraints;
- Crane base draft uses the same experimental constraint-relaxation backend and is not a full paper crane yet;
- Image CP import uses simple threshold/projection line detection; imported graphs must be reviewed in Editor mode before trusting them;
- Step-diagram image understanding is not implemented yet; it requires panel segmentation, arrow/symbol recognition, and fold-macro sequence reconstruction.
- simultaneous multi-crease previews warn when vertices are moved by multiple creases.

## Repairing the Broken Example

The `Broken FOLD check` example contains two intentional problems:

- `e6` references missing vertex `v99`.
- `e5` crosses the diagonal crease without a split vertex.

To repair it in the current UI:

1. Switch to `Editor`.
2. Open the `Graph` tab and click edge `6`, then delete it.
3. Click edge `5`, then delete it.
4. The remaining square-with-diagonal CP should pass blocking checks and can be folded by the face-rigid preview.

## Next Steps

1. Add external FOLD file import.
2. Add robust planar graph cleanup, automatic intersection splitting, and stronger face extraction for edited CPs.
3. Integrate Rabbit Ear for graph utilities and foldability checks.
4. Replace preview folding with constraint-based solver steps.
5. Improve image CP vectorization with intersection splitting, line merging, and assignment classification.
6. Add bird-base, petal-fold, and inside-reverse-fold macro steps after local fold macros are reliable.
