// src/force-layout.ts
var naturalLength = 80;
var gravityStrength = 0.05;
var baseRepulsiveStrength = 1e4;

class ForceAccumulator {
  fx = 0.01;
  fy = 0.01;
}

class CanvasObject {
  id = "";
  x = 1;
  y = 1;
  vx = 0.01;
  vy = 0.01;
  width = 1;
  height = 1;
  weight = this.width * this.height * 5;
  color = "";
}
var clamp = (value, min, max) => {
  if (Number.isNaN(value))
    return min + max / 2;
  return Math.min(Math.max(value, min), max);
};
function calculateAttractiveForce(dist) {
  const displacement = dist - naturalLength;
  const springConstant = 0.2;
  return springConstant * displacement;
}
function calculateRepulsiveForce(dist, areConnected) {
  const effectiveStrength = baseRepulsiveStrength * (0.5 * (areConnected ? 1 : 4));
  const distScale = clamp(dist / 200, 0.1, 1);
  const softening = 20;
  const baseForce = effectiveStrength / (dist + softening) ** 1.5;
  return baseForce * (1 - distScale * 0.5);
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
function fruchtermanReingoldStep(objects, graph_edges, canvasWidth, canvasHeight) {
  let repulsiveForce;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const connectedNodes = {};
  for (const obj of objects) {
    connectedNodes[obj.id] = getConnectedNodes(obj.id, graph_edges);
  }
  const forceAccumulators = {};
  for (const obj of objects)
    forceAccumulators[obj.id] = new ForceAccumulator;
  for (let i = 0;i < objects.length; i++) {
    for (let j = i + 1;j < objects.length; j++) {
      const obj1 = objects[i];
      const obj2 = objects[j];
      const dx = obj1.x - obj2.x;
      const dy = obj1.y - obj2.y;
      const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
      const areConnected = connectedNodes[obj1.id].has(obj2.id);
      repulsiveForce = calculateRepulsiveForce(dist, areConnected);
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
  for (const edge of graph_edges) {
    const obj1 = objects.find((obj) => obj.id === edge[0]);
    const obj2 = objects.find((obj) => obj.id === edge[1]);
    if (obj1 && obj2) {
      const dx = obj1.x - obj2.x;
      const dy = obj1.y - obj2.y;
      const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
      const attractiveForce = calculateAttractiveForce(dist);
      const fx = attractiveForce * dx / dist;
      const fy = attractiveForce * dy / dist;
      forceAccumulators[obj1.id].fx -= fx;
      forceAccumulators[obj1.id].fy -= fy;
      forceAccumulators[obj2.id].fx += fx;
      forceAccumulators[obj2.id].fy += fy;
    }
  }
  for (const obj of objects) {
    const dx = obj.x - centerX;
    const dy = obj.y - centerY;
    const dist = clamp(0.1, Math.sqrt(dx * dx + dy * dy), 1000);
    const localGravity = gravityStrength * (1 - clamp(0.1, dist / (Math.max(canvasWidth, canvasHeight) * 0.8), 1));
    const gravityFx = -localGravity * dx;
    const gravityFy = -localGravity * dy;
    forceAccumulators[obj.id].fx += gravityFx;
    forceAccumulators[obj.id].fy += gravityFy;
  }
  for (const obj of objects) {
    const weight = Math.max(0.1, obj.weight);
    const accelX = forceAccumulators[obj.id].fx / weight;
    const accelY = forceAccumulators[obj.id].fy / weight;
    const maxVelocity = 10;
    const damping = 0.85;
    obj.vx = clamp((obj.vx + accelX) * damping, -maxVelocity, maxVelocity);
    obj.vy = clamp((obj.vy + accelY) * damping, -maxVelocity, maxVelocity);
    obj.x += obj.vx;
    obj.y += obj.vy;
    const padding = 30;
    obj.x = clamp(obj.x, padding + obj.width / 2, canvasWidth - padding - obj.width / 2);
    obj.y = clamp(obj.y, padding + obj.height / 2, canvasHeight - padding - obj.height / 2);
  }
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
function calculateObjectProperties(objId, objects, graph_edges) {
  const connections = getConnectedNodes(objId, graph_edges).size;
  const minSize = 20;
  const maxSize = 60;
  const sizeRange = maxSize - minSize;
  const connectionRatio = Math.min(1, connections / 5);
  const size = minSize + sizeRange * connectionRatio;
  const hue = 300 - Math.max(10, Math.min(connectionRatio * 290, 290));
  const saturation = 70;
  const lightness = 50;
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  return { width: size, height: size, color };
}
function initializeGraphProperties(objects, graph_edges) {
  return objects.map((obj) => {
    const properties = calculateObjectProperties(obj.id, objects, graph_edges);
    const newobj = new CanvasObject;
    newobj.id = obj.id;
    newobj.color = properties.color;
    newobj.height = properties.height;
    newobj.width = properties.width;
    newobj.vx = obj.vx;
    newobj.vy = obj.vy;
    newobj.x = obj.x;
    newobj.y = obj.y;
    console.log(newobj.x, newobj.y);
    return newobj;
  });
}

// src/index.ts
function simulateAndDraw(initialObjects, graph_edges, canvasWidth, canvasHeight) {
  let objects = initialObjects;
  function drawLoop() {
    objects = fruchtermanReingoldStep(objects, graph_edges, canvasWidth, canvasHeight);
    drawFrame(objects, graph_edges);
    requestAnimationFrame(drawLoop);
  }
  requestAnimationFrame(drawLoop);
}
websocket.onmessage = (event) => {
  const initialData = JSON.parse(event.data);
  console.log("Initial data received:", initialData);
  let objects = [];
  let graph_edges = [];
  objects = initialData.objects;
  graph_edges = initialData.edges;
  const canvasWidth = initialData.width;
  const canvasHeight = initialData.height;
  resizeCanvas(canvasWidth, canvasHeight);
  objects = initializeGraphProperties(objects, graph_edges);
  simulateAndDraw(objects, graph_edges, canvasWidth, canvasHeight);
};
