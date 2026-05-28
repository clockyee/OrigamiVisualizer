# Origami MuJoCo Simulator Research Notes

Date: 2026-05-26

## Goal

Build an origami simulator that can:

- import or author crease patterns (CP), ideally through the FOLD format;
- simulate mountain folds, valley folds, and fold sequences in MuJoCo;
- support higher-level techniques such as open sink, closed sink, and crane folding;
- eventually explore image/model-to-origami generation.

## Key Finding

Do not make MuJoCo responsible for solving all origami geometry from scratch.

The strongest architecture is a hybrid pipeline:

1. Use computational-origami tools/libraries to parse, validate, and solve CP geometry.
2. Convert the CP into a MuJoCo model with panels, creases, compliance, damping, and contact.
3. Drive crease target angles over time from a high-level folding plan.
4. Use MuJoCo for physical execution, contact, collision, manipulation, robot folding, and robustness testing.

This keeps the hard discrete origami-design problem separate from the continuous physics simulation problem.

Update: the first implementation milestone should focus on CP-to-folding, not MuJoCo. See [docs/CP_TO_FOLDING.md](docs/CP_TO_FOLDING.md). Once CP parsing, foldability checks, folded-state solving, and Web visualization work, MuJoCo should be introduced as a physical validation and manipulation backend.

Borrowed references and project-specific innovation points are summarized in [docs/REFERENCES_AND_INNOVATION.md](docs/REFERENCES_AND_INNOVATION.md).

Implementation update: `packages/web-viewer` is now planned as a Vite + Three.js CP-to-folding workbench. The important research boundary is that arbitrary CP-to-correct-3D folding is not considered solved; the app should distinguish parse validity, local foldability, global folded-state existence, collision-free path existence, and the current solver result.

Implementation update 2026-05-28: `packages/mujoco-exporter` now starts the MuJoCo route as a Python FOLD-to-MJCF prototype. It converts small rigid-panel examples into panel meshes, hinge joints over a face spanning tree, stable joint/actuator mappings, loop-closure debug metadata, and a separate fold schedule JSON. A first replay controller can drive actuator controls and log joint angles, target error, and contacts when MuJoCo Python is installed. Closed-loop equality constraints, richer contact replay, and robot manipulation are still next steps.

## Recommended Technical Route

### Phase 1: CP and FOLD Core

Use FOLD as the main interchange format. FOLD stores vertices, edges, faces, mountain/valley assignments, folded states, and optional metadata. It is supported by Origami Simulator, Freeform Origami, ORIPA, Rabbit Ear, and other tools.

Core implementation:

- parse `.fold` and SVG CP files;
- triangulate faces where necessary;
- normalize mountain/valley assignments;
- validate local flat-foldability where possible;
- build an internal graph:
  - vertices;
  - creases;
  - panels/faces;
  - crease type: mountain, valley, boundary, auxiliary;
  - target angle schedule.

Good libraries/tools to study:

- FOLD format and library: https://github.com/edemaine/fold
- Rabbit Ear computational origami JS library: https://github.com/rabbit-ear/rabbit-ear
- Origami Simulator source: https://github.com/amandaghassaei/OrigamiSimulator

### Phase 2: MuJoCo Representation

There are two viable MuJoCo representations.

#### Option A: Rigid panels connected by hinge joints

This is the best first prototype.

- Each CP face becomes a thin rigid mesh/geom.
- Each crease becomes a hinge joint or equality constraint between adjacent panels.
- Mountain/valley folds are implemented as signed target hinge angles.
- Actuators or joint springs drive folds toward target angles.
- Contacts prevent panels from passing through each other.

Pros:

- stable;
- interpretable;
- good for rigid origami;
- suitable for fold sequences and robot manipulation.

Cons:

- panel topology is awkward because MuJoCo is tree-structured, while origami crease graphs are general graphs;
- closed loops need equality constraints or a generated kinematic spanning tree plus loop closures;
- paper flexibility inside panels is limited unless panels are subdivided.

#### Option B: MuJoCo flex cloth/shell

MuJoCo 3.x has true deformable objects through `flex` and `flexcomp`. A 2D flex can model cloth-like deformable surfaces using triangle elements with stretch, contact, and passive forces.

Pros:

- closer to physical paper;
- can support bending, local strain, crumpling-like behavior, and contact naturally;
- useful after the rigid-panel prototype works.

Cons:

- crease-specific angular actuation is less direct;
- sharp fold lines need custom constraints, tendons, actuators, or generated local stiffness anisotropy;
- harder to guarantee exact origami kinematics.

Recommended approach:

- start with rigid panels for CP-driven folding;
- add flex-based paper as a second backend for physical realism.

MuJoCo references:

- Deformable objects: https://mujoco.readthedocs.io/en/stable/modeling.html#deformable-objects
- `flexcomp`: https://mujoco.readthedocs.io/en/stable/XMLreference.html#body-flexcomp

### Phase 3: Folding Primitives

Implement folding operations as high-level commands that generate target angle schedules and constraints.

Basic primitives:

- valley fold: target angle positive by convention;
- mountain fold: target angle negative by convention;
- unfold/flatten: target angle returns toward 0;
- reverse fold: coordinated mountain/valley reassignment over a local crease set;
- squash fold: local CP expansion plus coordinated collapse;
- open sink: open local pocket, invert selected creases, close pocket;
- closed sink: same logical inversion but with collision/contact constrained motion and less opening clearance.

Important design point:

Open sink and closed sink are not just one crease rotating. They are local topology/assignment operations plus a motion plan. Treat them as scripted fold macros over a crease subgraph.

### Phase 4: Crane Folding

For a paper crane, do not attempt image-to-folding directly.

Use a known crane CP / base sequence first:

1. square sheet;
2. preliminary base / bird base;
3. petal folds;
4. reverse folds for head and tail;
5. wing shaping.

Represent this as:

- a CP/FOLD asset;
- a sequence of fold macros;
- a set of target folded keyframes;
- MuJoCo replay and contact verification.

The crane is a good milestone because it exercises:

- many simultaneous creases;
- reverse folds;
- layered paper contact;
- self-collision;
- narrow flap manipulation.

## Existing Work Worth Borrowing From

### Origami Simulator

Origami Simulator folds every crease simultaneously from a CP. It uses distance constraints, face constraints, angular constraints, stiffness, damping, and numerical integration. It imports SVG/FOLD and exports FOLD, STL, and OBJ.

Use it as a reference for:

- CP parsing;
- fold angle targets;
- triangulation;
- stiffness/damping UI;
- folded OBJ/FOLD export.

Project: https://origamisimulator.org/
Source: https://github.com/amandaghassaei/OrigamiSimulator

### FOLD Format

FOLD should be the interchange layer. It already describes crease patterns, mountain/valley assignments, folded states, faces, edges, and stacking/order-related metadata.

Source: https://github.com/edemaine/fold

### Freeform Origami / Rigid Origami Simulator / Origamizer

Tomohiro Tachi's tools are important references:

- Freeform Origami: interactive design while preserving developability, flat-foldability, panel planarity, point coincidence, and paper size.
- Rigid Origami Simulator: rigid-foldability simulation and analysis.
- Origamizer: generates crease patterns that fold into a given polyhedral surface.

These are especially useful for model-to-CP workflows and for exporting a folded mesh that MuJoCo can replay or approximate.

Reference: https://tsg.ne.jp/TT/software/

### Robert Lang Computational Origami

Useful map of tools:

- TreeMaker for tree-like origami bases;
- BP Studio for box pleating;
- ORIPA for CP editing and folded-form rendering;
- Freeform Origami / Origamizer / Rigid Origami Simulator;
- MERLIN/MERLIN2 for truss-based origami mechanisms.

Reference: https://langorigami.com/article/computational-origami/

### Box Pleating Studio

Useful for complex representational designs and box-pleated bases. More relevant for later "generate a CP from a desired subject" than for the first MuJoCo simulator.

Reference: https://bp-studio.github.io/

## Image-to-Origami Options

There is no clean general solution for "image in, correct foldable origami out".

Practical routes:

1. Image to silhouette or target mesh, then Origamizer-style mesh-to-CP.
2. Image to semantic object, then choose a known origami design family/template.
3. Image to box-pleating tree abstraction, then use TreeMaker/BP Studio-like layout.
4. Image to decorative CP/tessellation, if physical representational accuracy is not required.

Recommended later pipeline:

```text
image -> segment subject -> estimate simple 3D proxy or skeleton/tree -> choose design method
      -> generate CP using template / box pleating / Origamizer-like algorithm
      -> validate in origami solver
      -> convert to MuJoCo for folding/contact simulation
```

For a first product, make "image-to-origami" template-assisted:

- user uploads an image;
- system extracts silhouette/keypoints;
- user chooses category: bird, animal, flower, mask, box, tessellation;
- system fits an existing CP family and parameterizes it.

## Proposed Project Structure

```text
origami-mujoco-sim/
  RESEARCH.md
  assets/
    cp/
    fold/
    meshes/
  packages/
    cp-core/
    mujoco-exporter/
    web-viewer/
  experiments/
    001-single-crease/
    002-miura-ori/
    003-waterbomb-base/
    004-crane-base/
```

## First Prototype Milestones

1. Single crease: two rigid panels, one hinge, mountain/valley target angle.
2. Multi-crease flat CP: import a tiny FOLD pattern and generate MuJoCo MJCF.
3. Miura-ori: verify repeated crease graph and simultaneous folding.
4. Waterbomb/preliminary base: test collision and layered folding.
5. Crane base: implement high-level fold sequence.
6. Full crane: add reverse folds and shaping controls.

## Recommendation

Start with a rigid-panel MuJoCo backend and a FOLD-based CP parser. Use Origami Simulator and Rabbit Ear for frontend/CP logic, not as the physics engine. Treat MuJoCo as the execution environment where folds are actuated, contacts are enforced, and manipulation policies can eventually interact with the paper.

The first useful deliverable should be:

- web CP/FOLD viewer;
- MuJoCo MJCF exporter;
- one-click run for single crease, Miura-ori, waterbomb base;
- basic peak/valley fold controls;
- saved folding trajectories.

## MuJoCo Origami Plugin Direction

It is worth designing this as a MuJoCo origami extension, but the implementation should be split into two layers.

### Layer 1: Origami authoring/export package

This should be the first deliverable.

Responsibilities:

- import `.fold`, SVG CP, and simple JSON crease graphs;
- validate and normalize crease assignments;
- generate triangulated panels and crease topology;
- produce MJCF models using rigid panels, hinge joints, equality constraints, actuators, and contacts;
- generate fold schedules for mountain/valley folds and named macros;
- export debug assets: OBJ/STL folded state, crease graph JSON, simulation logs.

Likely interface:

```bash
origami-mjcf convert crane.fold --out crane.xml
origami-mjcf convert miura.fold --backend rigid-panels --out miura.xml
origami-mjcf plan crane.fold --sequence crane-base.yaml --out crane_plan.json
```

Python API:

```python
from origami_mujoco import CreasePattern, MjcfExporter, FoldPlan

cp = CreasePattern.from_fold("assets/fold/miura.fold")
plan = FoldPlan.from_assignment(cp).fold_all(t=2.0, scale=0.9)
MjcfExporter(cp, plan).write("experiments/002-miura-ori/miura.xml")
```

This layer can be pure Python first. It does not require modifying MuJoCo internals.

### Layer 2: MuJoCo native plugin

MuJoCo supports engine plugins for custom dynamics, sensors, and actuators. A native origami plugin could add crease-aware behavior that is difficult to express cleanly in static MJCF.

Good plugin candidates:

- custom crease actuator:
  - stores target fold angle;
  - applies torque along a crease;
  - supports mountain/valley sign conventions;
  - supports time schedules and angle limits.
- custom crease sensor:
  - reports current dihedral angle;
  - reports fold error vs target;
  - reports local strain/contact state.
- crease stiffness/passive force plugin:
  - applies bending stiffness and damping along crease lines;
  - supports different stiffness for crease and panel regions;
  - can model scored paper, wet folding, or pre-creased paper.
- flex backend helper:
  - applies anisotropic stiffness near crease edges;
  - adds crease line bending targets on top of a MuJoCo flex mesh.

Less suitable for a native plugin:

- CP parsing;
- flat-foldability validation;
- high-level operations like open sink/closed sink;
- image-to-origami generation.

Those should stay outside MuJoCo as authoring and planning tools.

### Proposed Plugin Product Shape

Name:

```text
mujoco-origami
```

Package structure:

```text
packages/
  cp-core/                 # FOLD/SVG parsing, topology, validation
  mujoco-exporter/         # MJCF generation
  mujoco-origami-plugin/   # native MuJoCo plugin, later C/C++
  web-viewer/              # CP and folding-plan visualization
```

MJCF usage sketch:

```xml
<extension>
  <plugin plugin="mujoco.origami.crease"/>
</extension>

<actuator>
  <plugin name="fold_c1" plugin="mujoco.origami.crease">
    <config key="joint" value="crease_12"/>
    <config key="assignment" value="valley"/>
    <config key="target" value="1.5708"/>
    <config key="stiffness" value="0.02"/>
    <config key="damping" value="0.001"/>
  </plugin>
</actuator>
```

For the first version, approximate this behavior with standard MuJoCo position/velocity actuators. Move to a native plugin only when standard actuators become limiting.

### Development Plan for Plugin Route

1. Build `origami-mjcf` CLI that converts one CP into a runnable MuJoCo XML.
2. Add built-in examples:
   - single crease;
   - Miura-ori;
   - waterbomb base;
   - preliminary/bird base;
   - crane base.
3. Add a Python runtime controller:
   - reads fold schedules;
   - updates actuator controls;
   - logs dihedral angles and contact events.
4. Add Web viewer:
   - display CP;
   - inspect crease assignments;
   - scrub fold schedule;
   - preview generated panel graph.
5. Only then implement a native MuJoCo plugin:
   - first as a crease actuator/sensor;
   - later as flex crease stiffness support.

This route makes the project useful early while preserving a path toward a real MuJoCo extension.
