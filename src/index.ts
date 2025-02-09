// index.ts
import {
    type CanvasObject,
    type ConnectedNodes,
    createConnections,
    fruchtermanReingoldStep,
    type GraphEdge,
} from "./force-layout"; // Update path if needed.
import { drawFrame, resizeCanvas } from "./drawing";
import { websocket } from "./websocket-client";
import { initializeGraphProperties } from "./property-initialization";

function simulateAndDraw(
    initialObjects: CanvasObject[],
    graph_edges: GraphEdge[],
    connectedNodes: ConnectedNodes,
    canvasWidth: number,
    canvasHeight: number,
) {
    let objects = initialObjects;
    function drawLoop() {
        // Simulate and draw
        objects = fruchtermanReingoldStep(objects, connectedNodes, canvasWidth, canvasHeight);
        drawFrame(objects, graph_edges);
        requestAnimationFrame(drawLoop);
    }
    requestAnimationFrame(drawLoop);
}

websocket.onmessage = (event) => {
    const initialData = JSON.parse(event.data);
    console.log("Initial data received:", initialData);
    let objects: CanvasObject[] = initialData.objects;
    const graph_edges: GraphEdge[] = initialData.edges;
    const canvasWidth = initialData.width;
    const canvasHeight = initialData.height;
    resizeCanvas(canvasWidth, canvasHeight);
    // Create connection map and start animation loop.
    const connectedNodes = createConnections(objects, graph_edges);
    objects = initializeGraphProperties(objects, connectedNodes);
    simulateAndDraw(objects, graph_edges, connectedNodes, canvasWidth, canvasHeight);
};
