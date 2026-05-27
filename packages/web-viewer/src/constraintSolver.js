export function solveConstraintRelaxation(pattern, progress) {
  const vertices = pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
  const restLengths = pattern.edges.map((edge) => distance(vertices[edge.vertices[0]], vertices[edge.vertices[1]]));
  const active = pattern.edges.filter((edge) => edge.assignment === "M" || edge.assignment === "V");
  const centerIndex = findHighestDegreeInteriorVertex(pattern);
  const targetScale = Math.sin(progress * Math.PI * 0.5) * pattern.targetDegrees / 180;
  const targetZ = vertices.map(() => 0);
  const warnings = [];

  active.forEach((edge) => {
    const [a, b] = edge.vertices;
    const sign = edge.assignment === "M" ? -1 : 1;
    const factor = edgeFoldFactor(pattern, edge.index);
    const outward = edge.vertices.includes(centerIndex) ? otherVertex(edge, centerIndex) : b;
    if (outward !== null) targetZ[outward] += sign * targetScale * 0.34 * factor;
    if (centerIndex !== null) targetZ[centerIndex] += targetScale * 0.08;
  });

  for (let iteration = 0; iteration < 80; iteration += 1) {
    applyFoldTargets(vertices, targetZ, 0.2);
    relaxCreaseAngles(vertices, pattern, targetScale, 0.035);
    relaxEdgeLengths(vertices, pattern.edges, restLengths, 0.42);
    relaxFacePlanarity(vertices, pattern.faces, 0.025);
  }

  const residual = computeEdgeResidual(vertices, pattern.edges, restLengths);
  if (residual > 0.03) warnings.push(`Constraint residual ${residual.toFixed(4)}: preview may be inaccurate.`);

  return {
    solverType: "constraint-relaxation-preview",
    guarantee: "Iterative constraint preview for multi-crease vertices. It preserves edge lengths approximately and does not solve layer order or collision.",
    progress,
    steps: active.map((edge) => ({ edge: edge.index, angleDegrees: assignmentSign(edge.assignment) * pattern.targetDegrees, mode: edge.assignment === "M" ? "mountain" : "valley", start: 0, end: 1 })),
    faceAdjacency: [],
    movedFacesByStep: [],
    vertices3: vertices,
    vertices3ByStep: [vertices],
    foldAngles: pattern.edges.map((edge) => active.includes(edge) ? assignmentSign(edge.assignment) * pattern.targetDegrees * progress * edgeFoldFactor(pattern, edge.index) * Math.PI / 180 : 0),
    residual,
    warnings,
    blockedReason: null,
  };
}

function relaxCreaseAngles(vertices, pattern, targetScale, stiffness) {
  const active = pattern.edges.filter((edge) => (edge.assignment === "M" || edge.assignment === "V") && edge.faces.length === 2);
  active.forEach((edge) => {
    const [faceA, faceB] = edge.faces;
    const normalA = faceNormal(vertices, pattern.faces[faceA]?.vertices || []);
    const normalB = faceNormal(vertices, pattern.faces[faceB]?.vertices || []);
    if (!normalA || !normalB) return;
    const current = signedAngleBetweenNormals(normalA, normalB, sub(vertices[edge.vertices[1]], vertices[edge.vertices[0]]));
    const target = assignmentSign(edge.assignment) * Math.PI * 0.85 * targetScale * edgeFoldFactor(pattern, edge.index);
    const delta = clamp(target - current, -0.08, 0.08) * stiffness;
    const moving = new Set(pattern.faces[faceB].vertices);
    edge.vertices.forEach((vertex) => moving.delete(vertex));
    moving.forEach((vertex) => {
      vertices[vertex] = rotateAroundAxis(vertices[vertex], vertices[edge.vertices[0]], vertices[edge.vertices[1]], delta);
    });
  });
}

function faceNormal(vertices, face) {
  if (face.length < 3) return null;
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  const n = cross(sub(b, a), sub(c, a));
  const length = norm(n);
  if (length < 1e-8) return null;
  return scale(n, 1 / length);
}

function signedAngleBetweenNormals(a, b, axis) {
  const unsigned = Math.acos(clamp(dot(a, b), -1, 1));
  return Math.sign(dot(cross(a, b), axis) || 1) * unsigned;
}

function rotateAroundAxis(point, axisA, axisB, angle) {
  const axis = normalize(sub(axisB, axisA));
  const p = sub(point, axisA);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return add(axisA, add(add(scale(p, cos), scale(cross(axis, p), sin)), scale(axis, dot(axis, p) * (1 - cos))));
}

function applyFoldTargets(vertices, targetZ, stiffness) {
  vertices.forEach((point, index) => {
    point[2] += (targetZ[index] - point[2]) * stiffness;
  });
}

function relaxEdgeLengths(vertices, edges, restLengths, stiffness) {
  edges.forEach((edge, index) => {
    const a = vertices[edge.vertices[0]];
    const b = vertices[edge.vertices[1]];
    if (!a || !b) return;
    const delta = sub(b, a);
    const current = norm(delta) || 1;
    const correction = (current - restLengths[index]) / current * stiffness * 0.5;
    const move = scale(delta, correction);
    vertices[edge.vertices[0]] = add(a, move);
    vertices[edge.vertices[1]] = sub(b, move);
  });
}

function relaxFacePlanarity(vertices, faces, stiffness) {
  faces.forEach((face) => {
    const valid = face.vertices.map((index) => vertices[index]).filter(Boolean);
    if (valid.length < 3) return;
    const avgZ = valid.reduce((sum, point) => sum + point[2], 0) / valid.length;
    face.vertices.forEach((index) => {
      vertices[index][2] += (avgZ - vertices[index][2]) * stiffness;
    });
  });
}

function computeEdgeResidual(vertices, edges, restLengths) {
  if (!edges.length) return 0;
  const sum = edges.reduce((acc, edge, index) => {
    const current = distance(vertices[edge.vertices[0]], vertices[edge.vertices[1]]);
    return acc + Math.abs(current - restLengths[index]);
  }, 0);
  return sum / edges.length;
}

function findHighestDegreeInteriorVertex(pattern) {
  let best = null;
  let degree = 0;
  pattern.vertexEdges.forEach((edges, index) => {
    const boundary = edges.some((edgeIndex) => pattern.edges[edgeIndex].assignment === "B");
    if (!boundary && edges.length > degree) {
      best = index;
      degree = edges.length;
    }
  });
  return best;
}

function otherVertex(edge, vertex) {
  if (edge.vertices[0] === vertex) return edge.vertices[1];
  if (edge.vertices[1] === vertex) return edge.vertices[0];
  return null;
}

function assignmentSign(assignment) {
  return assignment === "M" ? -1 : 1;
}

function edgeFoldFactor(pattern, edgeIndex) {
  const value = pattern.metadata?.edge_fold_factors?.[edgeIndex];
  return Number.isFinite(value) ? value : 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return norm(sub(a, b));
}

function norm(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a) {
  const length = norm(a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
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
