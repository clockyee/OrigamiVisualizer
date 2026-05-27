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
python -m origami_mujoco.cli examples/book.fold.json --out /tmp/book.xml --plan /tmp/book_plan.json
```

If MuJoCo Python is installed, the generated XML can be loaded for inspection:

```python
import mujoco
model = mujoco.MjModel.from_xml_path("/tmp/book.xml")
data = mujoco.MjData(model)
mujoco.mj_step(model, data)
```

## Current Limits

- Supports small rigid-panel examples such as single crease, book fold, and the two-step edge fold.
- Uses a face spanning tree; loop closure equality constraints are not generated yet.
- Fold schedules are exported as JSON and are not automatically replayed inside MuJoCo yet.
- Contact is enabled on panels, but robot manipulation and contact-rich fold execution come later.
