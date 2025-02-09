const naturalLength = 80.0;
const gravityStrength = 0.05;
const baseRepulsiveStrength = 10000.0;

class ForceAccumulator {
	fx = 0.01;
	fy = 0.01;
}

export class CanvasObject {
	id = "";
	x = 1.0;
	y = 1.0;
	vx = 0.01;
	vy = 0.01;
	width = 1.0;
	height = 1.0;
	weight = this.width*this.height*5;
	color = "";
}

export type GraphEdge = [string, string];

const clamp = (value: number, min: number, max: number) => {
	if (Number.isNaN(value)) return min + max / 2;
	return Math.min(Math.max(value, min), max);
};

export function calculateAttractiveForce(dist: number) {
	const displacement = dist - naturalLength;
	const springConstant = 0.2;
	return springConstant * displacement;
}

export function calculateRepulsiveForce(dist: number, areConnected: boolean) {
	const effectiveStrength =
		baseRepulsiveStrength * (0.5 * (areConnected ? 1 : 4.0));

	const distScale = clamp(dist / 200.0, 0.1, 1.0);
	const softening = 20.0;
	const baseForce = effectiveStrength / (dist + softening) ** 1.5;

	return baseForce * (1.0 - distScale * 0.5);
}

export function getConnectedNodes(nodeId: string, graph_edges: GraphEdge[]) {
	const connected = new Set<string>();
	for (const edge of graph_edges) {
		if (edge.includes(nodeId)) {
			for (const node of edge) connected.add(node);
		}
	}
	connected.delete(nodeId);
	return connected;
}

export function fruchtermanReingoldStep(
	objects: CanvasObject[],
	graph_edges: GraphEdge[],
	canvasWidth: number,
	canvasHeight: number,
) {
	// Pass objects, edges, width, height as arguments
	let repulsiveForce: number;
	const centerX = canvasWidth / 2;
	const centerY = canvasHeight / 2;

	const connectedNodes: { [key: string]: Set<string> } = {};

	for (const obj of objects) {
		connectedNodes[obj.id] = getConnectedNodes(obj.id, graph_edges);
	}

	const forceAccumulators: { [key: string]: ForceAccumulator } = {};
	for (const obj of objects) forceAccumulators[obj.id] = new ForceAccumulator();

	for (let i = 0; i < objects.length; i++) {
		for (let j = i + 1; j < objects.length; j++) {
			const obj1 = objects[i];
			const obj2 = objects[j];
			const dx = obj1.x - obj2.x;
			const dy = obj1.y - obj2.y;
			const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

			const areConnected = connectedNodes[obj1.id].has(obj2.id);
			repulsiveForce = calculateRepulsiveForce(dist, areConnected);
            
            const minDistancePadding = 10

			// Collision avoidance
			const minDistanceX = obj1.width / 2 + obj2.width / 2 + minDistancePadding;
			const minDistanceY = obj1.height / 2 + obj2.height / 2 + minDistancePadding;
			const minDistance = Math.max(minDistanceX, minDistanceY);

			if (dist < minDistance) {
				repulsiveForce *= 2.0;
			}

			const fx = (repulsiveForce * dx) / dist;
			const fy = (repulsiveForce * dy) / dist;

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
			const fx = (attractiveForce * dx) / dist;
			const fy = (attractiveForce * dy) / dist;

			forceAccumulators[obj1.id].fx -= fx;
			forceAccumulators[obj1.id].fy -= fy;
			forceAccumulators[obj2.id].fx += fx;
			forceAccumulators[obj2.id].fy += fy;
		}
	}

	for (const obj of objects) {
		const dx = obj.x - centerX;
		const dy = obj.y - centerY;
		const dist = clamp(0.1, Math.sqrt(dx * dx + dy * dy), 1000.0);

		const localGravity =
			gravityStrength *
			(1.0 -
				clamp(0.1, dist / (Math.max(canvasWidth, canvasHeight) * 0.8), 1.0));

		const gravityFx = -localGravity * dx;
		const gravityFy = -localGravity * dy;

		forceAccumulators[obj.id].fx += gravityFx;
		forceAccumulators[obj.id].fy += gravityFy;
	}

	for (const obj of objects) {
		const weight = Math.max(0.1, obj.weight);
		const accelX = forceAccumulators[obj.id].fx / weight;
		const accelY = forceAccumulators[obj.id].fy / weight;

		const maxVelocity = 10.0;
		const damping = 0.85;

		obj.vx = clamp((obj.vx + accelX) * damping, -maxVelocity, maxVelocity);
		obj.vy = clamp((obj.vy + accelY) * damping, -maxVelocity, maxVelocity);

		obj.x += obj.vx;
		obj.y += obj.vy;

		const padding = 30;
		obj.x = clamp(
			obj.x,
			padding + obj.width / 2,
			canvasWidth - padding - obj.width / 2,
		);
		obj.y = clamp(
			obj.y,
			padding + obj.height / 2,
			canvasHeight - padding - obj.height / 2,
		);
	}
	return objects;
}
