export function solveCraneMacro(pattern, progress) {
  const targets = pattern.metadata?.craneTarget3d || [];
  const base = pattern.vertices.map((vertex) => [vertex.coord[0], vertex.coord[1], 0]);
  const p0 = smooth(local(progress, 0, 0.22));
  const p1 = smooth(local(progress, 0.18, 0.5));
  const p2 = smooth(local(progress, 0.48, 0.75));
  const p3 = smooth(local(progress, 0.7, 1));
  const vertices = base.map((point, index) => {
    const target = targets[index] || point;
    const collapsed = [
      point[0] * (1 - 0.28 * p0),
      point[1] * (1 - 0.28 * p0),
      0.2 * p0,
    ];
    const birdBase = lerp3(collapsed, target, p1 * 0.72);
    const reversed = applyReverseFolds(index, birdBase, p2);
    return applyWingOpen(index, reversed, p3);
  });

  const macros = [
    { name: "preliminary-collapse", progress: p0, purpose: "Collapse the square into a compact base." },
    { name: "bird-base-elongation", progress: p1, purpose: "Pull neck, tail, and wing flaps into a crane-like base." },
    { name: "inside-reverse-head-tail", progress: p2, purpose: "Reverse fold head and refine the tail direction." },
    { name: "open-wings", progress: p3, purpose: "Rotate wing panels outward and downward." },
  ];

  return {
    solverType: "crane-macro-preview",
    guarantee: "Named macro preview for a paper crane. This is a staged approximation, not a proof of a valid CP folding path.",
    progress,
    steps: macros,
    faceAdjacency: [],
    movedFacesByStep: macros.map((macro) => ({ macro: macro.name, progress: macro.progress })),
    vertices3: vertices,
    vertices3ByStep: [vertices],
    foldAngles: pattern.edges.map((edge) => {
      if (edge.assignment === "M") return -progress * Math.PI;
      if (edge.assignment === "V") return progress * Math.PI;
      return 0;
    }),
    residual: Number((0.18 * (1 - p1) + 0.05 * (1 - p3)).toFixed(4)),
    warnings: ["Crane macro preview uses staged target geometry; layer ordering and collision are not solved."],
    blockedReason: null,
  };
}

function applyReverseFolds(index, point, amount) {
  const result = [...point];
  if (index === 11) {
    result[0] += 0.22 * amount;
    result[1] -= 0.18 * amount;
    result[2] -= 0.08 * amount;
  }
  if (index === 13) {
    result[0] -= 0.14 * amount;
    result[1] += 0.08 * amount;
    result[2] -= 0.05 * amount;
  }
  return result;
}

function applyWingOpen(index, point, amount) {
  const result = [...point];
  if ([5, 6].includes(index)) {
    result[1] -= 0.12 * amount;
    result[2] -= 0.42 * amount;
  }
  if ([7, 8].includes(index)) {
    result[1] -= 0.12 * amount;
    result[2] -= 0.42 * amount;
  }
  return result;
}

function local(progress, start, end) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start);
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
