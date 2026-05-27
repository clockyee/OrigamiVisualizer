# CP to Folded Origami: Research and Implementation Route

Date: 2026-05-26

## Direction Change

The first milestone should not be MuJoCo rigid-panel simulation.

A better first milestone is:

```text
crease pattern -> parsed topology -> foldability checks -> folded-state solver
               -> web visualization of folding process
```

MuJoCo can come later as a physical execution backend. The core research problem is how to get from a CP image/file to a valid folded form and folding trajectory.

## What Others Usually Do

### 1. Parse the CP into a planar graph

Input may be:

- `.fold`;
- SVG crease pattern;
- DXF/PDF-derived vector lines;
- raster CP image, after vectorization.

The parser builds:

- vertices;
- edges;
- faces;
- edge assignments:
  - mountain;
  - valley;
  - boundary;
  - flat/unassigned;
  - cut or auxiliary.

Important detail: CP lines must form a clean planar graph. Intersections must be split into vertices. Nearly coincident endpoints must be merged. Faces must be discovered from the embedded graph.

Useful references:

- FOLD format: https://github.com/edemaine/fold
- Rabbit Ear: https://github.com/rabbit-ear/rabbit-ear
- Origami Simulator: https://github.com/amandaghassaei/OrigamiSimulator

### 2. Validate local foldability

Before solving, systems usually check local rules.

For flat folding around a single vertex:

- Kawasaki condition: alternating sector angles sum to 180 degrees.
- Maekawa condition: number of mountain and valley creases differs by 2.

These are necessary local tests, not complete global guarantees.

The system should flag:

- invalid vertex geometry;
- missing mountain/valley assignments;
- non-manifold graph regions;
- disconnected crease components;
- faces with self-intersection;
- impossible or ambiguous layer ordering.

### 3. Generate faces and triangulate panels

Origami solvers usually work with panels/faces, not just raw line art.

For simulation and rendering:

- each face becomes a polygon;
- large faces may be triangulated;
- crease edges connect adjacent faces;
- non-crease diagonals may be added for numerical stability.

Origami Simulator does this kind of conversion before running its constraint-based simulation.

### 4. Solve folded geometry

There are several solver families.

#### Constraint-based dynamic relaxation

This is the Origami Simulator style.

The solver treats the CP as a network of constraints:

- edge length preservation;
- face planarity;
- crease angular targets;
- damping;
- stiffness;
- optional face/vertex constraints.

It then numerically relaxes the structure as fold angles increase.

Pros:

- good for interactive Web visualization;
- intuitive;
- supports partial and continuous folding;
- can show the process, not just final state.

Cons:

- may converge to wrong local minima;
- self-intersections/layer ordering are hard;
- not a complete mathematical proof of foldability.

#### Rigid origami kinematics

This treats each face as rigid and solves hinge constraints.

Pros:

- closer to ideal mathematical origami;
- good for mechanisms and known rigid-foldable patterns.

Cons:

- not every CP is rigid-foldable;
- solving closed constraint loops is hard;
- folding path may bifurcate.

#### Flat-folded state / layer-order reasoning

Some tools focus on final flat folded state and layer stacking.

Pros:

- useful for checking whether the CP can become a flat model;
- important for real origami.

Cons:

- does not automatically give a collision-free folding path.

#### Design solvers

Tools like TreeMaker, BP Studio, and Origamizer solve the inverse problem:

```text
target shape/tree/mesh -> crease pattern
```

They are relevant later for generation, not the first CP-to-folding viewer.

## Recommended First Web Prototype

Build a Web simulator before MuJoCo.

### Minimal pipeline

```text
FOLD/SVG import
  -> planar graph cleanup
  -> face extraction
  -> local foldability checks
  -> triangulated render mesh
  -> constraint-based folding solver
  -> WebGL/Three.js visualization
```

### First supported examples

1. Single valley/mountain fold.
2. Square base / preliminary base.
3. Miura-ori.
4. Waterbomb base.
5. Crane base.

### Interaction design

The Web UI should show:

- 2D CP view;
- 3D folded view;
- mountain/valley colors;
- invalid vertices and warnings;
- fold progress slider;
- play/pause animation;
- per-crease target angles;
- export folded mesh / FOLD state.

## Implementation Options

### Option A: Use Rabbit Ear for CP geometry, write our own solver

This is a good route.

Use Rabbit Ear for:

- FOLD parsing;
- graph operations;
- flat-foldability checks;
- face/edge/vertex utilities;
- SVG/FOLD conversion.

Then implement:

- a simple constraint-based solver;
- Three.js rendering;
- dataset export.

This gives us control over data collection and prediction tasks.

### Option B: Fork/learn from Origami Simulator

This is the fastest way to understand a working CP-to-folding system.

Use it as reference for:

- solver constraints;
- fold angle scheduling;
- triangulation;
- GPU/interactive simulation architecture;
- import/export behavior.

But avoid copying the architecture blindly because it is an interactive app, not a clean library pipeline.

### Option C: Use an existing solver as backend

Possible, but less ideal if the long-term goal includes batch prediction.

Batch prediction needs deterministic, scriptable, inspectable intermediate data:

- parsed graph;
- face graph;
- foldability features;
- solver states over time;
- failure labels;
- final geometry;
- layer/collision diagnostics.

## Batch CP Prediction Possibility

Yes. Once CP-to-folding is running, batch CP prediction becomes realistic.

The key is to define the prediction target.

Possible tasks:

### Task 1: Foldability classification

Input:

- CP graph;
- mountain/valley assignments;
- sector angles;
- face graph features.

Output:

- locally foldable / not locally foldable;
- likely globally foldable / likely impossible;
- rigid-foldable / non-rigid or uncertain.

This is the easiest ML task.

### Task 2: Folded state prediction

Input:

- CP graph with assignments.

Output:

- 3D vertex positions at final folded state;
- per-crease final fold angles;
- layer ordering approximation.

This is harder but valuable.

### Task 3: Folding trajectory prediction

Input:

- CP graph;
- target final state or assignments.

Output:

- sequence of fold angle schedules;
- macro operations;
- collision-free path estimate.

This is much harder because many CPs have multiple possible paths.

### Task 4: Missing assignment prediction

Input:

- CP geometry without complete mountain/valley labels.

Output:

- mountain/valley assignment proposal;
- confidence per crease;
- foldability score.

This is useful for scanned CPs and image-derived CPs.

## Data Generation Strategy

A CP-to-folding simulator can generate supervised data.

For each CP:

- normalize graph;
- run local foldability checks;
- run solver with multiple fold schedules;
- record success/failure;
- save intermediate folded states;
- save final geometry;
- save warnings:
  - self-intersection;
  - high strain;
  - unstable crease;
  - ambiguous layer order.

Dataset sample:

```json
{
  "id": "miura_0001",
  "vertices": [[0, 0], [1, 0], [1, 1]],
  "edges": [[0, 1], [1, 2]],
  "assignments": ["B", "V"],
  "faces": [[0, 1, 2]],
  "fold_angles": [0.0, 1.2],
  "final_vertices_3d": [[0, 0, 0], [1, 0, 0], [1, 1, 0.4]],
  "success": true,
  "warnings": []
}
```

## Recommended Next Milestone

Build `packages/web-viewer` first.

Milestone scope:

- load a small built-in FOLD pattern;
- show 2D CP;
- show 3D mesh;
- animate fold progress using simple crease target angles;
- support one single-crease example and one Miura-ori example.

After that, add:

- SVG/FOLD import;
- local foldability checks;
- solver logging;
- batch runner.

## Relationship to MuJoCo

MuJoCo should become the second-stage backend:

```text
CP solver / Web folding result
  -> folded state / trajectory
  -> MuJoCo physical validation
  -> robot manipulation / contact-rich execution
```

This means MuJoCo is used where it is strongest:

- physical contact;
- robot folding;
- actuator policies;
- robustness and manipulation;
- sim-to-real style experiments.

The CP-to-folding system remains the source of geometric truth.

## Current State: Web Viewer v2

The `packages/web-viewer` prototype has moved from static Canvas projection to a Vite + Three.js app.

Implemented:

- FOLD JSON subset parsing:
  - `vertices_coords`;
  - `edges_vertices`;
  - `edges_assignment`;
  - `faces_vertices`.
- grouped CP checks:
  - parse checks;
  - planar graph checks;
  - origami checks.
- real 3D viewport with rotate, pan, zoom, resize, and reset.
- known-pattern solvers:
  - `single-hinge`;
  - `analytic-miura`.
- `preview-relaxation` placeholder for generic CPs.
- dataset-style solver trace export.

Current v3 direction:

- CP editing is separated into an Editor mode.
- Edited crease graphs run through basic planar face extraction.
- Generic folding preview is now face-rigid:
  - each fold moves one side of the face graph around the crease axis;
  - M/V signs determine rotation direction;
  - sequential fold steps support examples such as folding once and then folding the already folded state again.
- Unsupported or conflicting cases should warn or block instead of showing a misleading folded result.

Important boundary:

Arbitrary CP-to-correct-3D-origami is not treated as solved. This prototype explicitly separates:

- CP parsed correctly;
- local flat-foldability checked;
- global folded-state existence;
- collision-free folding path existence;
- current 3D result generated by a named solver.

The next serious research step is to replace preview relaxation with a constraint-based solver while preserving these diagnostics.

## Why Waterbomb Needs a Different Solver

Waterbomb, Miura-ori, and many real origami bases cannot be solved by rotating one face component around each crease independently. At a multi-crease vertex, every incident panel must meet at the same 3D vertex while preserving edge lengths and panel geometry. Independent crease rotations overconstrain the shared vertex and create conflicts.

A better next solver should model the CP as a constraint system:

- vertex positions are 3D variables;
- edge lengths are preserved;
- each face stays planar or near-rigid;
- crease assignments provide target dihedral angles;
- all panels incident to a CP vertex share the same 3D point;
- damping/step scheduling gradually moves target fold angles.

This is closer to Origami Simulator's constraint-relaxation approach. The "ball joint" intuition is useful for thinking about a shared vertex: many panels can rotate around that point, but they must still satisfy crease-edge hinges, fixed edge lengths, and face planarity. A spherical joint alone is not enough; it needs the surrounding bar/hinge/planarity constraints.

Recommended implementation path:

1. keep the current face-rigid solver for simple one/two-step demonstrations;
2. add a constraint-relaxation backend for waterbomb-style vertices;
3. compare residual errors and block results when constraints do not converge;
4. later add collision/layer-order checks.

Current prototype status:

- `constraint-relaxation-preview` exists as an experimental backend.
- It is used by the Waterbomb and crane-base draft examples.
- It approximately preserves edge lengths and smooths face planarity while applying M/V-driven out-of-plane targets around the high-degree interior vertex.
- It reports a residual and should still be treated as a preview, not a proof of valid folded state.

## Raster CP Import

The first raster-image import is deliberately experimental. It:

- loads a CP image into a canvas;
- thresholds dark pixels;
- projects likely horizontal, vertical, and diagonal lines;
- creates a FOLD-like graph draft;
- marks detected creases with alternating M/V assignments.

This is not a reliable CP recognizer yet. The generated graph must be reviewed in Editor mode, and intersections must be split before the result is trusted.

Step-by-step instruction diagrams are a different problem from CP import. A workflow like the frog diagram needs:

1. split the page into numbered panels;
2. detect paper outline in each panel;
3. detect dashed/solid crease lines and arrows;
4. infer the operation type for each panel, such as valley fold, squash fold, rabbit-ear fold, reverse fold, or unfold;
5. convert the sequence into fold macros;
6. run the simulator step by step and compare the generated state to the next panel.

This should be built as a separate `diagram-to-steps` pipeline, not as a single CP image importer.

## Local Fold Macro Target

The paper crane macro preview was replaced by a smaller, more local `rabbitEar` fold because the crane CP/path was misleading. The rabbit-ear fold is a better near-term target:

- two valley creases bring sides inward;
- a central mountain pinch lifts the flap;
- a final opening step positions the flap.

Once local macros like rabbit-ear, petal fold, and inside reverse fold are reliable, they can be composed into a crane sequence.
