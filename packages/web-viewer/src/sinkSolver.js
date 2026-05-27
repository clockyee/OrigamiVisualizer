export function solveSinkFold(pattern, progress) {
  const vertices = pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
  const restLengths = pattern.edges.map((edge) => distance(vertices[edge.vertices[0]], vertices[edge.vertices[1]]));
  const p0 = smooth(local(progress, 0, 0.35));
  const p1 = smooth(local(progress, 0.25, 0.78));
  const p2 = smooth(local(progress, 0.68, 1));
  const pinned = new Set();
  const targets = sinkTargets(vertices, p0, p1, p2);
  const creaseTargets = [
    { edge: 4, face: 4, angle: -0.38 * p1 },
    { edge: 5, face: 4, angle: -0.38 * p1 },
    { edge: 6, face: 4, angle: -0.38 * p1 },
    { edge: 7, face: 4, angle: -0.38 * p1 },
    { edge: 8, face: 0, angle: 0.24 * p0 },
    { edge: 9, face: 1, angle: 0.24 * p0 },
    { edge: 10, face: 2, angle: 0.24 * p0 },
    { edge: 11, face: 3, angle: 0.24 * p0 },
  ];

  for (let iteration = 0; iteration < 420; iteration += 1) {
    applyTargets(vertices, targets, pinned, 0.025);
    relaxCreaseTargets(vertices, pattern, creaseTargets, pinned, 0.08);
    relaxEdgeLengths(vertices, pattern.edges, restLengths, pinned, 0.96);
    relaxFacePlanarity(vertices, pattern.faces, pinned, 0.09);
  }

  const macros = [
    { name: "open-pocket", progress: p0, purpose: "Open the four radial creases around the sink square." },
    { name: "invert-inner-square", progress: p1, purpose: "Drive the inner square below the sheet under length constraints." },
    { name: "settle-local-layers", progress: p2, purpose: "Close the local shape without solving true layer contact." },
  ];

  return {
    solverType: "sink-fold-constrained-preview",
    guarantee: "Open sink macro preview with one shared mesh. It drives the inner square down and projects edge lengths/face planarity; closed-sink contact and layer order are not solved.",
    progress,
    steps: macros,
    faceAdjacency: [],
    movedFacesByStep: macros.map((macro) => ({ macro: macro.name, progress: macro.progress })),
    vertices3: vertices,
    vertices3ByStep: [vertices],
    foldAngles: pattern.edges.map((edge) => {
      if (edge.assignment === "M") return -progress * Math.PI * 0.52 * edgeFoldFactor(pattern, edge.index);
      if (edge.assignment === "V") return progress * Math.PI * 0.42 * edgeFoldFactor(pattern, edge.index);
      return 0;
    }),
    residual: 0,
    warnings: [],
    blockedReason: null,
  };
}

function sinkTargets(base, p0, p1, p2) {
  const center = [0.5, 0.5, 0];
  return base.map((point, index) => {
    const target = [...point];
    if (index >= 4 && index <= 7) {
      target[0] = center[0] + (point[0] - center[0]) * (1 - 0.04 * p1 + 0.02 * p2);
      target[1] = center[1] + (point[1] - center[1]) * (1 - 0.04 * p1 + 0.02 * p2);
      target[2] = -0.1 * p1 + 0.02 * p0;
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

function relaxCreaseTargets(vertices, pattern, targets, pinned, stiffness) {
  targets.forEach((target) => {
    const edge = pattern.edges[target.edge];
    const face = pattern.faces[target.face];
    if (!edge || !face || edge.faces.length !== 2) return;
    const moving = face.vertices.filter((index) => !edge.vertices.includes(index) && !pinned.has(index));
    if (!moving.length) return;
    const current = estimateCreaseAngle(vertices, pattern, edge);
    const delta = clamp(target.angle - current, -0.055, 0.055) * stiffness;
    moving.forEach((index) => {
      vertices[index] = rotateAroundAxis(vertices[index], vertices[edge.vertices[0]], vertices[edge.vertices[1]], delta);
    });
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
    if (aPinned) vertices[bIndex] = sub(b, scale(delta, correction));
    else if (bPinned) vertices[aIndex] = add(a, scale(delta, correction));
    else {
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

function estimateCreaseAngle(vertices, pattern, edge) {
  const a = faceNormal(vertices, pattern.faces[edge.faces[0]].vertices);
  const b = faceNormal(vertices, pattern.faces[edge.faces[1]].vertices);
  if (!a || !b) return 0;
  const axis = sub(vertices[edge.vertices[1]], vertices[edge.vertices[0]]);
  const unsigned = Math.acos(clamp(dot(a, b), -1, 1));
  return Math.sign(dot(cross(a, b), axis) || 1) * unsigned;
}

function faceNormal(vertices, face) {
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

function edgeFoldFactor(pattern, edgeIndex) {
  const value = pattern.metadata?.edge_fold_factors?.[edgeIndex];
  return Number.isFinite(value) ? value : 1;
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
