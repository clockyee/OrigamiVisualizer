export const examples = {
  single: {
    file_title: "Single crease",
    solver_hint: "single-hinge",
    fold_target_degrees: 180,
    metadata: {
      default_progress: 0.86,
    },
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    edges_vertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
    ],
    edges_assignment: ["B", "B", "B", "B", "V"],
    faces_vertices: [
      [0, 1, 2],
      [0, 2, 3],
    ],
  },
  book: {
    file_title: "Book fold",
    solver_hint: "single-hinge",
    fold_target_degrees: 180,
    metadata: {
      default_progress: 0.86,
    },
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0],
      [0.5, 1],
    ],
    edges_vertices: [
      [0, 4],
      [4, 1],
      [1, 2],
      [2, 5],
      [5, 3],
      [3, 0],
      [4, 5],
    ],
    edges_assignment: ["B", "B", "B", "B", "B", "B", "V"],
    faces_vertices: [
      [0, 4, 5, 3],
      [4, 1, 2, 5],
    ],
  },
  twoStep: {
    file_title: "Two-step edge fold",
    solver_hint: "face-sequence-preview",
    fold_target_degrees: 120,
    metadata: {
      default_progress: 0.75,
    },
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.42, 0],
      [0.42, 1],
      [0.72, 0],
      [0.72, 1],
    ],
    edges_vertices: [
      [0, 4],
      [4, 6],
      [6, 1],
      [1, 2],
      [2, 7],
      [7, 5],
      [5, 3],
      [3, 0],
      [4, 5],
      [6, 7],
    ],
    edges_assignment: ["B", "B", "B", "B", "B", "B", "B", "B", "V", "M"],
    faces_vertices: [
      [0, 4, 5, 3],
      [4, 6, 7, 5],
      [6, 1, 2, 7],
    ],
    fold_steps: [
      { edge: 8, angleDegrees: 180, mode: "valley", movingFaceSeed: 1, start: 0, end: 0.5 },
      { edge: 9, angleDegrees: 180, mode: "mountain", movingFaceSeed: 2, start: 0.5, end: 1 },
    ],
  },
  multi: {
    file_title: "Multi-crease simultaneous",
    solver_hint: "face-rigid-preview",
    fold_target_degrees: 70,
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.33, 0],
      [0.33, 1],
      [0.66, 0],
      [0.66, 1],
    ],
    edges_vertices: [
      [0, 4],
      [4, 6],
      [6, 1],
      [1, 2],
      [2, 7],
      [7, 5],
      [5, 3],
      [3, 0],
      [4, 5],
      [6, 7],
    ],
    edges_assignment: ["B", "B", "B", "B", "B", "B", "B", "B", "V", "M"],
    faces_vertices: [
      [0, 4, 5, 3],
      [4, 6, 7, 5],
      [6, 1, 2, 7],
    ],
  },
  blintz: {
    file_title: "Blintz base preview",
    solver_hint: "preview-relaxation",
    fold_target_degrees: 135,
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, 0.5],
    ],
    edges_vertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ],
    edges_assignment: ["B", "B", "B", "B", "V", "V", "V", "V"],
    faces_vertices: [
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ],
  },
  waterbomb: {
    file_title: "Waterbomb base preview",
    solver_hint: "constraint-relaxation-preview",
    fold_target_degrees: 120,
    vertices_coords: [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
      [0, 1],
      [0, 0.5],
      [0.5, 0.5],
    ],
    edges_vertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
      [0, 8],
      [1, 8],
      [2, 8],
      [3, 8],
      [4, 8],
      [5, 8],
      [6, 8],
      [7, 8],
    ],
    edges_assignment: ["B", "B", "B", "B", "B", "B", "B", "B", "V", "M", "V", "M", "V", "M", "V", "M"],
    faces_vertices: [
      [0, 1, 8],
      [1, 2, 8],
      [2, 3, 8],
      [3, 4, 8],
      [4, 5, 8],
      [5, 6, 8],
      [6, 7, 8],
      [7, 0, 8],
    ],
  },
  craneBase: {
    file_title: "Crane base draft",
    solver_hint: "constraint-relaxation-preview",
    fold_target_degrees: 145,
    metadata: {
      note: "First-stage crane/preliminary-base draft. Full crane requires later bird-base petal folds and reverse folds.",
    },
    vertices_coords: [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
      [0, 1],
      [0, 0.5],
      [0.5, 0.5],
    ],
    edges_vertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
      [0, 8],
      [1, 8],
      [2, 8],
      [3, 8],
      [4, 8],
      [5, 8],
      [6, 8],
      [7, 8],
    ],
    edges_assignment: ["B", "B", "B", "B", "B", "B", "B", "B", "V", "M", "V", "M", "V", "M", "V", "M"],
    faces_vertices: [
      [0, 1, 8],
      [1, 2, 8],
      [2, 3, 8],
      [3, 4, 8],
      [4, 5, 8],
      [5, 6, 8],
      [6, 7, 8],
      [7, 0, 8],
    ],
  },
  rabbitEar: {
    file_title: "Rabbit ear fold constrained preview",
    solver_hint: "rabbit-ear-macro-preview",
    fold_target_degrees: 180,
    metadata: {
      note: "Rabbit ear fold with explicit split boundary point and local constraint projection. The solver drives a rabbit-ear target shape, then projects back toward original edge lengths and face planarity.",
      locked_edges: [0, 1, 2, 3, 4],
      default_progress: 0.68,
    },
    vertices_coords: [
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
      [0, 0.35],
      [0.5, 0.5],
    ],
    edges_vertices: [
      [0, 1],
      [1, 5],
      [5, 2],
      [3, 0],
      [2, 3],
      [0, 4],
      [4, 2],
      [1, 4],
      [4, 5],
      [4, 3],
    ],
    edges_assignment: ["B", "B", "B", "B", "B", "V", "V", "M", "M", "F"],
    faces_vertices: [
      [0, 1, 4],
      [1, 5, 4],
      [5, 2, 4],
      [0, 4, 3],
      [4, 2, 3],
    ],
  },
  miura: createMiuraFold(5, 4),
  sink: createSinkFold(),
  broken: {
    file_title: "Broken FOLD check",
    solver_hint: "preview-relaxation",
    fold_target_degrees: 90,
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.5, -0.1],
      [0.5, 1.1],
    ],
    edges_vertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
      [4, 5],
      [1, 99],
    ],
    edges_assignment: ["B", "B", "B", "B", "V", "M", "V"],
    faces_vertices: [[0, 1, 2, 3]],
  },
};

function createMiuraFold(cols, rows) {
  const vertices = [];
  const vertex_grid = [];
  const dx = 1;
  const dy = 0.72;
  const skew = 0.16;

  for (let y = 0; y <= rows; y += 1) {
    const row = [];
    for (let x = 0; x <= cols; x += 1) {
      const offset = x === 0 || x === cols ? 0 : (x % 2 === 0 ? -skew : skew) * (y % 2 === 0 ? 1 : -1);
      row.push(vertices.length);
      vertices.push([x * dx + offset, y * dy]);
    }
    vertex_grid.push(row);
  }

  const edges = [];
  const assignments = [];
  const edgeKey = new Set();
  const addEdge = (a, b, assignment) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    edges.push([a, b]);
    assignments.push(assignment);
  };

  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      addEdge(vertex_grid[y][x], vertex_grid[y][x + 1], y === 0 || y === rows ? "B" : y % 2 === 0 ? "M" : "V");
    }
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      addEdge(vertex_grid[y][x], vertex_grid[y + 1][x], x === 0 || x === cols ? "B" : x % 2 === 0 ? "V" : "M");
    }
  }

  const faces = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      faces.push([vertex_grid[y][x], vertex_grid[y][x + 1], vertex_grid[y + 1][x + 1], vertex_grid[y + 1][x]]);
    }
  }

  return {
    file_title: "Miura-ori analytic strip",
    solver_hint: "face-rigid-preview",
    fold_target_degrees: 35,
    metadata: {
      cols,
      rows,
      vertex_grid,
      note: "Miura CP drawn with a rectangular boundary and alternating slanted mountain/valley creases. The current preview uses rigid panels per crease and reports coupling conflicts instead of stretching the paper.",
    },
    vertices_coords: vertices,
    edges_vertices: edges,
    edges_assignment: assignments,
    faces_vertices: faces,
  };
}

function createSinkFold() {
  return {
    file_title: "Open sink fold preview",
    solver_hint: "sink-fold-constrained-preview",
    fold_target_degrees: 110,
    metadata: {
      note: "Open sink fold macro preview. The local inner square is driven down and inverted under edge-length and face-planarity projection; closed-sink layer contact is not solved.",
      default_progress: 0.55,
    },
    vertices_coords: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0.35, 0.35],
      [0.65, 0.35],
      [0.65, 0.65],
      [0.35, 0.65],
    ],
    edges_vertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ],
    edges_assignment: ["B", "B", "B", "B", "M", "M", "M", "M", "V", "V", "V", "V"],
    faces_vertices: [
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
      [4, 5, 6, 7],
    ],
  };
}
