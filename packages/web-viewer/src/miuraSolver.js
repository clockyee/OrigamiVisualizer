export function solveMiuraAnalytic(pattern, progress) {
  const grid = pattern.metadata?.vertex_grid;
  if (!Array.isArray(grid) || !grid.length) {
    return {
      solverType: "blocked-invalid-cp",
      guarantee: "Miura analytic preview requires metadata.vertex_grid.",
      progress,
      steps: [],
      faceAdjacency: [],
      movedFacesByStep: [],
      vertices3: pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]),
      vertices3ByStep: [],
      foldAngles: pattern.edges.map(() => 0),
      residual: 1,
      warnings: ["Missing Miura vertex grid metadata."],
      blockedReason: "Missing Miura vertex grid metadata.",
    };
  }

  const factorSummary = activeFactorSummary(pattern);
  const theta = progress * Math.PI * 0.46 * factorSummary.mean;
  const restLengths = pattern.edges.map((edge) => distance(pattern.vertices[edge.vertices[0]].coord, pattern.vertices[edge.vertices[1]].coord));
  const vertices3 = pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
  const targets = miuraTargets(pattern, grid, theta);

  for (let iteration = 0; iteration < 220; iteration += 1) {
    vertices3.forEach((point, index) => {
      point[0] += (targets[index][0] - point[0]) * 0.035;
      point[1] += (targets[index][1] - point[1]) * 0.035;
      point[2] += (targets[index][2] - point[2]) * 0.08;
    });
    relaxEdgeLengths(vertices3, pattern.edges, restLengths, 0.72);
    relaxFacePlanarity(vertices3, pattern.faces, 0.08);
    relaxFaceCentroids(vertices3, pattern, 0.02);
  }
  centerVertices(vertices3);

  const foldAngles = pattern.edges.map((edge) => {
    if (edge.assignment !== "M" && edge.assignment !== "V") return 0;
    const horizontal = isMostlyHorizontal(pattern, edge);
    const amount = horizontal ? theta : theta * 0.42;
    return (edge.assignment === "M" ? -1 : 1) * amount;
  });

  return {
    solverType: "miura-projected-preview",
    guarantee: "Miura-style projected constraint preview. It uses the rectangular CP display and repeatedly projects vertices toward original edge lengths; it is still not a generic rigid-origami solver.",
    progress,
    steps: pattern.edges
      .filter((edge) => edge.assignment === "M" || edge.assignment === "V")
      .map((edge) => ({
        edge: edge.index,
        angleDegrees: (edge.assignment === "M" ? -1 : 1) * 130,
        mode: edge.assignment === "M" ? "mountain" : "valley",
        start: 0,
        end: 1,
      })),
    faceAdjacency: [],
    movedFacesByStep: [],
    vertices3,
    vertices3ByStep: [vertices3],
    foldAngles,
    residual: 0,
    warnings: factorSummary.nonUniform ? ["Miura is a coupled mechanism; individual edge fold factors are averaged for this analytic strip preview."] : [],
    blockedReason: null,
  };
}

function activeFactorSummary(pattern) {
  const factors = pattern.edges
    .filter((edge) => edge.assignment === "M" || edge.assignment === "V")
    .map((edge) => edgeFoldFactor(pattern, edge.index));
  if (!factors.length) return { mean: 1, nonUniform: false };
  const mean = factors.reduce((sum, value) => sum + value, 0) / factors.length;
  return { mean, nonUniform: factors.some((value) => Math.abs(value - mean) > 1e-3) };
}

function edgeFoldFactor(pattern, edgeIndex) {
  const value = pattern.metadata?.edge_fold_factors?.[edgeIndex];
  return Number.isFinite(value) ? value : 1;
}

function miuraTargets(pattern, grid, theta) {
  const amplitude = Math.sin(theta) * 0.58;
  const compressionY = 1 - 0.22 * (1 - Math.cos(theta));
  const compressionX = 1 - 0.08 * (1 - Math.cos(theta));
  const all = pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
  const center = flatCenter(pattern);
  grid.forEach((row, y) => {
    row.forEach((vertexIndex, x) => {
      const base = pattern.vertices[vertexIndex].coord;
      all[vertexIndex] = [
        center[0] + (base[0] - center[0]) * compressionX,
        center[1] + (base[1] - center[1]) * compressionY,
        ((x + y) % 2 === 0 ? 1 : -1) * amplitude * Math.sin((y / Math.max(1, grid.length - 1)) * Math.PI),
      ];
    });
  });
  return all;
}

function relaxEdgeLengths(vertices, edges, restLengths, stiffness) {
  edges.forEach((edge, index) => {
    const a = vertices[edge.vertices[0]];
    const b = vertices[edge.vertices[1]];
    const delta = sub(b, a);
    const current = norm(delta) || 1;
    const correction = (current - restLengths[index]) / current * stiffness * 0.5;
    const move = scale(delta, correction);
    vertices[edge.vertices[0]] = add(a, move);
    vertices[edge.vertices[1]] = sub(b, move);
  });
}

function relaxFaceCentroids(vertices, pattern, stiffness) {
  pattern.faces.forEach((face) => {
    const points = face.vertices.map((index) => vertices[index]);
    const centroid = points.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / points.length);
    const rest = face.vertices.map((index) => pattern.vertices[index].coord);
    const restCentroid = rest.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]).map((value) => value / rest.length);
    face.vertices.forEach((index, localIndex) => {
      const base = rest[localIndex];
      vertices[index][0] += (centroid[0] + base[0] - restCentroid[0] - vertices[index][0]) * stiffness;
      vertices[index][1] += (centroid[1] + base[1] - restCentroid[1] - vertices[index][1]) * stiffness;
    });
  });
}

function relaxFacePlanarity(vertices, faces, stiffness) {
  faces.forEach((face) => {
    if (face.vertices.length < 4) return;
    const points = face.vertices.map((index) => vertices[index]);
    const normal = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    const length = norm(normal);
    if (length < 1e-8) return;
    const unit = scale(normal, 1 / length);
    face.vertices.forEach((index) => {
      const signed = dot(sub(vertices[index], points[0]), unit);
      vertices[index] = sub(vertices[index], scale(unit, signed * stiffness));
    });
  });
}

function flatCenter(pattern) {
  return pattern.vertices.reduce((sum, vertex) => [
    sum[0] + vertex.coord[0],
    sum[1] + vertex.coord[1],
  ], [0, 0]).map((value) => value / pattern.vertices.length);
}

function centerVertices(vertices) {
  if (!vertices.length) return;
  const center = vertices.reduce((sum, vertex) => [
    sum[0] + vertex[0],
    sum[1] + vertex[1],
    sum[2] + vertex[2],
  ], [0, 0, 0]).map((value) => value / vertices.length);
  vertices.forEach((vertex) => {
    vertex[0] -= center[0];
    vertex[1] -= center[1];
    vertex[2] -= center[2];
  });
}

function isMostlyHorizontal(pattern, edge) {
  const a = pattern.vertices[edge.vertices[0]]?.coord;
  const b = pattern.vertices[edge.vertices[1]]?.coord;
  if (!a || !b) return false;
  return Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
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

function norm(a) {
  return Math.hypot(a[0], a[1], a[2]);
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
