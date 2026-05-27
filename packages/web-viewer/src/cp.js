const EPS = 1e-7;

export function parseFold(raw) {
  const checks = [];
  const vertices = Array.isArray(raw.vertices_coords) ? raw.vertices_coords.map((coord, index) => ({ index, coord })) : [];
  const edgesInput = Array.isArray(raw.edges_vertices) ? raw.edges_vertices : [];
  const assignments = Array.isArray(raw.edges_assignment) ? raw.edges_assignment : [];
  const faces = Array.isArray(raw.faces_vertices) ? raw.faces_vertices.map((vertices, index) => ({ index, vertices })) : [];

  addCheck(checks, "parse", "JSON schema", vertices.length > 0 && edgesInput.length > 0 && faces.length > 0 ? "pass" : "fail", "Requires vertices_coords, edges_vertices, and faces_vertices arrays.", {});

  const validVertexCoords = vertices.every(({ coord }) => Array.isArray(coord) && coord.length >= 2 && coord.every(Number.isFinite));
  const badVertices = vertices.filter(({ coord }) => !Array.isArray(coord) || coord.length < 2 || !coord.every(Number.isFinite)).map((vertex) => vertex.index);
  addCheck(checks, "parse", "Vertex coordinates", validVertexCoords ? "pass" : "fail", badVertices.length ? `Invalid vertices: ${badVertices.join(", ")}.` : `${vertices.length} vertices parsed.`, { vertices: badVertices });

  const edges = edgesInput.map(([a, b], index) => ({
    index,
    vertices: [a, b],
    assignment: normalizeAssignment(assignments[index]),
    faces: [],
  }));

  const badEdgeRefs = edges.filter((edge) => !edge.vertices.every((vertex) => Number.isInteger(vertex) && vertex >= 0 && vertex < vertices.length)).map((edge) => edge.index);
  const edgeRefsValid = badEdgeRefs.length === 0;
  addCheck(checks, "parse", "Edge references", edgeRefsValid ? "pass" : "fail", badEdgeRefs.length ? `Bad edge refs: e${badEdgeRefs.join(", e")}.` : "Every edge endpoint must refer to an existing vertex.", { edges: badEdgeRefs });

  const badFaceRefs = faces.filter((face) => face.vertices.length < 3 || !face.vertices.every((vertex) => Number.isInteger(vertex) && vertex >= 0 && vertex < vertices.length)).map((face) => face.index);
  const faceRefsValid = badFaceRefs.length === 0;
  addCheck(checks, "parse", "Face references", faceRefsValid ? "pass" : "fail", badFaceRefs.length ? `Bad face refs: f${badFaceRefs.join(", f")}.` : "Every face must have at least three valid vertices.", { faces: badFaceRefs });

  const duplicateEdges = findDuplicateEdges(edges);
  addCheck(checks, "parse", "Duplicate edges", duplicateEdges.length === 0 ? "pass" : "warn", duplicateEdges.length ? `Duplicate edges: e${duplicateEdges.join(", e")}.` : "No duplicate undirected edges.", { edges: duplicateEdges });

  const vertexEdges = vertices.map(() => []);
  edges.forEach((edge) => {
    if (edge.vertices.every((vertex) => vertexEdges[vertex])) {
      vertexEdges[edge.vertices[0]].push(edge.index);
      vertexEdges[edge.vertices[1]].push(edge.index);
    }
  });
  const isolated = vertexEdges.map((list, index) => (list.length === 0 ? index : null)).filter((index) => index !== null);
  addCheck(checks, "parse", "Isolated vertices", isolated.length === 0 ? "pass" : "warn", isolated.length ? `Isolated vertices: v${isolated.join(", v")}.` : "All vertices are incident to at least one edge.", { vertices: isolated });

  const edgeMap = new Map();
  edges.forEach((edge) => edgeMap.set(edgeKey(edge.vertices[0], edge.vertices[1]), edge));
  faces.forEach((face) => {
    for (let i = 0; i < face.vertices.length; i += 1) {
      const a = face.vertices[i];
      const b = face.vertices[(i + 1) % face.vertices.length];
      const edge = edgeMap.get(edgeKey(a, b));
      if (edge) edge.faces.push(face.index);
    }
  });

  const nonManifold = edges.filter((edge) => edge.faces.length > 2);
  addCheck(checks, "parse", "Non-manifold edges", nonManifold.length === 0 ? "pass" : "fail", nonManifold.length ? `Non-manifold edges: e${nonManifold.map((edge) => edge.index).join(", e")}.` : "No edge has more than two adjacent faces.", { edges: nonManifold.map((edge) => edge.index) });

  const missingFaceEdges = findMissingFaceEdges(faces, edgeMap);
  addCheck(checks, "planar", "Face-edge adjacency", missingFaceEdges.length === 0 ? "pass" : "fail", missingFaceEdges.length ? `Missing face edges around ${missingFaceEdges.slice(0, 5).map((item) => `f${item.face}(${item.vertices.join("-")})`).join(", ")}.` : "All face boundaries resolve to edges.", { faces: unique(missingFaceEdges.map((item) => item.face)), vertices: unique(missingFaceEdges.flatMap((item) => item.vertices)) });

  const faceSelfIntersections = findFaceSelfIntersections(faces, vertices);
  addCheck(checks, "planar", "Face self-intersection", faceSelfIntersections.length === 0 ? "pass" : "fail", faceSelfIntersections.length ? `Self-intersecting faces: f${faceSelfIntersections.join(", f")}.` : "No self-intersecting faces detected.", { faces: faceSelfIntersections });

  const crossingEdges = findCrossingEdges(edges, vertices);
  addCheck(checks, "planar", "Unsplit edge crossings", crossingEdges.length === 0 ? "pass" : "fail", crossingEdges.length ? `Crossing edge pairs: ${crossingEdges.slice(0, 5).map((pair) => `e${pair[0]} x e${pair[1]}`).join(", ")}.` : "No unsplit line crossings detected.", { edges: unique(crossingEdges.flat()) });

  const badBoundaries = edges.filter((edge) => edge.assignment === "B" && edge.faces.length > 1).map((edge) => edge.index);
  const boundaryOk = badBoundaries.length === 0;
  addCheck(checks, "planar", "Boundary consistency", boundaryOk ? "pass" : "warn", boundaryOk ? "Boundary edges have at most one adjacent face." : `Boundary edges with multiple faces: e${badBoundaries.join(", e")}.`, { edges: badBoundaries });

  const vertexAngles = computeVertexAngles(vertices, edges, vertexEdges);
  const kawasakiWarnings = vertexAngles.filter((item) => item.interior && item.kawasakiError > 1e-2);
  addCheck(checks, "origami", "Kawasaki local condition", kawasakiWarnings.length === 0 ? "pass" : "warn", kawasakiWarnings.length ? `Vertices: ${kawasakiWarnings.slice(0, 8).map((item) => `v${item.index} err ${item.kawasakiError.toFixed(2)}deg`).join(", ")}.` : "Interior vertices pass the implemented local check.", { vertices: kawasakiWarnings.map((item) => item.index) });

  const maekawaWarnings = vertexAngles.filter((item) => item.interior && item.assignedDegree >= 4 && Math.abs(item.mountain - item.valley) !== 2);
  addCheck(checks, "origami", "Maekawa local condition", maekawaWarnings.length === 0 ? "pass" : "warn", maekawaWarnings.length ? `Vertices: ${maekawaWarnings.slice(0, 8).map((item) => `v${item.index} M${item.mountain}/V${item.valley}`).join(", ")}.` : "Interior vertices pass the implemented MV count check.", { vertices: maekawaWarnings.map((item) => item.index) });

  const missingAssignments = edges.filter((edge) => edge.assignment === "U" || edge.assignment === "F").map((edge) => edge.index);
  addCheck(checks, "origami", "Mountain/valley assignments", missingAssignments.length === 0 ? "pass" : "warn", missingAssignments.length ? `Flat/unassigned edges: e${missingAssignments.join(", e")}.` : "All non-boundary folds have assignments.", { edges: missingAssignments });

  const smallAngles = vertexAngles.filter((item) => item.minAngle > 0 && item.minAngle < 3);
  addCheck(checks, "origami", "Singular small angles", smallAngles.length === 0 ? "pass" : "warn", smallAngles.length ? `Vertices: ${smallAngles.map((item) => `v${item.index} ${item.minAngle.toFixed(2)}deg`).join(", ")}.` : "No extremely small local sectors detected.", { vertices: smallAngles.map((item) => item.index) });

  addCheck(checks, "origami", "Global layer ordering", "unknown", "Not solved in this prototype.", {});
  addCheck(checks, "origami", "Collision-free folding path", "unknown", "Not solved in this prototype.", {});

  const assignmentCounts = edges.reduce((acc, edge) => {
    acc[edge.assignment] = (acc[edge.assignment] || 0) + 1;
    return acc;
  }, { M: 0, V: 0, B: 0, F: 0, U: 0 });

  return {
    title: raw.file_title || "Untitled FOLD",
    solverHint: raw.solver_hint || "preview-relaxation",
    targetDegrees: raw.fold_target_degrees || 90,
    foldSteps: Array.isArray(raw.fold_steps) ? raw.fold_steps : [],
    metadata: raw.metadata || {},
    vertices,
    edges,
    faces,
    vertexEdges,
    assignmentCounts,
    checks,
  };
}

export function groupedChecks(checks) {
  return ["parse", "planar", "origami"].map((group) => ({
    group,
    label: group === "parse" ? "Parse checks" : group === "planar" ? "Planar graph checks" : "Origami checks",
    items: checks.filter((check) => check.group === group),
  }));
}

export function hasBlockingFailures(pattern) {
  return pattern.checks.some((check) => check.status === "fail");
}

function addCheck(checks, group, label, status, detail, refs = {}) {
  checks.push({ group, label, status, detail, refs });
}

function normalizeAssignment(value) {
  if (["M", "V", "B", "F", "U"].includes(value)) return value;
  return "U";
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function findDuplicateEdges(edges) {
  const seen = new Set();
  const duplicates = [];
  edges.forEach((edge) => {
    const key = edgeKey(edge.vertices[0], edge.vertices[1]);
    if (seen.has(key)) duplicates.push(edge.index);
    seen.add(key);
  });
  return duplicates;
}

function findMissingFaceEdges(faces, edgeMap) {
  const missing = [];
  faces.forEach((face) => {
    for (let i = 0; i < face.vertices.length; i += 1) {
      const vertices = [face.vertices[i], face.vertices[(i + 1) % face.vertices.length]];
      if (!edgeMap.has(edgeKey(vertices[0], vertices[1]))) missing.push({ face: face.index, vertices });
    }
  });
  return missing;
}

function findFaceSelfIntersections(faces, vertices) {
  return faces.filter((face) => {
    for (let i = 0; i < face.vertices.length; i += 1) {
      const a = vertices[face.vertices[i]]?.coord;
      const b = vertices[face.vertices[(i + 1) % face.vertices.length]]?.coord;
      for (let j = i + 1; j < face.vertices.length; j += 1) {
        if (Math.abs(i - j) <= 1 || (i === 0 && j === face.vertices.length - 1)) continue;
        const c = vertices[face.vertices[j]]?.coord;
        const d = vertices[face.vertices[(j + 1) % face.vertices.length]]?.coord;
        if (a && b && c && d && segmentsIntersect(a, b, c, d)) return true;
      }
    }
    return false;
  }).map((face) => face.index);
}

function findCrossingEdges(edges, vertices) {
  const crossings = [];
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const edgeA = edges[i];
      const edgeB = edges[j];
      if (edgeA.vertices.some((vertex) => edgeB.vertices.includes(vertex))) continue;
      const a = vertices[edgeA.vertices[0]]?.coord;
      const b = vertices[edgeA.vertices[1]]?.coord;
      const c = vertices[edgeB.vertices[0]]?.coord;
      const d = vertices[edgeB.vertices[1]]?.coord;
      if (a && b && c && d && segmentsIntersect(a, b, c, d)) crossings.push([edgeA.index, edgeB.index]);
    }
  }
  return crossings;
}

function unique(items) {
  return Array.from(new Set(items)).filter((item) => item !== undefined && item !== null);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < -EPS && o3 * o4 < -EPS;
}

function orient(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function computeVertexAngles(vertices, edges, vertexEdges) {
  return vertices.map((vertex, index) => {
    const incident = vertexEdges[index]
      .map((edgeIndex) => edges[edgeIndex])
      .filter((edge) => edge.vertices.every((vertexIndex) => vertices[vertexIndex]));
    const directions = incident.map((edge) => {
      const other = edge.vertices[0] === index ? edge.vertices[1] : edge.vertices[0];
      const coord = vertices[other].coord;
      return {
        angle: Math.atan2(coord[1] - vertex.coord[1], coord[0] - vertex.coord[0]),
        assignment: edge.assignment,
      };
    }).sort((a, b) => a.angle - b.angle);

    const sectorAngles = [];
    for (let i = 0; i < directions.length; i += 1) {
      const current = directions[i].angle;
      const next = directions[(i + 1) % directions.length].angle + (i === directions.length - 1 ? Math.PI * 2 : 0);
      sectorAngles.push(((next - current) * 180) / Math.PI);
    }

    const altA = sectorAngles.filter((_, i) => i % 2 === 0).reduce((sum, angle) => sum + angle, 0);
    const altB = sectorAngles.filter((_, i) => i % 2 === 1).reduce((sum, angle) => sum + angle, 0);
    const mountain = directions.filter((dir) => dir.assignment === "M").length;
    const valley = directions.filter((dir) => dir.assignment === "V").length;
    const boundary = directions.filter((dir) => dir.assignment === "B").length;
    return {
      index,
      degree: directions.length,
      assignedDegree: mountain + valley,
      mountain,
      valley,
      interior: directions.length >= 4 && boundary === 0,
      kawasakiError: Math.abs(altA - altB),
      minAngle: sectorAngles.length ? Math.min(...sectorAngles) : 0,
    };
  });
}
