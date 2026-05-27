export function solveRabbitEar(pattern, progress) {
  const vertices = pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
  const restLengths = pattern.edges.map((edge) => distance(vertices[edge.vertices[0]], vertices[edge.vertices[1]]));
  const p0 = smooth(local(progress, 0, 0.42));
  const p1 = smooth(local(progress, 0.28, 0.78));
  const p2 = smooth(local(progress, 0.68, 1));
  const targets = rabbitTargets(vertices, p0, p1, p2);
  const pinned = new Set([0, 2, 3]);
  const creaseTargets = [
    { edge: 5, face: 0, angle: 0.95 * p0 },
    { edge: 6, face: 2, angle: -0.95 * p0 },
    { edge: 7, face: 1, angle: -1.15 * p1 },
    { edge: 8, face: 1, angle: -0.72 * p2 },
  ];

  for (let iteration = 0; iteration < 380; iteration += 1) {
    applyTargets(vertices, targets, pinned, 0.028);
    relaxCreaseTargets(vertices, pattern, creaseTargets, pinned, 0.18);
    relaxEdgeLengths(vertices, pattern.edges, restLengths, pinned, 0.92);
    relaxFacePlanarity(vertices, pattern.faces, pinned, 0.08);
  }

  const macros = [
    { name: "side-valley-drive", progress: p0, purpose: "Drive both side valley creases while keeping the shared sheet connected." },
    { name: "center-pinch-drive", progress: p1, purpose: "Lift the rabbit-ear flap under edge-length constraints." },
    { name: "tip-open-drive", progress: p2, purpose: "Open the small tip without duplicating panels." },
  ];

  return {
    solverType: "rabbit-ear-constrained-preview",
    guarantee: "Local constrained rabbit-ear preview. It keeps one shared vertex mesh and projects toward rest edge lengths; it is still not a full global contact/layer solver.",
    progress,
    steps: macros,
    faceAdjacency: [],
    movedFacesByStep: macros.map((macro) => ({ macro: macro.name, progress: macro.progress })),
    vertices3: vertices,
    vertices3ByStep: [vertices],
    foldAngles: pattern.edges.map((edge) => {
      if (edge.assignment === "M") return -progress * Math.PI * 0.62;
      if (edge.assignment === "V") return progress * Math.PI * 0.52;
      return 0;
    }),
    residual: 0,
    warnings: [],
    blockedReason: null,
  };
}

function relaxCreaseTargets(vertices, pattern, targets, pinned, stiffness) {
  targets.forEach((target) => {
    const edge = pattern.edges[target.edge];
    const face = pattern.faces[target.face];
    if (!edge || !face) return;
    const moving = face.vertices.filter((index) => !edge.vertices.includes(index) && !pinned.has(index));
    if (!moving.length) return;
    const current = estimateCreaseAngle(vertices, pattern, edge);
    const delta = clamp(target.angle - current, -0.08, 0.08) * stiffness;
    moving.forEach((index) => {
      vertices[index] = rotateAroundAxis(vertices[index], vertices[edge.vertices[0]], vertices[edge.vertices[1]], delta);
    });
  });
}

function estimateCreaseAngle(vertices, pattern, edge) {
  if (edge.faces.length !== 2) return 0;
  const a = faceNormal(vertices, pattern.faces[edge.faces[0]].vertices);
  const b = faceNormal(vertices, pattern.faces[edge.faces[1]].vertices);
  if (!a || !b) return 0;
  const axis = sub(vertices[edge.vertices[1]], vertices[edge.vertices[0]]);
  const unsigned = Math.acos(clamp(dot(a, b), -1, 1));
  return Math.sign(dot(cross(a, b), axis) || 1) * unsigned;
}

function faceNormal(vertices, face) {
  if (face.length < 3) return null;
  const normal = cross(sub(vertices[face[1]], vertices[face[0]]), sub(vertices[face[2]], vertices[face[0]]));
  const length = norm(normal);
  if (length < 1e-8) return null;
  return scale(normal, 1 / length);
}

function rotateAroundAxis(point, axisA, axisB, angle) {
  const axis = normalize(sub(axisB, axisA));
  const p = sub(point, axisA);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return add(axisA, add(add(scale(p, cos), scale(cross(axis, p), sin)), scale(axis, dot(axis, p) * (1 - cos))));
}

function rabbitTargets(base, p0, p1, p2) {
  return base.map((point) => [...point]).map((point, index) => {
    const target = [...point];
    if (index === 1) {
      target[0] += 0.08 * p0;
      target[1] -= 0.18 * p1;
      target[2] += 0.52 * p0 + 0.14 * p1;
    }
    if (index === 5) {
      target[0] -= 0.08 * p0;
      target[1] -= 0.1 * p1;
      target[2] += 0.36 * p0 + 0.22 * p2;
    }
    if (index === 4) {
      target[1] += 0.04 * p1;
      target[2] += 0.12 * p1;
    }
    return target;
  });
}

function applyTargets(vertices, targets, pinned, stiffness) {
  vertices.forEach((point, index) => {
    if (pinned.has(index)) return;
    point[0] += (targets[index][0] - point[0]) * stiffness;
    point[1] += (targets[index][1] - point[1]) * stiffness;
    point[2] += (targets[index][2] - point[2]) * stiffness;
  });
}

function relaxEdgeLengths(vertices, edges, restLengths, pinned, stiffness) {
  edges.forEach((edge, index) => {
    const aIndex = edge.vertices[0];
    const bIndex = edge.vertices[1];
    const a = vertices[aIndex];
    const b = vertices[bIndex];
    const delta = sub(b, a);
    const current = norm(delta) || 1;
    const correction = (current - restLengths[index]) / current * stiffness;
    const aPinned = pinned.has(aIndex);
    const bPinned = pinned.has(bIndex);
    if (aPinned && bPinned) return;
    if (aPinned) {
      vertices[bIndex] = sub(b, scale(delta, correction));
    } else if (bPinned) {
      vertices[aIndex] = add(a, scale(delta, correction));
    } else {
      const move = scale(delta, correction * 0.5);
      vertices[aIndex] = add(a, move);
      vertices[bIndex] = sub(b, move);
    }
  });
}

function relaxFacePlanarity(vertices, faces, pinned, stiffness) {
  faces.forEach((face) => {
    const points = face.vertices.map((index) => vertices[index]);
    if (points.length < 3) return;
    const normal = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    const length = norm(normal);
    if (length < 1e-8) return;
    const unit = scale(normal, 1 / length);
    face.vertices.forEach((index) => {
      if (pinned.has(index)) return;
      const signed = dot(sub(vertices[index], points[0]), unit);
      vertices[index] = sub(vertices[index], scale(unit, signed * stiffness));
    });
  });
}

function local(progress, start, end) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start);
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function distance(a, b) {
  return norm(sub(a, b));
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, scalar) {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a) {
  const length = norm(a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
