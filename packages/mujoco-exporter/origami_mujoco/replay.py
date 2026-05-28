from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def replay_mjcf(model_path: Path, plan_path: Path, log_path: Path, duration: float = 2.0, fps: float = 60.0) -> None:
    try:
        import mujoco
    except ImportError as exc:
        raise RuntimeError("MuJoCo Python is not installed. Install it with `pip install mujoco` to use replay.") from exc

    plan = json.loads(plan_path.read_text())
    model = mujoco.MjModel.from_xml_path(str(model_path))
    data = mujoco.MjData(model)
    actuator_ids = actuator_name_to_id(mujoco, model, plan)
    joint_ids = joint_name_to_qpos_id(mujoco, model, plan)
    steps = [step for step in plan.get("steps", []) if step.get("actuator_name") in actuator_ids]
    dt = float(model.opt.timestep)
    stride = max(1, int(round((1 / fps) / dt)))
    total_steps = max(1, int(duration / dt))

    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w") as handle:
        for step_index in range(total_steps + 1):
            t = step_index * dt
            normalized = min(1.0, t / duration)
            controls = controls_at(steps, normalized)
            for name, value in controls.items():
                data.ctrl[actuator_ids[name]] = value
            mujoco.mj_step(model, data)
            if step_index % stride == 0 or step_index == total_steps:
                handle.write(json.dumps(sample_state(model, data, plan, controls, joint_ids)) + "\n")


def controls_at(steps: list[dict[str, Any]], progress: float) -> dict[str, float]:
    controls: dict[str, float] = {}
    for step in steps:
        start = float(step.get("start", 0))
        end = float(step.get("end", 1))
        if progress <= start:
            local = 0.0
        elif progress >= end:
            local = 1.0
        else:
            local = (progress - start) / max(1e-9, end - start)
        controls[step["actuator_name"]] = float(step.get("target", 0)) * local
    return controls


def sample_state(model: Any, data: Any, plan: dict[str, Any], controls: dict[str, float], joint_ids: dict[str, int]) -> dict[str, Any]:
    joint_angles = {}
    target_error = {}
    for crease in plan.get("tree_creases", []):
        joint = crease["joint_name"]
        actuator = crease["actuator_name"]
        qpos_id = joint_ids.get(joint)
        if qpos_id is None:
            continue
        angle = float(data.qpos[qpos_id])
        target = float(controls.get(actuator, 0.0))
        joint_angles[joint] = angle
        target_error[joint] = target - angle
    contacts = []
    for index in range(data.ncon):
        contact = data.contact[index]
        contacts.append({
            "geom1": int(contact.geom1),
            "geom2": int(contact.geom2),
            "dist": float(contact.dist),
        })
    return {
        "time": float(data.time),
        "ctrl": {name: float(value) for name, value in controls.items()},
        "joint_angles": joint_angles,
        "target_error": target_error,
        "contacts": contacts,
        "contact_count": len(contacts),
    }


def actuator_name_to_id(mujoco: Any, model: Any, plan: dict[str, Any]) -> dict[str, int]:
    ids = {}
    for crease in plan.get("tree_creases", []):
        name = crease["actuator_name"]
        actuator_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR, name)
        if actuator_id >= 0:
            ids[name] = int(actuator_id)
    return ids


def joint_name_to_qpos_id(mujoco: Any, model: Any, plan: dict[str, Any]) -> dict[str, int]:
    ids = {}
    for crease in plan.get("tree_creases", []):
        name = crease["joint_name"]
        joint_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
        if joint_id >= 0:
            ids[name] = int(model.jnt_qposadr[joint_id])
    return ids
