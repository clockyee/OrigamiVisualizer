import { hasBlockingFailures } from "./cp.js";
import { solveConstraintRelaxation } from "./constraintSolver.js";
import { solveCraneMacro } from "./craneMacroSolver.js";
import { addSolverDiagnostics } from "./metrics.js";
import { solveMiuraAnalytic } from "./miuraSolver.js";
import { solveRabbitEar } from "./rabbitEarSolver.js";
import { solveSinkFold } from "./sinkSolver.js";

export function solveFold(pattern, progress) {
  if (hasBlockingFailures(pattern)) return finish(pattern, blocked(pattern, progress, "Blocking CP check failure."));
  if (pattern.solverHint === "constraint-relaxation-preview") {
    return finish(pattern, solveConstraintRelaxation(pattern, progress));
  }
  if (pattern.solverHint === "crane-macro-preview") {
    return finish(pattern, solveCraneMacro(pattern, progress));
  }
  if (pattern.solverHint === "rabbit-ear-macro-preview") {
    return finish(pattern, solveRabbitEar(pattern, progress));
  }
  if (pattern.solverHint === "sink-fold-constrained-preview") {
    return finish(pattern, solveSinkFold(pattern, progress));
  }
  if (pattern.solverHint === "miura-analytic-preview") {
    return finish(pattern, solveMiuraAnalytic(pattern, progress));
  }
  if (pattern.solverHint === "unsupported-by-current-solver" || pattern.solverHint === "analytic-miura") {
    return finish(pattern, blocked(pattern, progress, "This pattern is not supported by the current face-rigid solver."));
  }
  if (pattern.solverHint === "face-sequence-preview" && pattern.foldSteps.length) {
    return finish(pattern, solveSequence(pattern, progress));
  }
  return finish(pattern, solveSimultaneous(pattern, progress));
}

function finish(pattern, trace) {
  return addSolverDiagnostics(pattern, trace);
}

function solveSimultaneous(pattern, progress) {
  const base = flatVertices(pattern);
  const adjacency = buildFaceAdjacency(pattern);
  const active = pattern.edges.filter((edge) => edge.assignment === "M" || edge.assignment === "V");
  const warnings = [];
  const movedByStep = [];
  const vertices = base.map((point) => [...point]);
  const movedCounts = new Map();

  active.forEach((edge) => {
    if (edge.faces.length !== 2) {
      warnings.push(`e${edge.index} skipped: crease needs exactly two adjacent faces.`);
      return;
    }
    const angle = assignmentSign(edge.assignment) * pattern.targetDegrees * progress * edgeFoldFactor(pattern, edge.index);
    const movingFaces = collectMovingFaces(adjacency, edge.index, edge.faces[1]);
    rotateFaces(pattern, vertices, edge, movingFaces, angle, movedCounts);
    movedByStep.push({ edge: edge.index, movedFaces: movingFaces, angleDegrees: angle });
  });

  const conflicted = Array.from(movedCounts.entries()).filter(([, count]) => count > 1).map(([vertex]) => Number(vertex));
  if (conflicted.length) warnings.push(`Simultaneous preview conflict: vertices moved by multiple creases: v${conflicted.join(", v")}.`);

  return {
    solverType: "face-rigid-preview",
    guarantee: "Face-rigid geometric preview. It preserves panels per step but does not prove global validity or collision-free folding.",
    progress,
    steps: active.map((edge) => ({ edge: edge.index, angleDegrees: assignmentSign(edge.assignment) * pattern.targetDegrees * edgeFoldFactor(pattern, edge.index), mode: edge.assignment === "M" ? "mountain" : "valley", start: 0, end: 1 })),
    faceAdjacency: adjacency.links,
    movedFacesByStep: movedByStep,
    vertices3: vertices,
    vertices3ByStep: [vertices],
    foldAngles: pattern.edges.map((edge) => active.includes(edge) ? assignmentSign(edge.assignment) * pattern.targetDegrees * progress * edgeFoldFactor(pattern, edge.index) * Math.PI / 180 : 0),
    residual: warnings.length ? 0.5 : 0,
    warnings,
    blockedReason: null,
  };
}

function solveSequence(pattern, progress) {
  const vertices = flatVertices(pattern);
  const adjacency = buildFaceAdjacency(pattern);
  const movedCounts = new Map();
  const movedFacesByStep = [];
  const vertices3ByStep = [vertices.map((point) => [...point])];
  const warnings = [];

  pattern.foldSteps.forEach((step) => {
    const edge = pattern.edges[step.edge];
    if (!edge || edge.faces.length !== 2) {
      warnings.push(`step edge e${step.edge} skipped: crease needs exactly two adjacent faces.`);
      return;
    }
    const local = localProgress(progress, step.start, step.end);
    const seed = Number.isInteger(step.movingFaceSeed) ? step.movingFaceSeed : edge.faces[1];
    const blockedEdges = step.blockOtherCreases ? activeCreaseBoundaries(pattern, edge.index) : [edge.index];
    const movingFaces = collectMovingFaces(adjacency, blockedEdges, seed);
    const signedAngle = stepSign(step, edge) * step.angleDegrees * local * edgeFoldFactor(pattern, edge.index);
    rotateFaces(pattern, vertices, edge, movingFaces, signedAngle, movedCounts);
    movedFacesByStep.push({ edge: edge.index, movedFaces: movingFaces, angleDegrees: signedAngle, progress: local });
    vertices3ByStep.push(vertices.map((point) => [...point]));
  });

  return {
    solverType: "face-sequence-preview",
    guarantee: "Sequential face-rigid preview. Later steps operate on the already folded vertex positions.",
    progress,
    steps: pattern.foldSteps,
    faceAdjacency: adjacency.links,
    movedFacesByStep,
    vertices3: vertices,
    vertices3ByStep,
    foldAngles: pattern.edges.map((edge) => {
      const step = pattern.foldSteps.find((item) => item.edge === edge.index);
      if (!step) return 0;
      return stepSign(step, edge) * step.angleDegrees * localProgress(progress, step.start, step.end) * edgeFoldFactor(pattern, edge.index) * Math.PI / 180;
    }),
    residual: warnings.length ? 0.5 : 0,
    warnings,
    blockedReason: null,
  };
}

function blocked(pattern, progress, reason) {
  return {
    solverType: "blocked-invalid-cp",
    guarantee: reason,
    progress,
    steps: pattern.foldSteps || [],
    faceAdjacency: [],
    movedFacesByStep: [],
    vertices3: flatVertices(pattern),
    vertices3ByStep: [flatVertices(pattern)],
    foldAngles: pattern.edges.map(() => 0),
    residual: 1,
    warnings: pattern.checks.filter((check) => check.status === "fail").map((check) => check.label),
    blockedReason: reason,
  };
}

function flatVertices(pattern) {
  return pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
}

function buildFaceAdjacency(pattern) {
  const byFace = pattern.faces.map(() => []);
  const links = [];
  pattern.edges.forEach((edge) => {
    if (edge.faces.length === 2) {
      const [a, b] = edge.faces;
      byFace[a].push({ face: b, edge: edge.index });
      byFace[b].push({ face: a, edge: edge.index });
      links.push({ edge: edge.index, faces: [a, b] });
    }
  });
  return { byFace, links };
}

function collectMovingFaces(adjacency, blockedEdge, seedFace) {
  const blockedEdges = Array.isArray(blockedEdge) ? new Set(blockedEdge) : new Set([blockedEdge]);
  const seen = new Set();
  const queue = [seedFace];
  while (queue.length) {
    const face = queue.shift();
    if (seen.has(face)) continue;
    seen.add(face);
    (adjacency.byFace[face] || []).forEach((next) => {
      if (!blockedEdges.has(next.edge) && !seen.has(next.face)) queue.push(next.face);
    });
  }
  return Array.from(seen);
}

function activeCreaseBoundaries(pattern, currentEdge) {
  const active = pattern.edges
    .filter((edge) => edge.index === currentEdge || edge.assignment === "M" || edge.assignment === "V")
    .map((edge) => edge.index);
  return Array.from(new Set(active));
}

function rotateFaces(pattern, vertices, edge, movingFaces, angleDegrees, movedCounts) {
  const movingVertices = new Set();
  movingFaces.forEach((faceIndex) => {
    pattern.faces[faceIndex]?.vertices.forEach((vertex) => movingVertices.add(vertex));
  });
  edge.vertices.forEach((vertex) => movingVertices.delete(vertex));
  const axisA = vertices[edge.vertices[0]];
  const axisB = vertices[edge.vertices[1]];
  const angle = angleDegrees * Math.PI / 180;
  movingVertices.forEach((vertexIndex) => {
    vertices[vertexIndex] = rotateAroundAxis(vertices[vertexIndex], axisA, axisB, angle);
    movedCounts.set(vertexIndex, (movedCounts.get(vertexIndex) || 0) + 1);
  });
}

function rotateAroundAxis(point, axisA, axisB, angle) {
  const axis = normalize(sub(axisB, axisA));
  const p = sub(point, axisA);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const term1 = scale(p, cos);
  const term2 = scale(cross(axis, p), sin);
  const term3 = scale(axis, dot(axis, p) * (1 - cos));
  return add(axisA, add(add(term1, term2), term3));
}

function localProgress(progress, start, end) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / Math.max(1e-6, end - start);
}

function stepSign(step, edge) {
  if (step.mode === "mountain") return -1;
  if (step.mode === "valley") return 1;
  return assignmentSign(edge.assignment);
}

function assignmentSign(assignment) {
  return assignment === "M" ? -1 : 1;
}

function edgeFoldFactor(pattern, edgeIndex) {
  const value = pattern.metadata?.edge_fold_factors?.[edgeIndex];
  return Number.isFinite(value) ? value : 1;
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

function normalize(a) {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}
