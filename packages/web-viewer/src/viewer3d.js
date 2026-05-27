import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const colors = {
  M: 0xdc3a38,
  V: 0x1d5fd7,
  B: 0x111827,
  F: 0x98a2b3,
  U: 0x98a2b3,
};

export class FoldViewer3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfbfcff);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
    this.camera.position.set(2.8, -4.8, 3.1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.sortObjects = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb5c0cf, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, -3, 4);
    this.scene.add(key);

    const grid = new THREE.GridHelper(8, 24, 0xd8dee8, 0xe8edf5);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.04;
    this.scene.add(grid);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this.animate();
  }

  renderPattern(pattern, solution) {
    this.group.clear();
    const vertices = solution.vertices3.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const renderVertices = this.addFaces(pattern, vertices, solution);
    if (solution.faceVertices3) this.addPanelEdges(pattern, solution.faceVertices3);
    else this.addEdges(pattern, vertices);
    this.addVertices(vertices);
    this.fitCamera(renderVertices.length ? renderVertices : vertices);
  }

  resetView() {
    this.camera.position.set(2.8, -4.8, 3.1);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  addFaces(pattern, vertices, solution) {
    const intersections = solution.metrics?.intersections || [];
    const intersectingFaces = new Set(intersections.flatMap((item) => item.faces || []));
    const renderVertices = [];
    pattern.faces.forEach((face) => {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const [first, ...rest] = face.vertices;
      const facePoints = solution.faceVertices3?.[face.index]?.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const vertexFor = (vertexIndex) => facePoints ? facePoints[face.vertices.indexOf(vertexIndex)] : vertices[vertexIndex];
      for (let i = 0; i < rest.length - 1; i += 1) {
        [first, rest[i], rest[i + 1]].forEach((vertexIndex) => {
          const vertex = vertexFor(vertexIndex);
          if (vertex) {
            positions.push(vertex.x, vertex.y, vertex.z);
            renderVertices.push(vertex);
          }
        });
      }
      if (!positions.length) return;
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const highlighted = intersectingFaces.has(face.index);
      const front = new THREE.MeshStandardMaterial({
        color: highlighted ? 0xffd166 : 0xf8fafc,
        roughness: 0.62,
        metalness: 0,
        transparent: false,
        opacity: 1,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const back = new THREE.MeshStandardMaterial({
        color: highlighted ? 0xf97316 : 0xa7f3d0,
        roughness: 0.68,
        metalness: 0,
        transparent: false,
        opacity: 1,
        side: THREE.BackSide,
        depthTest: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      });
      this.group.add(new THREE.Mesh(geometry, front));
      this.group.add(new THREE.Mesh(geometry.clone(), back));
    });
    return renderVertices;
  }

  addPanelEdges(pattern, faceVertices3) {
    pattern.faces.forEach((face) => {
      const points = faceVertices3[face.index]?.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      if (!points) return;
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const edge = pattern.edges.find((item) => {
          const va = face.vertices[i];
          const vb = face.vertices[(i + 1) % face.vertices.length];
          return (item.vertices[0] === va && item.vertices[1] === vb) || (item.vertices[0] === vb && item.vertices[1] === va);
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
        const material = new THREE.LineBasicMaterial({
          color: colors[edge?.assignment] || colors.U,
          linewidth: edge?.assignment === "B" ? 2 : 1,
          depthTest: true,
        });
        this.group.add(new THREE.Line(geometry, material));
      }
    });
  }

  addEdges(pattern, vertices) {
    pattern.edges.forEach((edge) => {
      const a = vertices[edge.vertices[0]];
      const b = vertices[edge.vertices[1]];
      if (!a || !b) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
      const material = new THREE.LineBasicMaterial({
        color: colors[edge.assignment] || colors.U,
        linewidth: edge.assignment === "B" ? 2 : 1,
        depthTest: true,
      });
      this.group.add(new THREE.Line(geometry, material));
    });
  }

  addVertices(vertices) {
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const material = new THREE.PointsMaterial({ color: 0x0f172a, size: 0.035, sizeAttenuation: true });
    this.group.add(new THREE.Points(geometry, material));
  }

  fitCamera(vertices) {
    if (!vertices.length) return;
    const box = new THREE.Box3().setFromPoints(vertices);
    const center = box.getCenter(new THREE.Vector3());
    this.controls.target.copy(center);
    this.controls.update();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}
