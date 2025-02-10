// src/types.ts
class ForceAccumulator {
  fx = 0.01;
  fy = 0.01;
}
function getConnectedNodes(nodeId, graph_edges) {
  const connected = new Set;
  for (const edge of graph_edges) {
    if (edge.includes(nodeId)) {
      for (const node of edge)
        connected.add(node);
    }
  }
  connected.delete(nodeId);
  return connected;
}
function ConnectedNodes(objects, graph_edges) {
  const connections = {};
  for (const obj of objects) {
    connections[obj.id] = getConnectedNodes(obj.id, graph_edges);
  }
  return connections;
}

// src/force-layout.ts
var DEFAULT_PARAMETERS = {
  minDistance: 80,
  maxVelocity: 1,
  damping: 0.9,
  padding: 5,
  recenterThreshold: 10,
  recenterFactor: 1,
  gravityStrength: 0.01,
  naturalLength: 1,
  baseRepulsiveStrength: 1
};
var clamp = (value, min, max) => Number.isNaN(value) ? (min + max) / 2 : Math.min(Math.max(value, min), max);
var computeDistance = (x1, y1, x2, y2) => {
  const x = x1 - x2;
  const y = y1 - y2;
  const dist = Math.max(0.1, Math.sqrt(x ** 2 + y ** 2));
  return { x, y, dist };
};
var calculateAttractiveForce = (dist, params) => {
  const displacement = dist - params.naturalLength;
  const springConstant = 0.3;
  return springConstant * displacement;
};
var calculateRepulsiveForce = (dist, areConnected, params) => {
  const effectiveStrength = params.baseRepulsiveStrength * (0.5 * (areConnected ? 2 : 0.2));
  const distScale = clamp(dist / 200, 0.1, 1);
  const softening = 50;
  const baseForce = effectiveStrength / (dist + softening ** 1.5);
  return baseForce * (1 - distScale * 0.5);
};
var resolveOverlap = (nodeA, nodeB, d, minDistance) => {
  const variability = 2000;
  if (d.dist < minDistance * 0.1) {
    nodeA.x += Math.random() * variability - variability / 2;
    nodeA.y += Math.random() * variability - variability / 2;
    nodeB.x += Math.random() * variability - variability / 2;
    nodeB.y += Math.random() * variability - variability / 2;
  } else if (d.dist < minDistance * 1.1) {
    const overlap = minDistance - d.dist;
    const pushX = d.x / d.dist * (overlap / 2);
    const pushY = d.y / d.dist * (overlap / 2);
    nodeA.x += pushX;
    nodeA.y += pushY;
    nodeB.x -= pushX;
    nodeB.y -= pushY;
  }
};
var applyForces = (objects, connectedNodes, forceAccumulators, params) => {
  for (let i = 0;i < objects.length; i++) {
    const obj1 = objects[i];
    for (let j = i + 1;j < objects.length; j++) {
      const obj2 = objects[j];
      const d = computeDistance(obj1.x, obj1.y, obj2.x, obj2.y);
      const areConnected = connectedNodes[obj1.id]?.has(obj2.id) ?? false;
      const repulsiveForce = calculateRepulsiveForce(d.dist, areConnected, params);
      const attractiveForce = areConnected ? calculateAttractiveForce(d.dist, params) : 0;
      const totalForce = repulsiveForce - attractiveForce;
      const fx = totalForce * d.x / d.dist;
      const fy = totalForce * d.y / d.dist;
      resolveOverlap(obj1, obj2, d, params.minDistance);
      forceAccumulators[obj1.id].fx += fx;
      forceAccumulators[obj1.id].fy += fy;
      forceAccumulators[obj2.id].fx -= fx;
      forceAccumulators[obj2.id].fy -= fy;
    }
  }
};
var applyGravity = (objects, boundingBox, forceAccumulators, params) => {
  const centerX = boundingBox.x;
  const centerY = boundingBox.y;
  for (const obj of objects) {
    const dx = obj.x - centerX;
    const dy = obj.y - centerY;
    const dist = clamp(Math.sqrt(dx * dx + dy * dy), params.minDistance, 1000);
    const localGravity = params.gravityStrength * (1 - clamp(dist / (Math.max(boundingBox.width, boundingBox.height) * 0.8), 0.1, 1));
    forceAccumulators[obj.id].fx += -localGravity * dx;
    forceAccumulators[obj.id].fy += -localGravity * dy;
  }
};
var updatePositions = (objects, forceAccumulators, boundingBox, params) => {
  for (const obj of objects) {
    const accelX = forceAccumulators[obj.id].fx;
    const accelY = forceAccumulators[obj.id].fy;
    obj.vx = clamp((obj.vx + accelX) * params.damping, -params.maxVelocity, params.maxVelocity);
    obj.vy = clamp((obj.vy + accelY) * params.damping, -params.maxVelocity, params.maxVelocity);
    obj.x += obj.vx;
    obj.y += obj.vy;
    const halfWidth = obj.width / 2;
    const halfHeight = obj.height / 2;
    const minX = boundingBox.x - boundingBox.width / 2 + params.padding + halfWidth;
    const maxX = boundingBox.x + boundingBox.width / 2 - params.padding - halfWidth;
    const minY = boundingBox.y - boundingBox.height / 2 + params.padding + halfHeight;
    const maxY = boundingBox.y + boundingBox.height / 2 - params.padding - halfHeight;
    obj.x = clamp(obj.x, minX, maxX);
    obj.y = clamp(obj.y, minY, maxY);
  }
};
function simulate(objects, connectedNodes, boundingBox, params = DEFAULT_PARAMETERS) {
  const forceAccumulators = objects.reduce((acc, obj) => {
    acc[obj.id] = new ForceAccumulator;
    return acc;
  }, {});
  applyForces(objects, connectedNodes, forceAccumulators, params);
  applyGravity(objects, boundingBox, forceAccumulators, params);
  updatePositions(objects, forceAccumulators, boundingBox, params);
  return objects;
}

// src/property-initialization.ts
function calculateObjectProperties(num_connections) {
  const minSize = 10;
  const maxSize = 30;
  const sizeRange = maxSize - minSize;
  const connectionRatio = Math.min(1, num_connections / 5);
  const weight = Math.max(1, Math.min(num_connections ** 2, 100));
  const size = minSize + sizeRange * connectionRatio;
  const hue = 300 - Math.max(10, Math.min(connectionRatio * 290, 290));
  const saturation = 70;
  const lightness = 50;
  const color = `${hue}`;
  return { width: size, height: size, color, weight };
}
function initializeGraphProperties(objects, connectedNodes) {
  return objects.map((obj) => {
    const props = calculateObjectProperties(connectedNodes[obj.id].size);
    return {
      ...obj,
      width: props.width,
      height: props.height,
      color: props.color,
      weight: props.weight
    };
  });
}

// src/canvas_layout_manager.ts
class CanvasLayoutManager {
  canvasWidth;
  canvasHeight;
  padding = 5;
  minSubgraphSize = 400;
  smallGraphSize = 400;
  subgraphs = [];
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }
  simulate() {
    for (const subgraph of this.subgraphs) {
      simulate(subgraph.objects, subgraph.connections, subgraph.boundingBox);
    }
  }
  layoutCanvas(initialObjects, initialEdges) {
    const graphEdges = [];
    for (const edge of initialEdges) {
      graphEdges.push([edge[0], edge[1]]);
    }
    const connectedNodes = ConnectedNodes(initialObjects, graphEdges);
    const objects = initializeGraphProperties(initialObjects, connectedNodes);
    console.log("post-configuration objects:", objects);
    this.subgraphs = this.identifySubgraphs(objects, connectedNodes, graphEdges);
    this.calculateSubgraphSizes();
    this.arrangeSubgraphs();
  }
  identifySubgraphs(objects, connections, graphEdgesGlobal) {
    const visited = new Set;
    const subgraphs = [];
    const smallGraphNodes = [];
    const graphEdges = [];
    const findConnectedNodes = (startId) => {
      const connectedNodes = [];
      const stack = [startId];
      while (stack.length > 0) {
        const currentId = stack.pop()?.toString() || "";
        for (const edge of graphEdgesGlobal) {
          if (edge[0] === currentId || edge[1] === currentId) {
            graphEdges.push(edge);
          }
        }
        if (!visited.has(currentId)) {
          visited.add(currentId);
          const node = objects.find((obj) => obj.id === currentId);
          if (node) {
            connectedNodes.push(node);
            for (const neighborId of connections[currentId] || []) {
              if (!visited.has(neighborId)) {
                stack.push(neighborId);
              }
            }
          }
        }
      }
      return connectedNodes;
    };
    for (const obj of objects) {
      if (!visited.has(obj.id)) {
        const connectedNodes = findConnectedNodes(obj.id);
        if (connectedNodes.length <= 2) {
          smallGraphNodes.push(...connectedNodes);
        } else {
          subgraphs.push({
            objects: connectedNodes,
            connections: this.extractSubgraphConnections(connectedNodes, connections),
            boundingBox: { x: 0, y: 0, width: 0, height: 0 },
            graphEdges,
            isSmallGraph: false
          });
        }
      }
    }
    if (smallGraphNodes.length > 0) {
      subgraphs.push({
        objects: smallGraphNodes,
        connections: this.extractSubgraphConnections(smallGraphNodes, connections),
        graphEdges,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        isSmallGraph: true
      });
    }
    return subgraphs;
  }
  extractSubgraphConnections(nodes, fullConnections) {
    const subConnections = {};
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const node of nodes) {
      subConnections[node.id] = new Set(Array.from(fullConnections[node.id] || []).filter((id) => nodeIds.has(id)));
    }
    return subConnections;
  }
  calculateSubgraphSizes() {
    for (const subgraph of this.subgraphs) {
      if (subgraph.isSmallGraph) {
        const nodeCount = subgraph.objects.length;
        const cols = Math.ceil(Math.sqrt(nodeCount));
        const rows = Math.ceil(nodeCount / cols);
        subgraph.boundingBox = {
          x: 0,
          y: 0,
          width: cols * this.smallGraphSize + (cols - 1) * this.padding,
          height: rows * this.smallGraphSize + (rows - 1) * this.padding
        };
      } else {
        const nodeCount = subgraph.objects.length;
        const baseSize = Math.max(this.minSubgraphSize, Math.sqrt(nodeCount) * 100);
        subgraph.boundingBox = {
          x: 0,
          y: 0,
          width: baseSize,
          height: baseSize
        };
      }
    }
  }
  arrangeSubgraphs() {
    if (this.subgraphs.length === 0)
      return;
    this.subgraphs.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height);
    const totalArea = this.subgraphs.reduce((sum, sg) => sum + sg.boundingBox.width * sg.boundingBox.height, 0);
    const aspectRatio = this.canvasWidth / this.canvasHeight;
    const estimatedRows = Math.sqrt(totalArea / aspectRatio);
    const cols = Math.ceil(Math.sqrt(this.subgraphs.length * aspectRatio));
    const rows = Math.ceil(this.subgraphs.length / cols);
    const cellWidth = (this.canvasWidth - (cols + 1) * this.padding) / cols;
    const cellHeight = (this.canvasHeight - (rows + 1) * this.padding) / rows;
    let currentRow = 0;
    let currentCol = 0;
    for (const subgraph of this.subgraphs) {
      const x = this.padding + currentCol * (cellWidth + this.padding) + cellWidth / 2;
      const y = this.padding + currentRow * (cellHeight + this.padding) + cellHeight / 2;
      const scale = Math.min((cellWidth - this.padding) / subgraph.boundingBox.width, (cellHeight - this.padding) / subgraph.boundingBox.height);
      subgraph.boundingBox.width *= scale;
      subgraph.boundingBox.height *= scale;
      subgraph.boundingBox.x = x;
      subgraph.boundingBox.y = y;
      if (subgraph.isSmallGraph) {
        this.layoutSmallGraph(subgraph);
      }
      currentCol++;
      if (currentCol >= cols) {
        currentCol = 0;
        currentRow++;
      }
    }
  }
  layoutSmallGraph(subgraph) {
    const { objects, boundingBox } = subgraph;
    const cols = Math.ceil(Math.sqrt(objects.length));
    const smallGraphPadding = this.padding / 2;
    objects.forEach((obj, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const cellSize = this.smallGraphSize * Math.min(boundingBox.width / (cols * this.smallGraphSize + (cols - 1) * smallGraphPadding), boundingBox.height / (Math.ceil(objects.length / cols) * this.smallGraphSize + (Math.ceil(objects.length / cols) - 1) * smallGraphPadding));
      obj.x = boundingBox.x - boundingBox.width / 2 + col * (cellSize + smallGraphPadding) + cellSize / 2;
      obj.y = boundingBox.y - boundingBox.height / 2 + row * (cellSize + smallGraphPadding) + cellSize / 2;
    });
  }
}

// src/drawing.ts
var canvas = document.querySelector("#simulationCanvas");
var ctx = canvas?.getContext("2d", { alpha: false });
function resizeCanvas(cw = 1400, ch = 900) {
  if (!ctx || !canvas)
    throw new Error("Canvas context not found");
  canvas.width = cw;
  canvas.height = ch;
  return { width: cw, height: ch };
}
function drawFrame(layoutManager, options = {}) {
  if (!ctx || !canvas)
    throw new Error("Canvas context not found");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "hsl(0, 0.00%, 20%)";
  ctx.fill();
  const subgraphs = layoutManager.subgraphs;
  for (const subgraph of subgraphs) {
    const objects = subgraph.objects;
    const graphEdges = subgraph.graphEdges;
    drawEdges(objects, graphEdges);
    drawNodes(objects);
    if (layoutManager && options.showBoundingBoxes) {
      drawBoundingBoxes(layoutManager);
    }
    if (options.debug) {
      drawDebugInfo(objects, layoutManager);
    }
  }
}
function drawEdges(objects, graphEdges) {
  if (!ctx)
    return;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  for (const edge of graphEdges) {
    const obj1 = objects.find((obj) => obj.id === edge[0]);
    const obj2 = objects.find((obj) => obj.id === edge[1]);
    if (obj1 && obj2) {
      ctx.beginPath();
      ctx.moveTo(obj1.x, obj1.y);
      ctx.lineTo(obj2.x, obj2.y);
      ctx.stroke();
    }
  }
}
function drawNodes(objects) {
  if (!ctx)
    return;
  for (const obj of objects) {
    ctx.beginPath();
    ctx.rect(obj.x - obj.width / 2, obj.y - obj.height / 2, obj.width, obj.height);
    ctx.fillStyle = `hsl(${obj.color}, 50%, 90%)`;
    ctx.fill();
    ctx.strokeStyle = `hsl(${obj.color}, 50%, 60%)`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
function drawBoundingBoxes(layoutManager) {
  if (!ctx)
    return;
  const subgraphs = layoutManager.subgraphs;
  for (const subgraph of subgraphs) {
    const { x, y, width, height } = subgraph.boundingBox;
    ctx.beginPath();
    ctx.rect(x - width / 2, y - height / 2, width, height);
    ctx.strokeStyle = subgraph.isSmallGraph ? "rgba(255, 165, 0, 0.3)" : "rgba(0, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function drawDebugInfo(objects, layoutManager) {
  if (!ctx)
    return;
  ctx.font = "14px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (const obj of objects) {
    ctx.fillText(obj.id, obj.x + obj.width / 2 + 5, obj.y);
  }
  if (layoutManager) {
    const subgraphs = layoutManager.subgraphs;
    for (const subgraph of subgraphs) {
      const { x, y, width } = subgraph.boundingBox;
      const info = `${subgraph.objects.length} nodes${subgraph.isSmallGraph ? " (small)" : ""}`;
      ctx.fillText(info, x - width / 2, y - 10);
    }
  }
}
function initializeCanvas(width = 1400, height = 900) {
  const dimensions = resizeCanvas(width, height);
  return new CanvasLayoutManager(dimensions.width, dimensions.height);
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

// src/index.ts
function simulateAndDraw(layoutManager) {
  function drawLoop() {
    layoutManager.simulate();
    drawFrame(layoutManager, {
      showBoundingBoxes: false,
      debug: false
    });
    requestAnimationFrame(drawLoop);
  }
  requestAnimationFrame(drawLoop);
}
websocket.onmessage = (event) => {
  const initialData = JSON.parse(event.data);
  console.log("Initial data received:", initialData);
  const layoutManager = initializeCanvas(window.innerWidth - 20, initialData.height);
  layoutManager.layoutCanvas(initialData.objects, initialData.edges);
  simulateAndDraw(layoutManager);
};
