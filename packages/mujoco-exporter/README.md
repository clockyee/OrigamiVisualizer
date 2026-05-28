# MuJoCo Exporter Prototype

Small Python prototype for converting simple FOLD JSON crease patterns into a MuJoCo MJCF rigid-panel scaffold.

This is not the native MuJoCo origami plugin yet. It builds an interpretable first backend:

- each FOLD face becomes one rigid mesh panel;
- adjacent faces are connected through a spanning-tree hinge joint;
- mountain/valley fold steps are exported into `fold_plan.json`;
- closed-loop constraints and layer/contact planning are intentionally deferred.

## Usage

```bash
cd packages/mujoco-exporter
python -m origami_mujoco.cli convert examples/book.fold.json --out /tmp/book.xml --plan /tmp/book_plan.json
```

If MuJoCo Python is installed, the generated XML can be loaded for inspection:

```python
import mujoco
model = mujoco.MjModel.from_xml_path("/tmp/book.xml")
data = mujoco.MjData(model)
mujoco.mj_step(model, data)
```

Replay a fold schedule and write JSONL logs:

```bash
python -m origami_mujoco.cli replay /tmp/book.xml /tmp/book_plan.json --log /tmp/book_run.jsonl
```

Each log row contains time, actuator controls, joint angles, target error, and contact pairs. If MuJoCo Python is not installed, replay exits with a clear `pip install mujoco` message; conversion still works without MuJoCo.

## Current Limits

- Supports small rigid-panel examples such as single crease, book fold, and the two-step edge fold.
- Includes `miura_small` and `waterbomb` loop-closure tests; these export debug `loop_closures` instead of pretending closed loops are solved.
- Uses a face spanning tree; loop closure equality constraints are not generated yet.
- Fold schedules are replayed by a Python controller; closed-loop equality constraints are still debug metadata only.
- Contact is enabled on panels, but robot manipulation and contact-rich fold execution come later.
