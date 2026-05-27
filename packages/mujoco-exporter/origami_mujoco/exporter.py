from __future__ import annotations

import math
import xml.etree.ElementTree as ET
from collections import deque
from dataclasses import dataclass
from typing import Any, Optional


THICKNESS = 0.003


@dataclass
class Edge:
    index: int
    vertices: tuple[int, int]
    assignment: str
    faces: list[int]


def export_fold_to_mjcf(raw: dict[str, Any], model_name: str = "origami") -> tuple[str, dict[str, Any]]:
    vertices = [tuple(map(float, coord[:2])) for coord in raw["vertices_coords"]]
    faces = [list(map(int, face)) for face in raw["faces_vertices"]]
    edges = build_edges(raw, faces)
    tree = build_face_tree(edges, len(faces))

    root = ET.Element("mujoco", {"model": model_name})
    ET.SubElement(root, "compiler", {"angle": "radian", "coordinate": "local"})
    ET.SubElement(root, "option", {"timestep": "0.002", "gravity": "0 0 -9.81"})
    ET.SubElement(root, "default")
    asset = ET.SubElement(root, "asset")
    worldbody = ET.SubElement(root, "worldbody")
    ET.SubElement(worldbody, "light", {"pos": "0 0 2", "dir": "0 0 -1"})
    actuator = ET.SubElement(root, "actuator")

    origins = compute_body_origins(vertices, faces, edges, tree)
    for face_index, face in enumerate(faces):
      add_face_mesh(asset, vertices, face, origins[face_index], face_index)

    body_nodes: dict[int, ET.Element] = {}
    root_face = 0
    body_nodes[root_face] = add_panel_body(worldbody, root_face, origins[root_face], vertices, faces[root_face])
    for face_index in traversal_order(tree, root_face):
        if face_index == root_face:
            continue
        parent, edge_index = tree[face_index]
        parent_body = body_nodes[parent]
        origin = origins[face_index]
        parent_origin = origins[parent]
        edge = edges[edge_index]
        axis = edge_axis(vertices, edge)
        joint_name = f"crease_e{edge.index}_f{face_index}"
        body = add_panel_body(parent_body, face_index, (origin[0] - parent_origin[0], origin[1] - parent_origin[1]), vertices, faces[face_index], joint={
            "name": joint_name,
            "type": "hinge",
            "axis": f"{axis[0]:.6f} {axis[1]:.6f} 0",
            "limited": "true",
            "range": "-3.1416 3.1416",
            "damping": "0.05",
        })
        ET.SubElement(actuator, "position", {"name": f"act_{joint_name}", "joint": joint_name, "kp": "8"})
        body_nodes[face_index] = body

    plan = build_plan(raw, edges, tree)
    indent(root)
    return ET.tostring(root, encoding="unicode"), plan


def build_edges(raw: dict[str, Any], faces: list[list[int]]) -> list[Edge]:
    assignments = raw.get("edges_assignment", [])
    edges = [
        Edge(index=i, vertices=(int(pair[0]), int(pair[1])), assignment=assignments[i] if i < len(assignments) else "U", faces=[])
        for i, pair in enumerate(raw["edges_vertices"])
    ]
    by_key = {edge_key(*edge.vertices): edge for edge in edges}
    for face_index, face in enumerate(faces):
        for i, a in enumerate(face):
            b = face[(i + 1) % len(face)]
            edge = by_key.get(edge_key(a, b))
            if edge:
                edge.faces.append(face_index)
    return edges


def build_face_tree(edges: list[Edge], face_count: int) -> dict[int, tuple[int, int]]:
    adjacency = [[] for _ in range(face_count)]
    for edge in edges:
        if len(edge.faces) == 2:
            a, b = edge.faces
            adjacency[a].append((b, edge.index))
            adjacency[b].append((a, edge.index))
    tree: dict[int, tuple[int, int]] = {}
    seen = {0}
    queue = deque([0])
    while queue:
        face = queue.popleft()
        for nxt, edge_index in adjacency[face]:
            if nxt in seen:
                continue
            seen.add(nxt)
            tree[nxt] = (face, edge_index)
            queue.append(nxt)
    return tree


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


def add_panel_body(parent: ET.Element, face_index: int, pos_xy: tuple[float, float], vertices: list[tuple[float, float]], face: list[int], joint: Optional[dict[str, str]] = None) -> ET.Element:
    body = ET.SubElement(parent, "body", {"name": f"panel_{face_index}", "pos": f"{pos_xy[0]:.6f} {pos_xy[1]:.6f} 0"})
    if joint:
        ET.SubElement(body, "joint", joint)
    ET.SubElement(body, "geom", {
        "name": f"panel_geom_{face_index}",
        "type": "mesh",
        "mesh": f"panel_mesh_{face_index}",
        "rgba": "0.95 0.97 1.0 1",
        "contype": "1",
        "conaffinity": "1",
        "margin": str(THICKNESS),
    })
    return body


def build_plan(raw: dict[str, Any], edges: list[Edge], tree: dict[int, tuple[int, int]]) -> dict[str, Any]:
    steps = raw.get("fold_steps") or []
    if not steps:
        steps = [
            {
                "edge": edge.index,
                "angleDegrees": 180 if edge.assignment in ("M", "V") else 0,
                "mode": "mountain" if edge.assignment == "M" else "valley",
                "start": 0,
                "end": 1,
            }
            for edge in edges
            if edge.assignment in ("M", "V")
        ]
    return {
        "title": raw.get("file_title", "Untitled FOLD"),
        "backend": "rigid-panels-spanning-tree",
        "note": "Prototype plan. Closed-loop crease constraints are not enforced yet.",
        "tree_edges": [{"face": face, "parent": parent, "edge": edge} for face, (parent, edge) in tree.items()],
        "steps": steps,
    }


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
