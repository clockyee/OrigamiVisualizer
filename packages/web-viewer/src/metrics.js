const EPS = 1e-7;

export function addSolverDiagnostics(pattern, trace) {
  const metrics = computeSolverMetrics(pattern, trace.vertices3 || []);
  const warnings = [...(trace.warnings || [])];
  if (metrics.max_face_area_error > 0.05) {
    warnings.push(`Face area error ${(metrics.max_face_area_error * 100).toFixed(2)}%: paper surface is stretching in this preview.`);
  } else if (metrics.max_face_area_error > 0.015) {
    warnings.push(`Face area drift ${(metrics.max_face_area_error * 100).toFixed(2)}%: preview is approximate.`);
  }
  if (metrics.intersection_count > 0) {
    warnings.push(`${metrics.intersection_count} non-adjacent face intersections detected. Layer order/contact is not solved in the web preview.`);
  }
  return {
    ...trace,
    residual: Math.max(trace.residual || 0, metrics.mean_edge_strain, metrics.max_face_area_error),
    metrics,
    warnings,
  };
}

export function computeSolverMetrics(pattern, vertices3) {
  const edgeStrains = pattern.edges.map((edge) => {
    const a2 = pattern.vertices[edge.vertices[0]]?.coord;
    const b2 = pattern.vertices[edge.vertices[1]]?.coord;
    const a3 = vertices3[edge.vertices[0]];
    const b3 = vertices3[edge.vertices[1]];
    if (!a2 || !b2 || !a3 || !b3) return 0;
    const rest = distance2(a2, b2) || 1;
    return Math.abs(distance3(a3, b3) - rest) / rest;
  });
  const faceAreaErrors = pattern.faces.map((face) => {
    const rest = Math.abs(polygonArea2(face.vertices.map((index) => pattern.vertices[index]?.coord).filter(Boolean))) || 1;
    const current = triangleFanArea3(face.vertices.map((index) => vertices3[index]).filter(Boolean));
    return Math.abs(current - rest) / rest;
  });
  const intersections = findFaceIntersections(pattern, vertices3);
  const maxEdgeStrain = Math.max(0, ...edgeStrains);
  const meanEdgeStrain = edgeStrains.length ? edgeStrains.reduce((sum, value) => sum + value, 0) / edgeStrains.length : 0;
  const maxFaceAreaError = Math.max(0, ...faceAreaErrors);
  const meanFaceAreaError = faceAreaErrors.length ? faceAreaErrors.reduce((sum, value) => sum + value, 0) / faceAreaErrors.length : 0;
  return {
    edge_strains: edgeStrains,
    face_area_errors: faceAreaErrors,
    max_edge_strain: maxEdgeStrain,
    mean_edge_strain: meanEdgeStrain,
    max_face_area_error: maxFaceAreaError,
    mean_face_area_error: meanFaceAreaError,
    intersection_count: intersections.length,
    intersections,
    layer_warning: intersections.length > 0 ? "Non-adjacent faces intersect; contact/layer ordering is not solved." : "No non-adjacent triangle intersections detected.",
    trustworthy_preview: maxEdgeStrain < 0.02 && maxFaceAreaError < 0.02 && intersections.length === 0,
  };
}

function findFaceIntersections(pattern, vertices3) {
  const triangles = [];
  pattern.faces.forEach((face) => {
    const [first, ...rest] = face.vertices;
    for (let i = 0; i < rest.length - 1; i += 1) {
      const indices = [first, rest[i], rest[i + 1]];
      const points = indices.map((index) => vertices3[index]);
      if (points.every(Boolean)) triangles.push({ face: face.index, indices, points, bbox: bbox(points) });
    }
  });
  const intersections = [];
  for (let i = 0; i < triangles.length; i += 1) {
    for (let j = i + 1; j < triangles.length; j += 1) {
      const a = triangles[i];
      const b = triangles[j];
      if (a.face === b.face) continue;
      if (a.indices.some((index) => b.indices.includes(index))) continue;
      if (!bboxOverlap(a.bbox, b.bbox)) continue;
      if (trianglesIntersect(a.points, b.points)) intersections.push({ faces: [a.face, b.face] });
    }
  }
  return intersections;
}

function trianglesIntersect(a, b) {
  const edgesA = [[a[0], a[1]], [a[1], a[2]], [a[2], a[0]]];
  const edgesB = [[b[0], b[1]], [b[1], b[2]], [b[2], b[0]]];
  if (edgesA.some(([p, q]) => segmentTriangleIntersection(p, q, b))) return true;
  if (edgesB.some(([p, q]) => segmentTriangleIntersection(p, q, a))) return true;
  return pointInTriangle3(a[0], b) || pointInTriangle3(b[0], a);
}

function segmentTriangleIntersection(p0, p1, tri) {
  const dir = sub(p1, p0);
  const edge1 = sub(tri[1], tri[0]);
  const edge2 = sub(tri[2], tri[0]);
  const h = cross(dir, edge2);
  const det = dot(edge1, h);
  if (Math.abs(det) < EPS) return false;
  const invDet = 1 / det;
  const s = sub(p0, tri[0]);
  const u = invDet * dot(s, h);
  if (u < EPS || u > 1 - EPS) return false;
  const q = cross(s, edge1);
  const v = invDet * dot(dir, q);
  if (v < EPS || u + v > 1 - EPS) return false;
  const t = invDet * dot(edge2, q);
  return t > EPS && t < 1 - EPS;
}

function pointInTriangle3(point, tri) {
  const n = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]));
  const area2 = norm(n);
  if (area2 < EPS) return false;
  if (Math.abs(dot(sub(point, tri[0]), n)) / area2 > 1e-5) return false;
  const c0 = cross(sub(tri[1], tri[0]), sub(point, tri[0]));
  const c1 = cross(sub(tri[2], tri[1]), sub(point, tri[1]));
  const c2 = cross(sub(tri[0], tri[2]), sub(point, tri[2]));
  const d0 = dot(c0, n);
  const d1 = dot(c1, n);
  const d2 = dot(c2, n);
  return d0 > EPS && d1 > EPS && d2 > EPS;
}

function bbox(points) {
  return points.reduce((box, point) => ({
    min: box.min.map((value, index) => Math.min(value, point[index])),
    max: box.max.map((value, index) => Math.max(value, point[index])),
  }), { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
}

function bboxOverlap(a, b) {
  return a.min.every((value, index) => value <= b.max[index] + EPS && a.max[index] + EPS >= b.min[index]);
}

function polygonArea2(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function triangleFanArea3(points) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    area += norm(cross(sub(points[i], points[0]), sub(points[i + 1], points[0]))) / 2;
  }
  return area;
}

function distance2(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distance3(a, b) {
  return norm(sub(a, b));
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
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
