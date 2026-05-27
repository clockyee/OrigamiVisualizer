import "./styles.css";
import { examples } from "./examples.js";
import { groupedChecks, parseFold } from "./cp.js";
import { solveFold } from "./solver.js";
import { FoldViewer3D } from "./viewer3d.js";
import { extractFacesFromGraph } from "./faceExtraction.js";
import { imageFileToFold } from "./imageCpImport.js";

const workingExamples = structuredClone(examples);

const state = {
  exampleKey: "single",
  progress: 0.55,
  playing: false,
  mode: "viewer",
  tool: "select",
  selectedVertices: [],
  selectedEdge: null,
  draggingVertex: null,
  dragMoved: false,
  highlightRefs: {},
  activeLeftTab: "cp",
  activeRightTab: "inspector",
  lastTime: 0,
};

const elements = {
  cpCanvas: document.getElementById("cpCanvas"),
  range: document.getElementById("foldRange"),
  value: document.getElementById("foldValue"),
  select: document.getElementById("exampleSelect"),
  playButton: document.getElementById("playButton"),
  resetButton: document.getElementById("resetButton"),
  exportButton: document.getElementById("exportButton"),
  exportText: document.getElementById("exportText"),
  assignmentSelect: document.getElementById("assignmentSelect"),
  deleteEdgeButton: document.getElementById("deleteEdgeButton"),
  deleteVertexButton: document.getElementById("deleteVertexButton"),
  toggleLockButton: document.getElementById("toggleLockButton"),
  edgeFoldFactor: document.getElementById("edgeFoldFactor"),
  edgeFoldFactorValue: document.getElementById("edgeFoldFactorValue"),
  imageCpInput: document.getElementById("imageCpInput"),
  foldViewport: document.getElementById("foldViewport"),
  checks: document.getElementById("checks"),
  edgeTable: document.getElementById("edgeTable"),
  graphSummary: document.getElementById("graphSummary"),
};

const cpContext = elements.cpCanvas.getContext("2d");
const viewer = new FoldViewer3D(elements.foldViewport);

let parsed = parseFold(workingExamples[state.exampleKey]);
let solution = solveFold(parsed, state.progress);

function render() {
  parsed = parseFold(workingExamples[state.exampleKey]);
  solution = solveFold(parsed, state.progress);
  elements.value.value = state.progress.toFixed(2);
  elements.range.value = state.progress;
  drawCpCanvas(parsed);
  viewer.renderPattern(parsed, solution);
  renderChecks(parsed);
  renderGraph(parsed);
  renderInspector(parsed, solution);
  updateMode();
}

function applyExampleDefaultProgress() {
  const raw = workingExamples[state.exampleKey];
  const value = raw?.metadata?.default_progress;
  state.progress = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.55;
}

function drawCpCanvas(pattern) {
  const canvas = elements.cpCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  cpContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  cpContext.clearRect(0, 0, width, height);
  cpContext.fillStyle = "#fbfcfe";
  cpContext.fillRect(0, 0, width, height);
  const project = fitPoints(pattern.vertices.map((vertex) => vertex.coord), width, height, 34);

  pattern.faces.forEach((face) => {
    cpContext.beginPath();
    face.vertices.forEach((vertexIndex, idx) => {
      const vertex = pattern.vertices[vertexIndex];
      if (!vertex) return;
      const [x, y] = project(vertex.coord);
      if (idx === 0) cpContext.moveTo(x, y);
      else cpContext.lineTo(x, y);
    });
    cpContext.closePath();
    const highlighted = state.highlightRefs.faces?.includes(face.index);
    cpContext.fillStyle = highlighted ? "rgba(245, 158, 11, 0.28)" : "rgba(232, 237, 247, 0.46)";
    cpContext.fill();
  });

  pattern.edges.forEach((edge) => {
    const a = pattern.vertices[edge.vertices[0]];
    const b = pattern.vertices[edge.vertices[1]];
    if (!a || !b) return;
    const [x1, y1] = project(a.coord);
    const [x2, y2] = project(b.coord);
    cpContext.beginPath();
    cpContext.moveTo(x1, y1);
    cpContext.lineTo(x2, y2);
    cpContext.strokeStyle = assignmentColor(edge.assignment);
    const highlighted = state.highlightRefs.edges?.includes(edge.index) || state.selectedEdge === edge.index;
    cpContext.lineWidth = highlighted ? 5 : edge.assignment === "B" ? 2.3 : 1.8;
    if (edge.assignment === "F" || edge.assignment === "U") cpContext.setLineDash([6, 5]);
    cpContext.stroke();
    cpContext.setLineDash([]);
  });

  pattern.vertices.forEach((vertex) => {
    const [x, y] = project(vertex.coord);
    cpContext.beginPath();
    const highlighted = state.highlightRefs.vertices?.includes(vertex.index) || state.selectedVertices.includes(vertex.index);
    cpContext.arc(x, y, highlighted ? 7 : 3.8, 0, Math.PI * 2);
    cpContext.fillStyle = highlighted ? "#f59e0b" : "#111827";
    cpContext.fill();
    if (pattern.vertices.length < 40 || vertex.index % Math.ceil(pattern.vertices.length / 20) === 0) {
      cpContext.fillStyle = "#667085";
      cpContext.font = "12px system-ui";
      cpContext.fillText(String(vertex.index), x + 7, y - 7);
    }
  });
}

function renderChecks(pattern) {
  const groups = groupedChecks(pattern.checks);
  const actionable = pattern.checks.filter((check) => check.status !== "pass").length;
  document.getElementById("warningCount").textContent = actionable;
  elements.checks.innerHTML = groups.map((group) => `
    <div class="check-group">
      <h3>${group.label}</h3>
      ${group.items.map((check) => `
        <div class="check">
          <div><strong>${check.label}</strong><small>${check.detail}</small></div>
          <span class="badge ${statusClass(check.status)}">${statusLabel(check.status)}</span>
          ${hasRefs(check.refs) ? `<button data-locate-check="${pattern.checks.indexOf(check)}">Locate issue</button>` : ""}
        </div>
      `).join("")}
    </div>
  `).join("");
  elements.checks.querySelectorAll("[data-locate-check]").forEach((button) => {
    button.addEventListener("click", () => {
      const check = pattern.checks[Number(button.dataset.locateCheck)];
      state.highlightRefs = check.refs || {};
      setTab("left", "cp");
      drawCpCanvas(parsed);
    });
  });
}

function renderGraph(pattern) {
  elements.graphSummary.innerHTML = [
    ["Vertices", pattern.vertices.length],
    ["Edges", pattern.edges.length],
    ["Faces", pattern.faces.length],
    ["M/V/B", `${pattern.assignmentCounts.M}/${pattern.assignmentCounts.V}/${pattern.assignmentCounts.B}`],
  ].map(([label, value]) => `<div><strong>${value}</strong>${label}</div>`).join("");

  elements.edgeTable.innerHTML = pattern.edges.map((edge) => `
    <tr data-edge-row="${edge.index}">
      <td>${edge.index}</td>
      <td>${edge.vertices.join(" - ")}</td>
      <td>${edge.assignment}</td>
      <td>${edge.faces.length ? edge.faces.join(", ") : "-"}</td>
    </tr>
  `).join("");
  elements.edgeTable.querySelectorAll("[data-edge-row]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedEdge = Number(row.dataset.edgeRow);
      state.selectedVertices = [];
      setTab("right", "inspector");
      render();
    });
  });
}

function renderInspector(pattern, trace) {
  document.getElementById("patternName").textContent = pattern.title;
  document.getElementById("solverType").textContent = trace.solverType;
  document.getElementById("assignmentSummary").textContent = `M ${pattern.assignmentCounts.M}, V ${pattern.assignmentCounts.V}, B ${pattern.assignmentCounts.B}, U/F ${pattern.assignmentCounts.U + pattern.assignmentCounts.F}`;
  document.getElementById("foldTarget").textContent = `${Math.round(pattern.targetDegrees * state.progress)}deg / ${pattern.targetDegrees}deg`;
  document.getElementById("solverGuarantee").textContent = trace.guarantee;
  renderSolverMetrics(trace);
  renderSelectedEdge(pattern);
  document.getElementById("statVertices").textContent = pattern.vertices.length;
  document.getElementById("statEdges").textContent = pattern.edges.length;
  document.getElementById("statFaces").textContent = pattern.faces.length;
  const hasWarnings = trace.warnings.length || trace.metrics?.trustworthy_preview === false;
  document.getElementById("solverStatus").textContent = hasWarnings ? "Warnings" : "Ready";
  document.querySelector(".dot").style.background = hasWarnings ? "#b7791f" : "#159461";

  const truth = [
    ["CP parsed", pattern.checks.filter((check) => check.group === "parse").every((check) => check.status !== "fail")],
    ["Local flat-foldability checked", true],
    ["Global folded state existence", false],
    ["Collision-free path existence", false],
    ["Current 3D result from solver", trace.solverType !== "blocked-invalid-cp"],
  ];
  document.getElementById("truthList").innerHTML = truth.map(([label, ok]) => `<div>${label}: <strong>${ok ? "yes" : "not solved"}</strong></div>`).join("");
}

function renderSolverMetrics(trace) {
  const metrics = trace.metrics || {};
  document.getElementById("metricEdgeStrain").textContent = formatPercent(metrics.max_edge_strain);
  document.getElementById("metricAreaError").textContent = formatPercent(metrics.max_face_area_error);
  document.getElementById("metricIntersections").textContent = String(metrics.intersection_count ?? 0);
  document.getElementById("metricLayerWarning").textContent = metrics.layer_warning || "-";
}

function renderSelectedEdge(pattern) {
  const edge = state.selectedEdge === null ? null : pattern.edges[state.selectedEdge];
  document.getElementById("selectedEdgeInfo").textContent = edge ? `e${edge.index} (${edge.assignment})` : "-";
  document.getElementById("selectedVertexInfo").textContent = edge ? edge.vertices.map((vertex) => `v${vertex}`).join(" - ") : state.selectedVertices.map((vertex) => `v${vertex}`).join(", ") || "-";
  document.getElementById("selectedFaceInfo").textContent = edge?.faces?.length ? edge.faces.map((face) => `f${face}`).join(", ") : "-";
  document.getElementById("selectedLockInfo").textContent = edge ? (isEdgeLocked(pattern, edge.index) ? "locked" : "unlocked") : "-";
  document.querySelectorAll("[data-assignment]").forEach((button) => {
    button.classList.toggle("active", Boolean(edge && button.dataset.assignment === edge.assignment));
  });
  if (edge) elements.assignmentSelect.value = edge.assignment;
  const factor = edge ? selectedEdgeFoldFactor(pattern, edge.index) : 1;
  elements.edgeFoldFactor.value = factor;
  elements.edgeFoldFactor.disabled = !edge;
  elements.edgeFoldFactorValue.textContent = factor.toFixed(2);
}

function exportDatasetSample() {
  elements.exportText.value = JSON.stringify({
    id: state.exampleKey,
    title: parsed.title,
    graph: {
      vertices_coords: parsed.vertices.map((vertex) => vertex.coord),
      edges_vertices: parsed.edges.map((edge) => edge.vertices),
      edges_assignment: parsed.edges.map((edge) => edge.assignment),
      faces_vertices: parsed.faces.map((face) => face.vertices),
      assignment_counts: parsed.assignmentCounts,
    },
    checks: parsed.checks,
    solver_trace: {
      solver_type: solution.solverType,
      guarantee: solution.guarantee,
      progress: solution.progress,
      target_degrees: parsed.targetDegrees,
      fold_angles: solution.foldAngles,
      steps: solution.steps,
      face_adjacency: solution.faceAdjacency,
      moved_faces_by_step: solution.movedFacesByStep,
      vertices_3d: solution.vertices3,
      vertices_3d_by_step: solution.vertices3ByStep,
      residual: solution.residual,
      max_edge_strain: solution.metrics?.max_edge_strain ?? null,
      mean_edge_strain: solution.metrics?.mean_edge_strain ?? null,
      max_face_area_error: solution.metrics?.max_face_area_error ?? null,
      mean_face_area_error: solution.metrics?.mean_face_area_error ?? null,
      intersection_count: solution.metrics?.intersection_count ?? null,
      intersections: solution.metrics?.intersections ?? [],
      layer_warning: solution.metrics?.layer_warning ?? null,
      trustworthy_preview: solution.metrics?.trustworthy_preview ?? false,
      edge_fold_factors: parsed.metadata?.edge_fold_factors || {},
      warnings: solution.warnings,
      blocked_reason: solution.blockedReason,
    },
  }, null, 2);
}

function addVertexFromCanvas(event) {
  const raw = workingExamples[state.exampleKey];
  const snap = nearestEdgePoint(event, parsed);
  const point = snap && snap.distance < 10 ? snap.cpPoint : canvasToCpPoint(event, parsed);
  raw.vertices_coords.push(point);
  state.selectedVertices = [raw.vertices_coords.length - 1];
  regenerateFacesForEditable(raw);
}

function splitEdgeFromCanvas(event) {
  const snap = nearestEdgePoint(event, parsed);
  if (!snap) return;
  splitEdgeAtPoint(snap.edge, snap.cpPoint);
}

function selectFromCanvas(event) {
  const hit = hitTestCp(event, parsed);
  if (hit.vertex !== null) {
    if (state.tool === "add-edge") {
      state.selectedVertices = [...state.selectedVertices.filter((index) => index !== hit.vertex), hit.vertex].slice(-2);
      if (state.selectedVertices.length === 2) {
        addEdge(state.selectedVertices[0], state.selectedVertices[1], elements.assignmentSelect.value);
        state.selectedVertices = [hit.vertex];
      }
    } else {
      state.selectedVertices = [hit.vertex];
      state.selectedEdge = null;
    }
  } else if (hit.edge !== null) {
    state.selectedEdge = hit.edge;
    state.selectedVertices = [];
  } else {
    state.selectedVertices = [];
    state.selectedEdge = null;
  }
  state.highlightRefs = {};
}

function addEdge(a, b, assignment) {
  if (a === b) return;
  const raw = workingExamples[state.exampleKey];
  const exists = raw.edges_vertices.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (!exists) {
    raw.edges_vertices.push([a, b]);
    raw.edges_assignment.push(assignment);
    state.selectedEdge = raw.edges_vertices.length - 1;
    regenerateFacesForEditable(raw);
  }
}

function deleteSelectedEdge() {
  if (state.selectedEdge === null) return;
  const raw = workingExamples[state.exampleKey];
  raw.edges_vertices.splice(state.selectedEdge, 1);
  raw.edges_assignment.splice(state.selectedEdge, 1);
  state.selectedEdge = null;
  regenerateFacesForEditable(raw);
  render();
}

function toggleSelectedEdgeLock() {
  if (state.selectedEdge === null) return;
  const raw = workingExamples[state.exampleKey];
  raw.metadata ||= {};
  raw.metadata.locked_edges ||= [];
  const set = new Set(raw.metadata.locked_edges);
  if (set.has(state.selectedEdge)) set.delete(state.selectedEdge);
  else set.add(state.selectedEdge);
  raw.metadata.locked_edges = Array.from(set).sort((a, b) => a - b);
  render();
}

function deleteSelectedVertex() {
  if (!state.selectedVertices.length) return;
  const vertex = state.selectedVertices[0];
  const raw = workingExamples[state.exampleKey];
  raw.vertices_coords.splice(vertex, 1);
  const nextEdges = [];
  const nextAssignments = [];
  raw.edges_vertices.forEach((edge, index) => {
    if (edge.includes(vertex)) return;
    nextEdges.push(edge.map((item) => item > vertex ? item - 1 : item));
    nextAssignments.push(raw.edges_assignment[index]);
  });
  raw.edges_vertices = nextEdges;
  raw.edges_assignment = nextAssignments;
  state.selectedVertices = [];
  state.selectedEdge = null;
  regenerateFacesForEditable(raw);
  render();
}

function splitEdgeAtPoint(edgeIndex, point) {
  const raw = workingExamples[state.exampleKey];
  const edge = raw.edges_vertices[edgeIndex];
  if (!edge) return;
  const assignment = raw.edges_assignment[edgeIndex];
  const vertexIndex = raw.vertices_coords.length;
  raw.vertices_coords.push(point);
  raw.edges_vertices.splice(edgeIndex, 1, [edge[0], vertexIndex], [vertexIndex, edge[1]]);
  raw.edges_assignment.splice(edgeIndex, 1, assignment, assignment);
  state.selectedVertices = [vertexIndex];
  state.selectedEdge = null;
  regenerateFacesForEditable(raw);
}

function regenerateFacesForEditable(raw) {
  if (raw.solver_hint === "analytic-miura" || raw.solver_hint === "miura-analytic-preview") return;
  raw.faces_vertices = extractFacesFromGraph(raw.vertices_coords, raw.edges_vertices);
}

function setSelectedEdgeAssignment(assignment) {
  if (state.selectedEdge === null) return;
  const raw = workingExamples[state.exampleKey];
  raw.edges_assignment[state.selectedEdge] = assignment;
  elements.assignmentSelect.value = assignment;
  render();
}

function setSelectedEdgeFoldFactor(value) {
  if (state.selectedEdge === null) return;
  const raw = workingExamples[state.exampleKey];
  raw.metadata ||= {};
  raw.metadata.edge_fold_factors ||= {};
  raw.metadata.edge_fold_factors[state.selectedEdge] = Number(value.toFixed(3));
  render();
}

function selectedEdgeFoldFactor(pattern, edgeIndex) {
  const value = pattern.metadata?.edge_fold_factors?.[edgeIndex];
  return Number.isFinite(value) ? value : 1;
}

function hitTestCp(event, pattern) {
  const canvas = elements.cpCanvas;
  const rect = canvas.getBoundingClientRect();
  const point = [event.clientX - rect.left, event.clientY - rect.top];
  const project = fitPoints(pattern.vertices.map((vertex) => vertex.coord), rect.width, rect.height, 34);
  let vertexHit = null;
  let bestVertexDistance = 10;
  pattern.vertices.forEach((vertex) => {
    const projected = project(vertex.coord);
    const distance = Math.hypot(projected[0] - point[0], projected[1] - point[1]);
    if (distance < bestVertexDistance) {
      bestVertexDistance = distance;
      vertexHit = vertex.index;
    }
  });
  if (vertexHit !== null) return { vertex: vertexHit, edge: null };

  let edgeHit = null;
  let bestEdgeDistance = 8;
  pattern.edges.forEach((edge) => {
    const a = pattern.vertices[edge.vertices[0]];
    const b = pattern.vertices[edge.vertices[1]];
    if (!a || !b) return;
    const distance = pointToSegmentDistance(point, project(a.coord), project(b.coord));
    if (distance < bestEdgeDistance) {
      bestEdgeDistance = distance;
      edgeHit = edge.index;
    }
  });
  return { vertex: null, edge: edgeHit };
}

function canvasToCpPoint(event, pattern) {
  const canvas = elements.cpCanvas;
  const rect = canvas.getBoundingClientRect();
  const points = pattern.vertices.map((vertex) => vertex.coord);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 34;
  const scale = Math.min((rect.width - padding * 2) / (maxX - minX || 1), (rect.height - padding * 2) / (maxY - minY || 1));
  const offsetX = padding + (rect.width - padding * 2 - (maxX - minX) * scale) / 2;
  const offsetY = padding + (rect.height - padding * 2 - (maxY - minY) * scale) / 2;
  const x = minX + (event.clientX - rect.left - offsetX) / scale;
  const y = maxY - (event.clientY - rect.top - offsetY) / scale;
  return [Number(x.toFixed(4)), Number(y.toFixed(4))];
}

function constrainedVertexPoint(vertexIndex, point, pattern) {
  const lockedIncident = pattern.edges.filter((edge) => edge.vertices.includes(vertexIndex) && isEdgeLocked(pattern, edge.index));
  if (!lockedIncident.length) return point;
  const neighborIndices = lockedIncident.map((edge) => edge.vertices[0] === vertexIndex ? edge.vertices[1] : edge.vertices[0]);
  const neighbors = neighborIndices.map((index) => pattern.vertices[index]?.coord).filter(Boolean);
  if (!neighbors.length) return point;
  if (neighbors.length >= 2) return projectPointToLine(point, neighbors[0], neighbors[1]);
  return projectPointToLine(point, pattern.vertices[vertexIndex].coord, neighbors[0]);
}

function isEdgeLocked(pattern, edgeIndex) {
  const edge = pattern.edges[edgeIndex];
  const explicit = pattern.metadata?.locked_edges || [];
  return explicit.includes(edgeIndex) || edge?.assignment === "B";
}

function nearestEdgePoint(event, pattern) {
  const canvas = elements.cpCanvas;
  const rect = canvas.getBoundingClientRect();
  const screenPoint = [event.clientX - rect.left, event.clientY - rect.top];
  const project = fitPoints(pattern.vertices.map((vertex) => vertex.coord), rect.width, rect.height, 34);
  let best = null;
  pattern.edges.forEach((edge) => {
    const a = pattern.vertices[edge.vertices[0]];
    const b = pattern.vertices[edge.vertices[1]];
    if (!a || !b) return;
    const screenA = project(a.coord);
    const screenB = project(b.coord);
    const projection = projectPointToSegment(screenPoint, screenA, screenB);
    const distance = Math.hypot(screenPoint[0] - projection.point[0], screenPoint[1] - projection.point[1]);
    if (!best || distance < best.distance) {
      const cpPoint = [
        Number((a.coord[0] + (b.coord[0] - a.coord[0]) * projection.t).toFixed(4)),
        Number((a.coord[1] + (b.coord[1] - a.coord[1]) * projection.t).toFixed(4)),
      ];
      best = { edge: edge.index, distance, cpPoint };
    }
  });
  return best;
}

function setTab(side, name) {
  state[side === "left" ? "activeLeftTab" : "activeRightTab"] = name;
  document.querySelectorAll(`[data-${side}-tab]`).forEach((button) => button.classList.toggle("active", button.dataset[`${side}Tab`] === name));
  document.querySelectorAll(`[data-${side}-page]`).forEach((page) => page.classList.toggle("active", page.dataset[`${side}Page`] === name));
}

function fitPoints(points, width, height, padding) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min((width - padding * 2) / (maxX - minX || 1), (height - padding * 2) / (maxY - minY || 1));
  return (point) => [
    padding + (point[0] - minX) * scale + (width - padding * 2 - (maxX - minX) * scale) / 2,
    padding + (maxY - point[1]) * scale + (height - padding * 2 - (maxY - minY) * scale) / 2,
  ];
}

function assignmentColor(assignment) {
  return { M: "#dc3a38", V: "#1d5fd7", B: "#111827", F: "#98a2b3", U: "#98a2b3" }[assignment] || "#98a2b3";
}

function hasRefs(refs = {}) {
  return ["vertices", "edges", "faces"].some((key) => Array.isArray(refs[key]) && refs[key].length > 0);
}

function pointToSegmentDistance(point, a, b) {
  return Math.hypot(point[0] - projectPointToSegment(point, a, b).point[0], point[1] - projectPointToSegment(point, a, b).point[1]);
}

function projectPointToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));
  return { point: [a[0] + t * dx, a[1] + t * dy], t };
}

function projectPointToLine(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2;
  return [Number((a[0] + t * dx).toFixed(4)), Number((a[1] + t * dy).toFixed(4))];
}

function statusClass(status) {
  return status === "pass" ? "pass" : status === "warn" ? "warn" : status === "fail" ? "fail" : "unknown";
}

function updateMode() {
  document.querySelector(".app-shell").classList.toggle("editor-mode", state.mode === "editor");
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
}

function statusLabel(status) {
  return status === "pass" ? "Pass" : status === "warn" ? "Warn" : status === "fail" ? "Fail" : "Not solved yet";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 0.0001) return "<0.01%";
  return `${(value * 100).toFixed(2)}%`;
}

function tick(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = timestamp - state.lastTime;
  state.lastTime = timestamp;
  if (state.playing) {
    state.progress += delta / 4200;
    if (state.progress > 1) state.progress = 0;
    render();
  }
  requestAnimationFrame(tick);
}

elements.range.addEventListener("input", (event) => {
  state.progress = Number(event.target.value);
  render();
});

elements.select.addEventListener("change", (event) => {
  state.exampleKey = event.target.value;
  applyExampleDefaultProgress();
  state.selectedVertices = [];
  state.selectedEdge = null;
  state.highlightRefs = {};
  elements.exportText.value = "";
  render();
});

elements.playButton.addEventListener("click", () => {
  state.playing = !state.playing;
  elements.playButton.textContent = state.playing ? "Pause" : "Play";
});

elements.resetButton.addEventListener("click", () => {
  state.progress = 0;
  state.playing = false;
  elements.playButton.textContent = "Play";
  render();
});

elements.exportButton.addEventListener("click", exportDatasetSample);
elements.deleteEdgeButton.addEventListener("click", deleteSelectedEdge);
elements.deleteVertexButton.addEventListener("click", deleteSelectedVertex);
elements.toggleLockButton.addEventListener("click", toggleSelectedEdgeLock);
elements.assignmentSelect.addEventListener("change", (event) => {
  if (state.selectedEdge !== null) setSelectedEdgeAssignment(event.target.value);
});
elements.edgeFoldFactor.addEventListener("input", (event) => {
  setSelectedEdgeFoldFactor(Number(event.target.value));
});
elements.cpCanvas.addEventListener("click", (event) => {
  if (state.dragMoved) {
    state.dragMoved = false;
    return;
  }
  if (state.mode !== "editor") {
    selectFromCanvas(event);
    render();
    return;
  }
  if (state.tool === "add-vertex") addVertexFromCanvas(event);
  else if (state.tool === "split-edge") splitEdgeFromCanvas(event);
  else selectFromCanvas(event);
  render();
});
elements.cpCanvas.addEventListener("pointerdown", (event) => {
  if (state.mode !== "editor" || state.tool !== "select") return;
  const hit = hitTestCp(event, parsed);
  if (hit.vertex !== null) {
    state.draggingVertex = hit.vertex;
    state.selectedVertices = [hit.vertex];
    elements.cpCanvas.setPointerCapture(event.pointerId);
  }
});
elements.cpCanvas.addEventListener("pointermove", (event) => {
  if (state.draggingVertex === null) return;
  const raw = workingExamples[state.exampleKey];
  const point = canvasToCpPoint(event, parsed);
  raw.vertices_coords[state.draggingVertex] = constrainedVertexPoint(state.draggingVertex, point, parsed);
  regenerateFacesForEditable(raw);
  state.dragMoved = true;
  render();
});
elements.cpCanvas.addEventListener("pointerup", (event) => {
  if (state.draggingVertex !== null) {
    elements.cpCanvas.releasePointerCapture(event.pointerId);
    state.draggingVertex = null;
  }
});

document.querySelectorAll("[data-left-tab]").forEach((button) => button.addEventListener("click", () => setTab("left", button.dataset.leftTab)));
document.querySelectorAll("[data-right-tab]").forEach((button) => button.addEventListener("click", () => setTab("right", button.dataset.rightTab)));
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  setTab("left", "cp");
  if (state.mode === "editor") state.tool = "select";
  document.querySelectorAll("[data-editor-tool]").forEach((toolButton) => toolButton.classList.toggle("active", toolButton.dataset.editorTool === state.tool));
  updateMode();
}));
document.querySelectorAll("[data-editor-tool]").forEach((button) => button.addEventListener("click", () => {
  state.tool = button.dataset.editorTool;
  document.querySelectorAll("[data-editor-tool]").forEach((toolButton) => toolButton.classList.toggle("active", toolButton.dataset.editorTool === state.tool));
}));
document.querySelectorAll("[data-assignment]").forEach((button) => button.addEventListener("click", () => setSelectedEdgeAssignment(button.dataset.assignment)));
document.addEventListener("keydown", (event) => {
  const key = event.key.toUpperCase();
  if (["M", "V", "B", "F", "U"].includes(key) && state.mode === "editor") {
    setSelectedEdgeAssignment(key);
  }
  if ((event.key === "Backspace" || event.key === "Delete") && state.mode === "editor") {
    if (state.selectedEdge !== null) deleteSelectedEdge();
    else deleteSelectedVertex();
  }
});
document.querySelector('[data-tool="reset-view"]').addEventListener("click", () => viewer.resetView());
document.querySelector('[data-tool="export"]').addEventListener("click", () => {
  setTab("right", "dataset");
  exportDatasetSample();
});
elements.imageCpInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const imported = await imageFileToFold(file);
  workingExamples.imageImport = imported;
  if (!elements.select.querySelector('option[value="imageImport"]')) {
    const option = document.createElement("option");
    option.value = "imageImport";
    option.textContent = "Image CP import draft";
    elements.select.appendChild(option);
  }
  state.exampleKey = "imageImport";
  elements.select.value = "imageImport";
  state.mode = "editor";
  state.selectedVertices = [];
  state.selectedEdge = null;
  state.highlightRefs = {};
  setTab("left", "cp");
  render();
});

new ResizeObserver(() => drawCpCanvas(parsed)).observe(elements.cpCanvas);

applyExampleDefaultProgress();
render();
requestAnimationFrame(tick);
