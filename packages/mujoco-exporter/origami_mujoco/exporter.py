from __future__ import annotations

import json
import math
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


PAPER_THICKNESS = 0.003
DEFAULT_KP = 8.0


@dataclass(frozen=True)
class Edge:
    index: int
    vertices: tuple[int, int]
    assignment: str
    faces: tuple[int, ...]


@dataclass(frozen=True)
class TreeCrease:
    face: int
    parent: int
    edge: int
    joint_name: str
    actuator_name: str
    assignment: str


@dataclass(frozen=True)
class LoopClosure:
    edge: int
    faces: tuple[int, int]
    assignment: str
    reason: str


@dataclass
class CreasePattern:
    title: str
    vertices: list[tuple[float, float]]
    faces: list[list[int]]
    edges: list[Edge]
    raw_steps: list[dict[str, Any]]

    @classmethod
    def from_fold(cls, raw: dict[str, Any]) -> "CreasePattern":
        vertices = [tuple(map(float, coord[:2])) for coord in raw["vertices_coords"]]
        faces = [list(map(int, face)) for face in raw["faces_vertices"]]
        edges = build_edges(raw, faces)
        return cls(
            title=raw.get("file_title", "Untitled FOLD"),
            vertices=vertices,
            faces=faces,
            edges=edges,
            raw_steps=list(raw.get("fold_steps") or []),
        )


@dataclass
class PanelGraph:
    cp: CreasePattern
    tree: dict[int, tuple[int, int]]
    loop_closures: list[LoopClosure]
    origins: list[tuple[float, float]]

    @classmethod
    def from_cp(cls, cp: CreasePattern) -> "PanelGraph":
        tree, tree_edge_ids = build_face_tree(cp.edges, len(cp.faces))
        loop_closures = [
            LoopClosure(edge=edge.index, faces=(edge.faces[0], edge.faces[1]), assignment=edge.assignment, reason="non-tree crease; equality constraint not generated yet")
            for edge in cp.edges
            if len(edge.faces) == 2 and edge.index not in tree_edge_ids
        ]
        origins = compute_body_origins(cp.vertices, cp.faces, cp.edges, tree)
        return cls(cp=cp, tree=tree, loop_closures=loop_closures, origins=origins)


@dataclass
class FoldPlan:
    title: str
    steps: list[dict[str, Any]]
    tree_creases: list[TreeCrease]
    loop_closures: list[LoopClosure]

    @classmethod
    def from_cp(cls, cp: CreasePattern, graph: PanelGraph) -> "FoldPlan":
        tree_creases = []
        for face, (parent, edge_index) in graph.tree.items():
            edge = cp.edges[edge_index]
            joint_name = f"crease_e{edge.index}_f{face}"
            tree_creases.append(TreeCrease(
                face=face,
                parent=parent,
                edge=edge.index,
                joint_name=joint_name,
                actuator_name=f"act_{joint_name}",
                assignment=edge.assignment,
            ))
        raw_steps = cp.raw_steps or [
            {
                "edge": edge.index,
                "angleDegrees": 180,
                "mode": "mountain" if edge.assignment == "M" else "valley",
                "start": 0,
                "end": 1,
            }
            for edge in cp.edges
            if edge.assignment in ("M", "V")
        ]
        return cls(title=cp.title, steps=normalize_steps(raw_steps, tree_creases), tree_creases=tree_creases, loop_closures=graph.loop_closures)

    def to_json(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "backend": "rigid-panels-spanning-tree",
            "requires_loop_closure": bool(self.loop_closures),
            "note": "Tree creases are actuated. Non-tree creases are reported as loop closures; equality constraints are not generated yet.",
            "tree_creases": [crease.__dict__ for crease in self.tree_creases],
            "loop_closures": [
                {"edge": item.edge, "faces": list(item.faces), "assignment": item.assignment, "reason": item.reason}
                for item in self.loop_closures
            ],
            "steps": self.steps,
        }


class MjcfExporter:
    def __init__(self, cp: CreasePattern, graph: PanelGraph, plan: FoldPlan, model_name: str = "origami"):
        self.cp = cp
        self.graph = graph
        self.plan = plan
        self.model_name = model_name

    def to_xml(self) -> str:
        root = ET.Element("mujoco", {"model": self.model_name})
        ET.SubElement(root, "compiler", {"angle": "radian", "coordinate": "local"})
        ET.SubElement(root, "option", {"timestep": "0.002", "gravity": "0 0 -9.81"})
        default = ET.SubElement(root, "default")
        ET.SubElement(default, "geom", {"friction": "0.8 0.02 0.001", "solref": "0.01 1", "solimp": "0.9 0.95 0.001"})
        asset = ET.SubElement(root, "asset")
        ET.SubElement(asset, "material", {"name": "paper_front", "rgba": "0.95 0.97 1.0 1"})
        ET.SubElement(asset, "material", {"name": "paper_back", "rgba": "0.55 0.90 0.70 1"})
        worldbody = ET.SubElement(root, "worldbody")
        ET.SubElement(worldbody, "light", {"pos": "0 0 2", "dir": "0 0 -1"})
        actuator = ET.SubElement(root, "actuator")

        for face_index, face in enumerate(self.cp.faces):
            add_face_mesh(asset, self.cp.vertices, face, self.graph.origins[face_index], face_index)

        body_nodes: dict[int, ET.Element] = {}
        body_nodes[0] = add_panel_body(worldbody, 0, self.graph.origins[0], material="paper_front")
        for face_index in traversal_order(self.graph.tree, 0):
            if face_index == 0:
                continue
            parent, edge_index = self.graph.tree[face_index]
            edge = self.cp.edges[edge_index]
            crease = self.plan_crease_for_face(face_index)
            axis = edge_axis(self.cp.vertices, edge)
            origin = self.graph.origins[face_index]
            parent_origin = self.graph.origins[parent]
            joint = {
                "name": crease.joint_name,
                "type": "hinge",
                "axis": f"{axis[0]:.6f} {axis[1]:.6f} 0",
                "limited": "true",
                "range": "-3.1416 3.1416",
                "damping": "0.05",
            }
            body_nodes[face_index] = add_panel_body(
                body_nodes[parent],
                face_index,
                (origin[0] - parent_origin[0], origin[1] - parent_origin[1]),
                material="paper_front" if face_index % 2 == 0 else "paper_back",
                joint=joint,
            )
            ET.SubElement(actuator, "position", {
                "name": crease.actuator_name,
                "joint": crease.joint_name,
                "kp": f"{DEFAULT_KP:g}",
                "ctrlrange": "-3.1416 3.1416",
            })

        indent(root)
        return ET.tostring(root, encoding="unicode")

    def plan_crease_for_face(self, face: int) -> TreeCrease:
        for crease in self.plan.tree_creases:
            if crease.face == face:
                return crease
        raise KeyError(f"missing tree crease for face {face}")


def export_fold_to_mjcf(raw: dict[str, Any], model_name: str = "origami") -> tuple[str, dict[str, Any]]:
    cp = CreasePattern.from_fold(raw)
    graph = PanelGraph.from_cp(cp)
    plan = FoldPlan.from_cp(cp, graph)
    return MjcfExporter(cp, graph, plan, model_name=model_name).to_xml(), plan.to_json()


def export_fold_file(input_path: Path, out_path: Path, plan_path: Path) -> None:
    raw = json.loads(input_path.read_text())
    mjcf, plan = export_fold_to_mjcf(raw, model_name=input_path.stem)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(mjcf)
    plan_path.write_text(json.dumps(plan, indent=2))


def build_edges(raw: dict[str, Any], faces: list[list[int]]) -> list[Edge]:
    assignments = raw.get("edges_assignment", [])
    mutable = [
        {"index": i, "vertices": (int(pair[0]), int(pair[1])), "assignment": assignments[i] if i < len(assignments) else "U", "faces": []}
        for i, pair in enumerate(raw["edges_vertices"])
    ]
    by_key = {edge_key(*edge["vertices"]): edge for edge in mutable}
    for face_index, face in enumerate(faces):
        for i, a in enumerate(face):
            b = face[(i + 1) % len(face)]
            edge = by_key.get(edge_key(a, b))
            if edge:
                edge["faces"].append(face_index)
    return [
        Edge(index=edge["index"], vertices=edge["vertices"], assignment=edge["assignment"], faces=tuple(edge["faces"]))
        for edge in mutable
    ]


def build_face_tree(edges: list[Edge], face_count: int) -> tuple[dict[int, tuple[int, int]], set[int]]:
    adjacency = [[] for _ in range(face_count)]
    for edge in edges:
        if len(edge.faces) == 2:
            a, b = edge.faces
            adjacency[a].append((b, edge.index))
            adjacency[b].append((a, edge.index))
    tree: dict[int, tuple[int, int]] = {}
    tree_edges: set[int] = set()
    seen = {0}
    queue = deque([0])
    while queue:
        face = queue.popleft()
        for nxt, edge_index in adjacency[face]:
            if nxt in seen:
                continue
            seen.add(nxt)
            tree[nxt] = (face, edge_index)
            tree_edges.add(edge_index)
            queue.append(nxt)
    return tree, tree_edges


def normalize_steps(raw_steps: list[dict[str, Any]], tree_creases: list[TreeCrease]) -> list[dict[str, Any]]:
    by_edge = {crease.edge: crease for crease in tree_creases}
    steps = []
    for raw in raw_steps:
        edge = int(raw.get("edge"))
        crease = by_edge.get(edge)
        mode = raw.get("mode") or ("mountain" if raw.get("assignment") == "M" else "valley")
        sign = -1 if mode == "mountain" else 1
        angle_degrees = float(raw.get("angleDegrees", raw.get("angle_degrees", 0)))
        target = sign * math.radians(abs(angle_degrees))
        steps.append({
            "edge": edge,
            "mode": mode,
            "angle_degrees": sign * abs(angle_degrees),
            "target": target,
            "start": float(raw.get("start", 0)),
            "end": float(raw.get("end", 1)),
            "stiffness": float(raw.get("stiffness", DEFAULT_KP)),
            "joint_name": crease.joint_name if crease else None,
            "actuator_name": crease.actuator_name if crease else None,
            "status": "tree-actuated" if crease else "requires-loop-closure-or-unsupported",
        })
    return steps


def traversal_order(tree: dict[int, tuple[int, int]], root: int) -> list[int]:
    children: dict[int, list[int]] = {}
    for child, (parent, _) in tree.items():
        children.setdefault(parent, []).append(child)
    order = []
    queue = deque([root])
    while queue:
        face = queue.popleft()
        order.append(face)
        queue.extend(children.get(face, []))
    return order


def compute_body_origins(vertices: list[tuple[float, float]], faces: list[list[int]], edges: list[Edge], tree: dict[int, tuple[int, int]]) -> list[tuple[float, float]]:
    origins = [centroid(vertices, face) for face in faces]
    for face_index, (_, edge_index) in tree.items():
        a, b = edges[edge_index].vertices
        origins[face_index] = midpoint(vertices[a], vertices[b])
    return origins


def add_face_mesh(asset: ET.Element, vertices: list[tuple[float, float]], face: list[int], origin: tuple[float, float], face_index: int) -> None:
    local = [(vertices[i][0] - origin[0], vertices[i][1] - origin[1], 0.0) for i in face]
    verts = " ".join(f"{x:.6f} {y:.6f} {z:.6f}" for x, y, z in local)
    tris = []
    for i in range(1, len(face) - 1):
        tris.extend([0, i, i + 1])
    ET.SubElement(asset, "mesh", {"name": f"panel_mesh_{face_index}", "vertex": verts, "face": " ".join(map(str, tris))})


def add_panel_body(parent: ET.Element, face_index: int, pos_xy: tuple[float, float], material: str, joint: Optional[dict[str, str]] = None) -> ET.Element:
    body = ET.SubElement(parent, "body", {"name": f"panel_{face_index}", "pos": f"{pos_xy[0]:.6f} {pos_xy[1]:.6f} 0"})
    if joint:
        ET.SubElement(body, "joint", joint)
    ET.SubElement(body, "geom", {
        "name": f"panel_geom_{face_index}",
        "type": "mesh",
        "mesh": f"panel_mesh_{face_index}",
        "material": material,
        "contype": "1",
        "conaffinity": "1",
        "margin": f"{PAPER_THICKNESS:g}",
    })
    return body


def edge_key(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def centroid(vertices: list[tuple[float, float]], face: list[int]) -> tuple[float, float]:
    return (sum(vertices[i][0] for i in face) / len(face), sum(vertices[i][1] for i in face) / len(face))


def midpoint(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def edge_axis(vertices: list[tuple[float, float]], edge: Edge) -> tuple[float, float]:
    a, b = edge.vertices
    dx = vertices[b][0] - vertices[a][0]
    dy = vertices[b][1] - vertices[a][1]
    length = math.hypot(dx, dy) or 1
    return (dx / length, dy / length)


def indent(elem: ET.Element, level: int = 0) -> None:
    pad = "\n" + level * "  "
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = pad + "  "
        for child in elem:
            indent(child, level + 1)
        if not elem.tail or not elem.tail.strip():
            elem.tail = pad
    elif level and (not elem.tail or not elem.tail.strip()):
        elem.tail = pad
