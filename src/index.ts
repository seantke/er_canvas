import {
	type CanvasObject,
	fruchtermanReingoldStep,
	type GraphEdge,
} from "./force-layout";
import { drawFrame } from "./drawing";
import { websocket } from "./websocket-client";
import { initializeGraphProperties } from "./property-initialization";
import { resizeCanvas } from "./drawing";

function simulateAndDraw(
	initialObjects: CanvasObject[],
	graph_edges: GraphEdge[],
	canvasWidth: number,
	canvasHeight: number,
) {
	let objects = initialObjects;
	function drawLoop() {
		// Simulate and draw
		objects = fruchtermanReingoldStep(
			objects,
			graph_edges,
			canvasWidth,
			canvasHeight,
		);
		drawFrame(objects, graph_edges);
		// Continue animation loop
		requestAnimationFrame(drawLoop);
	}
	requestAnimationFrame(drawLoop);
}

websocket.onmessage = (event) => {
	const initialData = JSON.parse(event.data);
	console.log("Initial data received:", initialData);
	let objects: CanvasObject[] = [];
	let graph_edges: GraphEdge[] = [];
	objects = initialData.objects;
		graph_edges = initialData.edges;
	const canvasWidth = initialData.width;
	const canvasHeight = initialData.height;
	resizeCanvas(canvasWidth, canvasHeight);
	// Calculate initial object properties (now updates objects directly)
	objects = initializeGraphProperties(objects, graph_edges);
    // Start the animation loop
	simulateAndDraw(objects, graph_edges, canvasWidth, canvasHeight);
};
