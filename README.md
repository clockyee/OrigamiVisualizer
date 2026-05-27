# Origami Visualizer

CP-to-folding research prototype with a Vite/Three.js web viewer and an early MuJoCo rigid-panel exporter.

## Web Viewer

```bash
cd packages/web-viewer
npm install
npm run dev
```

Build:

```bash
npm run build
```

The viewer supports:

- FOLD-like crease pattern examples;
- CP checks for parse, planar graph, and local origami conditions;
- 3D WebGL preview with front/back paper colors;
- Rabbit ear constrained preview;
- open sink constrained preview;
- Miura rigid-panel preview with conflict warnings;
- raster CP image import draft;
- dataset JSON export with solver metrics.

## MuJoCo Exporter

```bash
cd packages/mujoco-exporter
python -m origami_mujoco.cli examples/book.fold.json --out /tmp/book.xml --plan /tmp/book_plan.json
```

The exporter is a first rigid-panel scaffold:

- each FOLD face becomes one rigid panel mesh;
- adjacent faces are connected through a spanning-tree hinge;
- fold schedules are exported to JSON;
- closed-loop constraints, contact-rich execution, and robot manipulation are later work.

## Research Notes

- [RESEARCH.md](RESEARCH.md)
- [CP-to-Folding Notes](docs/CP_TO_FOLDING.md)
- [References and Innovation](docs/REFERENCES_AND_INNOVATION.md)
