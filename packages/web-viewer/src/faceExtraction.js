const EPS = 1e-8;

export function extractFacesFromGraph(vertices, edges) {
  const adjacency = vertices.map(() => []);
  edges.forEach(([a, b], edgeIndex) => {
    if (!vertices[a] || !vertices[b] || a === b) return;
    adjacency[a].push({ to: b, edgeIndex, angle: angle(vertices[a], vertices[b]) });
    adjacency[b].push({ to: a, edgeIndex, angle: angle(vertices[b], vertices[a]) });
  });
  adjacency.forEach((items) => items.sort((a, b) => a.angle - b.angle));

  const visited = new Set();
  const faces = [];

  edges.forEach(([a, b]) => {
    [[a, b], [b, a]].forEach(([from, to]) => {
      const startKey = directedKey(from, to);
      if (visited.has(startKey)) return;
      const face = [];
      let currentFrom = from;
      let currentTo = to;

      for (let guard = 0; guard < edges.length * 4 + 8; guard += 1) {
        const key = directedKey(currentFrom, currentTo);
        if (visited.has(key)) break;
        visited.add(key);
        face.push(currentFrom);

        const outgoing = adjacency[currentTo];
        const reverseIndex = outgoing.findIndex((item) => item.to === currentFrom);
        if (reverseIndex === -1) break;
        const next = outgoing[(reverseIndex - 1 + outgoing.length) % outgoing.length];
        currentFrom = currentTo;
        currentTo = next.to;

        if (currentFrom === from && currentTo === to) {
          const area = polygonArea(face.map((index) => vertices[index]));
          if (area > EPS) faces.push(face);
          break;
        }
      }
    });
  });

  return dedupeFaces(faces);
}

function angle(a, b) {
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

function directedKey(a, b) {
  return `${a}->${b}`;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function dedupeFaces(faces) {
  const seen = new Set();
  const result = [];
  faces.forEach((face) => {
    const min = Math.min(...face);
    const minIndex = face.indexOf(min);
    const rotated = [...face.slice(minIndex), ...face.slice(0, minIndex)];
    const key = rotated.join(":");
    if (!seen.has(key) && rotated.length >= 3) {
      seen.add(key);
      result.push(face);
    }
  });
  return result;
}
