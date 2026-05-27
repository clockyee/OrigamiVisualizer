# References and Innovation Summary

Date: 2026-05-26

## Borrowed Ideas and References

This project intentionally builds on existing computational origami work.

### FOLD Format

Reference: https://github.com/edemaine/fold

Borrowed idea:

- use a graph-like interchange format for vertices, edges, faces, and mountain/valley assignments;
- treat CP files as structured data rather than raw drawings;
- preserve assignments and folded states as machine-readable fields.

How we use it:

- make FOLD the preferred input/output format;
- use FOLD-like JSON internally even for hand-authored examples;
- export solver traces and prediction samples in a compatible graph form.

### Origami Simulator

Reference: https://origamisimulator.org/
Source: https://github.com/amandaghassaei/OrigamiSimulator

Borrowed idea:

- interactive CP-to-fold visualization;
- constraint-style folding where crease targets move continuously;
- Web-based user workflow with immediate visual feedback;
- import/export around FOLD/SVG/mesh assets.

How we use it:

- first Web prototype follows the same broad concept: CP view plus folded 3D view;
- folding is animated continuously from a progress parameter;
- later solver work should study its constraint formulation.

### Rabbit Ear

Reference: https://github.com/rabbit-ear/rabbit-ear

Borrowed idea:

- computational-origami graph utilities;
- flat-foldability checks;
- SVG/FOLD parsing and conversion;
- treating CP operations as graph algorithms.

How we use it:

- Rabbit Ear is a likely dependency for the production CP parser;
- current prototype mirrors the same data model: vertices, edges, faces, assignments.

### Tachi Tools: Freeform Origami, Rigid Origami Simulator, Origamizer

Reference: https://tsg.ne.jp/TT/software/

Borrowed idea:

- constraints for developability, flat-foldability, panel planarity, and point coincidence;
- rigid-foldability analysis;
- target-shape-to-CP generation through Origamizer-like workflows.

How we use it:

- informs later design/generation pipeline;
- helps separate CP solving from inverse design.

### Robert Lang Computational Origami

Reference: https://langorigami.com/article/computational-origami/

Borrowed idea:

- clear taxonomy of origami design tools:
  - TreeMaker;
  - box pleating;
  - ORIPA;
  - Freeform Origami;
  - Origamizer;
  - rigid origami/mechanism tools.

How we use it:

- positions this project as a CP-to-folding and batch-prediction system first, not a general origami design tool at the start.

## Our Own Innovation Points

### 1. CP-to-folding as a data-generation pipeline

Most interactive tools focus on single-user visualization. This project treats every CP simulation as a dataset sample.

Planned outputs:

- normalized CP graph;
- foldability checks;
- folded states over time;
- solver success/failure labels;
- warnings such as self-intersection, unstable vertices, or assignment ambiguity;
- final 3D geometry;
- prediction-ready JSON.

This enables batch learning tasks such as:

- foldability classification;
- missing mountain/valley assignment prediction;
- final fold-angle prediction;
- folded 3D state prediction;
- trajectory prediction.

### 2. Explicit separation of three layers

The project separates:

```text
CP parsing and validation
  -> folding solver and Web visualization
  -> MuJoCo physical validation / manipulation
```

This avoids forcing MuJoCo to solve CP geometry and avoids forcing a Web origami solver to handle robotics contact and manipulation.

### 3. Solver trace as first-class output

The planned system does not only display the final folded model. It records the path:

- progress;
- crease angles;
- vertex positions;
- local errors;
- warnings;
- failure states.

This trace is useful for debugging, evaluation, and ML training.

### 4. Web-first research interface

The initial UI is designed as a research workbench:

- CP view;
- folded 3D view;
- foldability checks;
- solver warnings;
- exportable summaries;
- batch-prediction framing.

The tool is intended to explain why a CP fails or succeeds, not only render a pretty folded shape.

### 5. MuJoCo as second-stage backend

The project can later export folded trajectories to MuJoCo for:

- physical contact validation;
- manipulation planning;
- robot folding policies;
- actuator and gripper experiments;
- sim-to-real style testing.

The innovation is not "origami inside MuJoCo first"; it is "origami geometry first, physics execution second."

### 6. Template-assisted image-to-origami path

The project does not assume a fully general image-to-origami solver exists.

Instead, the practical future path is:

```text
image -> segmentation/keypoints -> category/template choice
      -> CP family fitting -> foldability simulation
      -> optional MuJoCo physical validation
```

This is more realistic than direct arbitrary image-to-valid-CP generation.

## Current Prototype Scope

The first prototype is intentionally limited:

- static Web app;
- built-in single-crease and Miura-ori examples;
- 2D CP visualization;
- 3D folded visualization;
- fold progress animation;
- basic local foldability-style checks;
- exportable JSON summary.

This is not yet a mathematically complete origami solver. It is the first working interface for CP-to-folding research and dataset design.

