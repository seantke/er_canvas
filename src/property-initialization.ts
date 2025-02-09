import {
	CanvasObject,
	type GraphEdge,
	getConnectedNodes,
} from "./force-layout";

export function calculateObjectProperties(
	objId: string,
	objects: CanvasObject[],
	graph_edges: GraphEdge[],
) {
	const connections = getConnectedNodes(objId, graph_edges).size;

	// Size scaling (rectangle dimensions) - JS side calculation
	const minSize = 20;
	const maxSize = 60;
	const sizeRange = maxSize - minSize;
	const connectionRatio = Math.min(1.0, connections / 5);
	const size = minSize + sizeRange * connectionRatio;

	// Color scaling (blue to red gradient) - JS side calculation
	const hue = 300 - Math.max(10, Math.min(connectionRatio * 290, 290));
	const saturation = 70;
	const lightness = 50;
	const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

	return { width: size, height: size, color: color };
}

export function initializeGraphProperties(
	objects: CanvasObject[],
	graph_edges: GraphEdge[],
): CanvasObject[] {
	return objects.map((obj) => {
		const properties = calculateObjectProperties(obj.id, objects, graph_edges);
		const newobj = new CanvasObject();
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
