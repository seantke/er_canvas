// src/force-layout.ts
var MIN_DISTANCE = 0.1;
var MAX_VELOCITY = 8;
var DAMPING = 0.9;
var PADDING = 100;
var CELL_SIZE = 2000;
var GRAVITY_STRENGTH = 0.1;
var NATURAL_LENGTH = 80;
var BASE_REPULSIVE_STRENGTH = 80;
var clamp = (value, min, max) => Number.isNaN(value) ? (min + max) / 2 : Math.min(Math.max(value, min), max);

class ForceAccumulator {
  fx = 0.01;
  fy = 0.01;
}
function createConnections(objects, graphEdges) {
  const connectedNodes = {};
  for (const obj of objects) {
    connectedNodes[obj.id] = new Set;
  }
  for (const [id1, id2] of graphEdges) {
    if (connectedNodes[id1]) {
      connectedNodes[id1].add(id2);
    }
    if (connectedNodes[id2]) {
      connectedNodes[id2].add(id1);
    }
  }
  return connectedNodes;
}
var computeDistance = (x1, y1, x2, y2) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dist = Math.max(MIN_DISTANCE, Math.sqrt(dx * dx + dy * dy));
  return { dx, dy, dist };
};
var initializeForceAccumulators = (objects) => objects.reduce((acc, obj) => {
  acc[obj.id] = new ForceAccumulator;
  return acc;
}, {});

class SpatialGrid {
  cellSize;
  grid;
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map;
  }
  getCellKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }
  insert(obj) {
    const minX = obj.x - obj.width / 2;
    const maxX = obj.x + obj.width / 2;
    const minY = obj.y - obj.height / 2;
    const maxY = obj.y + obj.height / 2;
    for (let x = minX;x <= maxX; x += this.cellSize) {
      for (let y = minY;y <= maxY; y += this.cellSize) {
        const key = this.getCellKey(x, y);
        if (!this.grid.has(key)) {
          this.grid.set(key, new Set);
        }
        this.grid.get(key)?.add(obj);
      }
    }
  }
  getNeighbors(obj) {
    const neighbors = new Set;
    const minX = obj.x - obj.width / 2;
    const maxX = obj.x + obj.width / 2;
    const minY = obj.y - obj.height / 2;
    const maxY = obj.y + obj.height / 2;
    for (let x = minX;x <= maxX; x += this.cellSize) {
      for (let y = minY;y <= maxY; y += this.cellSize) {
        const key = this.getCellKey(x, y);
        if (this.grid.has(key)) {
          for (const neighbor of this.grid.get(key)?.values() ?? []) {
            if (neighbor !== obj) {
              neighbors.add(neighbor);
            }
          }
        }
      }
    }
    return neighbors;
  }
}
var calculateAttractiveForce = (dist) => {
  const displacement = dist - NATURAL_LENGTH;
  const springConstant = 0.2;
  return springConstant * displacement;
};
var calculateRepulsiveForce = (dist, areConnected) => {
  const effectiveStrength = BASE_REPULSIVE_STRENGTH * (0.5 * (areConnected ? 1 : 4));
  const distScale = clamp(dist / 200, 0.1, 1);
  const softening = 20;
  const baseForce = effectiveStrength / (dist + softening ** 1.5);
  return baseForce * (1 - distScale * 0.5);
};
var applyRepulsiveForces = (objects, connectedNodes, grid, forceAccumulators) => {
  for (const obj1 of objects) {
    const neighbors = grid.getNeighbors(obj1);
    for (const obj2 of neighbors) {
      if (obj1.id < obj2.id) {
        const { dx, dy, dist } = computeDistance(obj1.x, obj1.y, obj2.x, obj2.y);
        const areConnected = connectedNodes[obj1.id]?.has(obj2.id) ?? false;
        let repulsiveForce = calculateRepulsiveForce(dist, areConnected);
        const minDistancePadding = 10;
        const minDistanceX = obj1.width / 2 + obj2.width / 2 + minDistancePadding;
        const minDistanceY = obj1.height / 2 + obj2.height / 2 + minDistancePadding;
        const minDistance = Math.max(minDistanceX, minDistanceY);
        if (dist < minDistance) {
          repulsiveForce *= 2;
        }
        const fx = repulsiveForce * dx / dist;
        const fy = repulsiveForce * dy / dist;
        forceAccumulators[obj1.id].fx += fx;
        forceAccumulators[obj1.id].fy += fy;
        forceAccumulators[obj2.id].fx -= fx;
        forceAccumulators[obj2.id].fy -= fy;
      }
    }
  }
};
var applyAttractiveForces = (objects, connectedNodes, forceAccumulators) => {
  for (const [node, neighbors] of Object.entries(connectedNodes)) {
    for (const neighbor of neighbors) {
      const obj1 = objects.find((o) => o.id === node);
      const obj2 = objects.find((o) => o.id === neighbor);
      if (obj1 && obj2) {
        const { dx, dy, dist } = computeDistance(obj1.x, obj1.y, obj2.x, obj2.y);
        const attractiveForce = calculateAttractiveForce(dist);
        const fx = attractiveForce * dx / dist;
        const fy = attractiveForce * dy / dist;
        forceAccumulators[obj1.id].fx -= fx;
        forceAccumulators[obj1.id].fy -= fy;
        forceAccumulators[obj2.id].fx += fx;
        forceAccumulators[obj2.id].fy += fy;
      }
    }
  }
};
var applyGravity = (objects, centerX, centerY, canvasWidth, canvasHeight, forceAccumulators) => {
  for (const obj of objects) {
    const dx = obj.x - centerX;
    const dy = obj.y - centerY;
    const dist = clamp(Math.sqrt(dx * dx + dy * dy), MIN_DISTANCE, 1000);
    const localGravity = GRAVITY_STRENGTH * (1 - clamp(dist / (Math.max(canvasWidth, canvasHeight) * 0.8), 0.1, 1));
    const gravityFx = -localGravity * dx;
    const gravityFy = -localGravity * dy;
    forceAccumulators[obj.id].fx += gravityFx;
    forceAccumulators[obj.id].fy += gravityFy;
  }
};
var updatePositions = (objects, forceAccumulators, canvasWidth, canvasHeight) => {
  for (const obj of objects) {
    const weight = Math.max(0.1, obj.weight);
    const accelX = forceAccumulators[obj.id].fx / weight;
    const accelY = forceAccumulators[obj.id].fy / weight;
    obj.vx = clamp((obj.vx + accelX) * DAMPING, -MAX_VELOCITY, MAX_VELOCITY);
    obj.vy = clamp((obj.vy + accelY) * DAMPING, -MAX_VELOCITY, MAX_VELOCITY);
    obj.x += obj.vx;
    obj.y += obj.vy;
    obj.x = clamp(obj.x, PADDING + obj.width / 2, canvasWidth - PADDING - obj.width / 2);
    obj.y = clamp(obj.y, PADDING + obj.height / 2, canvasHeight - PADDING - obj.height / 2);
  }
};
var removeNetMomentum = (objects) => {
  const { sumVx, sumVy } = objects.reduce((acc, obj) => {
    acc.sumVx += obj.vx;
    acc.sumVy += obj.vy;
    return acc;
  }, { sumVx: 0, sumVy: 0 });
  const avgVx = sumVx / objects.length;
  const avgVy = sumVy / objects.length;
  for (const obj of objects) {
    obj.vx -= avgVx;
    obj.vy -= avgVy;
  }
};
function fruchtermanReingoldStep(objects, connectedNodes, canvasWidth, canvasHeight) {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const forceAccumulators = initializeForceAccumulators(objects);
  const grid = new SpatialGrid(CELL_SIZE);
  for (const obj of objects)
    grid.insert(obj);
  applyRepulsiveForces(objects, connectedNodes, grid, forceAccumulators);
  applyAttractiveForces(objects, connectedNodes, forceAccumulators);
  applyGravity(objects, centerX, centerY, canvasWidth, canvasHeight, forceAccumulators);
  updatePositions(objects, forceAccumulators, canvasWidth, canvasHeight);
  removeNetMomentum(objects);
  console.log(forceAccumulators[objects[0].id], objects[0]);
  return objects;
}

// src/drawing.ts
var canvas = document.querySelector("#simulationCanvas");
var ctx = canvas?.getContext("2d");
function resizeCanvas(cw = 1400, ch = 900) {
  if (!ctx || !canvas)
    throw new Error("Canvas context not found");
  canvas.width = cw;
  canvas.height = ch;
}
function drawFrame(objects, graph_edges) {
  if (!ctx || !canvas)
    throw new Error("Canvas context not found");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  for (const edge of graph_edges) {
    const obj1 = objects.find((obj) => obj.id === edge[0]);
    const obj2 = objects.find((obj) => obj.id === edge[1]);
    if (obj1 && obj2) {
      ctx.beginPath();
      ctx.moveTo(obj1.x, obj1.y);
      ctx.lineTo(obj2.x, obj2.y);
      ctx.stroke();
    }
  }
  for (const obj of objects) {
    ctx.beginPath();
    ctx.rect(obj.x - obj.width / 2, obj.y - obj.height / 2, obj.width, obj.height);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// src/websocket-client.ts
var websocket = new WebSocket("ws://localhost:8000/ws");
websocket.onopen = (event) => {
  console.log("WebSocket connection opened");
};
websocket.onerror = (event) => {
  console.error("WebSocket error:", event);
};
websocket.onclose = (event) => {
  console.log("WebSocket connection closed");
};

// src/property-initialization.ts
function calculateObjectProperties(num_connections) {
  const minSize = 10;
  const maxSize = 20;
  const sizeRange = maxSize - minSize;
  const connectionRatio = Math.min(1, num_connections / 5);
  const size = minSize + sizeRange * connectionRatio;
  const hue = 300 - Math.max(10, Math.min(connectionRatio * 290, 290));
  const saturation = 70;
  const lightness = 50;
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  return { width: size, height: size, color };
}
function initializeGraphProperties(objects, connectedNodes) {
  return objects.map((obj) => {
    const props = calculateObjectProperties(connectedNodes[obj.id].size);
    return {
      ...obj,
      width: props.width,
      height: props.height,
      color: props.color,
      weight: 10
    };
  });
}

// src/index.ts
function simulateAndDraw(initialObjects, graph_edges, connectedNodes, canvasWidth, canvasHeight) {
  let objects = initialObjects;
  function drawLoop() {
    objects = fruchtermanReingoldStep(objects, connectedNodes, canvasWidth, canvasHeight);
    drawFrame(objects, graph_edges);
    requestAnimationFrame(drawLoop);
  }
  requestAnimationFrame(drawLoop);
}
websocket.onmessage = (event) => {
  const initialData = JSON.parse(event.data);
  console.log("Initial data received:", initialData);
  let objects = initialData.objects;
  const graph_edges = initialData.edges;
  const canvasWidth = initialData.width;
  const canvasHeight = initialData.height;
  resizeCanvas(canvasWidth, canvasHeight);
  const connectedNodes = createConnections(objects, graph_edges);
  objects = initializeGraphProperties(objects, connectedNodes);
  simulateAndDraw(objects, graph_edges, connectedNodes, canvasWidth, canvasHeight);
};
