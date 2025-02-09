/**
 * Force-directed graph layout using the Fruchterman–Reingold algorithm.
 *
 * This implementation has been refactored and modernized following TypeScript
 * best practices and design principles. Each simulation phase is separated into
 * its own helper function, and the code is fully documented.
 */

// Constants and configuration values
const MIN_DISTANCE = 0.1;
const MAX_VELOCITY = 8.0;
const DAMPING = 0.9;
const PADDING = 100;
const CELL_SIZE = 2000; // Grid cell size for spatial partitioning
const RECENTER_THRESHOLD = 20;
const RECENTER_FACTOR = 0.05;
const GRAVITY_STRENGTH = 0.1;
const NATURAL_LENGTH = 80.0;
const BASE_REPULSIVE_STRENGTH = 80.0;

/**
 * Clamps a value between a minimum and maximum.
 * @param value - The value to clamp.
 * @param min - Minimum allowed value.
 * @param max - Maximum allowed value.
 * @returns The clamped value.
 */
const clamp = (value: number, min: number, max: number): number =>
    Number.isNaN(value) ? (min + max) / 2 : Math.min(Math.max(value, min), max);

/**
 * Represents the accumulated force on a node.
 */
class ForceAccumulator {
    public fx = 0.01;
    public fy = 0.01;
}

/**
 * Represents a node in the canvas graph.
 */
export class CanvasObject {
    public id = "";
    public x = 1.0;
    public y = 1.0;
    public vx = 0.01;
    public vy = 0.01;
    public width = 1.0;
    public height = 1.0;
    public weight = 10; //this.width * this.height * 10;
    public color = "";
}

/**
 * A graph edge defined as a tuple of two node IDs.
 */
export type GraphEdge = [string, string];

/**
 * A mapping from node IDs to the set of IDs of connected nodes.
 */
export type ConnectedNodes = { [key: string]: Set<string> };

/**
 * Creates a mapping of connected node IDs from the list of graph edges.
 * Each node's set will contain the IDs of all nodes it is directly connected to.
 *
 * @param objects - The array of CanvasObjects.
 * @param graphEdges - The array of edges defined as tuples [string, string].
 * @returns A ConnectedNodes mapping.
 */
export function createConnections(objects: CanvasObject[], graphEdges: GraphEdge[]): ConnectedNodes {
    const connectedNodes: ConnectedNodes = {};
    // Initialize a set for every node.
    for (const obj of objects){
        connectedNodes[obj.id] = new Set<string>();
    }
    // For each edge, add each connection (assuming undirected graph)
    for (const [id1, id2] of graphEdges){
        if (connectedNodes[id1]) {
            connectedNodes[id1].add(id2);
        }
        if (connectedNodes[id2]) {
            connectedNodes[id2].add(id1);
        }
    }
    return connectedNodes;
}

/**
 * Computes the displacement vector and distance between two points.
 * @param x1 - X-coordinate of first point.
 * @param y1 - Y-coordinate of first point.
 * @param x2 - X-coordinate of second point.
 * @param y2 - Y-coordinate of second point.
 * @returns An object containing dx, dy, and the distance.
 */
const computeDistance = (x1: number, y1: number, x2: number, y2: number): { dx: number; dy: number; dist: number } => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const dist = Math.max(MIN_DISTANCE, Math.sqrt(dx * dx + dy * dy));
    return { dx, dy, dist };
};

/**
 * Creates and returns a force accumulator for each object.
 * @param objects - Array of CanvasObjects.
 * @returns An object mapping each object's ID to its ForceAccumulator.
 */
const initializeForceAccumulators = (objects: CanvasObject[]): { [id: string]: ForceAccumulator } =>
    objects.reduce(
        (acc, obj) => {
            acc[obj.id] = new ForceAccumulator();
            return acc;
        },
        {} as { [id: string]: ForceAccumulator },
    );

/**
 * SpatialGrid partitions the canvas into cells to limit the number of pairwise
 * repulsive force calculations.
 */
class SpatialGrid {
    private cellSize: number;
    private grid: Map<string, Set<CanvasObject>>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.grid = new Map<string, Set<CanvasObject>>();
    }

    private getCellKey(x: number, y: number): string {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    /**
     * Inserts a CanvasObject into all cells it overlaps.
     * @param obj - The CanvasObject to insert.
     */
    public insert(obj: CanvasObject): void {
        const minX = obj.x - obj.width / 2;
        const maxX = obj.x + obj.width / 2;
        const minY = obj.y - obj.height / 2;
        const maxY = obj.y + obj.height / 2;
        for (let x = minX; x <= maxX; x += this.cellSize) {
            for (let y = minY; y <= maxY; y += this.cellSize) {
                const key = this.getCellKey(x, y);
                if (!this.grid.has(key)) {
                    this.grid.set(key, new Set<CanvasObject>());
                }
                this.grid.get(key)?.add(obj);
            }
        }
    }

    /**
     * Retrieves neighboring objects from cells overlapping the given object.
     * @param obj - The CanvasObject for which to retrieve neighbors.
     * @returns A Set of neighboring CanvasObjects.
     */
    public getNeighbors(obj: CanvasObject): Set<CanvasObject> {
        const neighbors = new Set<CanvasObject>();
        const minX = obj.x - obj.width / 2;
        const maxX = obj.x + obj.width / 2;
        const minY = obj.y - obj.height / 2;
        const maxY = obj.y + obj.height / 2;
        for (let x = minX; x <= maxX; x += this.cellSize) {
            for (let y = minY; y <= maxY; y += this.cellSize) {
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

/**
 * Calculates the attractive force based on the displacement from the natural length.
 * @param dist - The current distance between nodes.
 * @returns The attractive force.
 */
export const calculateAttractiveForce = (dist: number): number => {
    const displacement = dist - NATURAL_LENGTH;
    const springConstant = 0.2;
    return springConstant * displacement;
};

/**
 * Calculates the repulsive force between nodes.
 * @param dist - The distance between nodes.
 * @param areConnected - Whether the nodes are directly connected.
 * @returns The repulsive force.
 */
export const calculateRepulsiveForce = (dist: number, areConnected: boolean): number => {
    const effectiveStrength = BASE_REPULSIVE_STRENGTH * (0.5 * (areConnected ? 1 : 4.0));
    const distScale = clamp(dist / 200.0, 0.1, 1.0);
    const softening = 20.0;
    const baseForce = effectiveStrength / (dist + softening ** 1.5);
    return baseForce * (1.0 - distScale * 0.5);
};

/**
 * Applies repulsive forces between nodes using the spatial grid.
 */
const applyRepulsiveForces = (
    objects: CanvasObject[],
    connectedNodes: ConnectedNodes,
    grid: SpatialGrid,
    forceAccumulators: { [id: string]: ForceAccumulator },
): void => {
    for (const obj1 of objects) {
        const neighbors = grid.getNeighbors(obj1);
        for (const obj2 of neighbors) {
            // Process each pair only once.
            if (obj1.id < obj2.id) {
                const { dx, dy, dist } = computeDistance(obj1.x, obj1.y, obj2.x, obj2.y);
                const areConnected = connectedNodes[obj1.id]?.has(obj2.id) ?? false;
                let repulsiveForce = calculateRepulsiveForce(dist, areConnected);
                // Collision avoidance: increase force if too close.
                const minDistancePadding = 10;
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
    }
};

/**
 * Applies attractive forces for nodes that are connected.
 */
const applyAttractiveForces = (
    objects: CanvasObject[],
    connectedNodes: ConnectedNodes,
    forceAccumulators: { [id: string]: ForceAccumulator },
): void => {
    for (const [node, neighbors] of Object.entries(connectedNodes)) {
        for (const neighbor of neighbors) {
            const obj1 = objects.find((o) => o.id === node);
            const obj2 = objects.find((o) => o.id === neighbor);
            if (obj1 && obj2) {
                const { dx, dy, dist } = computeDistance(obj1.x, obj1.y, obj2.x, obj2.y);
                const attractiveForce = calculateAttractiveForce(dist);
                const fx = (attractiveForce * dx) / dist;
                const fy = (attractiveForce * dy) / dist;
                forceAccumulators[obj1.id].fx -= fx;
                forceAccumulators[obj1.id].fy -= fy;
                forceAccumulators[obj2.id].fx += fx;
                forceAccumulators[obj2.id].fy += fy;
            }
        }
    }
};

/**
 * Applies a gravitational force pulling nodes toward the center.
 */
const applyGravity = (
    objects: CanvasObject[],
    centerX: number,
    centerY: number,
    canvasWidth: number,
    canvasHeight: number,
    forceAccumulators: { [id: string]: ForceAccumulator },
): void => {
    for (const obj of objects) {
        const dx = obj.x - centerX;
        const dy = obj.y - centerY;
        const dist = clamp(Math.sqrt(dx * dx + dy * dy), MIN_DISTANCE, 1000.0);
        const localGravity =
            GRAVITY_STRENGTH * (1.0 - clamp(dist / (Math.max(canvasWidth, canvasHeight) * 0.8), 0.1, 1.0));
        const gravityFx = -localGravity * dx;
        const gravityFy = -localGravity * dy;
        forceAccumulators[obj.id].fx += gravityFx;
        forceAccumulators[obj.id].fy += gravityFy;
    }
};

/**
 * Updates positions and velocities of objects based on accumulated forces.
 */
const updatePositions = (
    objects: CanvasObject[],
    forceAccumulators: { [id: string]: ForceAccumulator },
    canvasWidth: number,
    canvasHeight: number,
): void => {
    for (const obj of objects) {
        const weight = Math.max(0.1, obj.weight);
        const accelX = forceAccumulators[obj.id].fx / weight;
        const accelY = forceAccumulators[obj.id].fy / weight;
        obj.vx = clamp((obj.vx + accelX) * DAMPING, -MAX_VELOCITY, MAX_VELOCITY);
        obj.vy = clamp((obj.vy + accelY) * DAMPING, -MAX_VELOCITY, MAX_VELOCITY);
        obj.x += obj.vx;
        obj.y += obj.vy;
        // Keep nodes within canvas bounds.
        obj.x = clamp(obj.x, PADDING + obj.width / 2, canvasWidth - PADDING - obj.width / 2);
        obj.y = clamp(obj.y, PADDING + obj.height / 2, canvasHeight - PADDING - obj.height / 2);
    }
};

/**
 * Removes net momentum by subtracting the average velocity from all nodes.
 */
const removeNetMomentum = (objects: CanvasObject[]): void => {
    const { sumVx, sumVy } = objects.reduce(
        (acc, obj) => {
            acc.sumVx += obj.vx;
            acc.sumVy += obj.vy;
            return acc;
        },
        { sumVx: 0, sumVy: 0 },
    );
    const avgVx = sumVx / objects.length;
    const avgVy = sumVy / objects.length;
    for (const obj of objects) {
        obj.vx -= avgVx;
        obj.vy -= avgVy;
    }
};

/**
 * Gently recenters the overall layout toward the canvas center if drift is excessive.
 */
const recenterPositions = (objects: CanvasObject[], centerX: number, centerY: number): void => {
    const { sumX, sumY } = objects.reduce(
        (acc, obj) => {
            acc.sumX += obj.x;
            acc.sumY += obj.y;
            return acc;
        },
        { sumX: 0, sumY: 0 },
    );
    const avgX = sumX / objects.length;
    const avgY = sumY / objects.length;
    const driftX = centerX - avgX;
    const driftY = centerY - avgY;
    const driftDist = Math.sqrt(driftX * driftX + driftY * driftY);
    if (driftDist > RECENTER_THRESHOLD) {
        const offsetX = driftX * RECENTER_FACTOR;
        const offsetY = driftY * RECENTER_FACTOR;
        for (const obj of objects) {
            obj.x += offsetX;
            obj.y += offsetY;
        }
    }
};

/**
 * Executes a single simulation step of the Fruchterman–Reingold algorithm.
 * @param objects - The list of CanvasObjects.
 * @param connectedNodes - A mapping from node IDs to their connected nodes.
 * @param canvasWidth - The canvas width.
 * @param canvasHeight - The canvas height.
 * @returns The updated array of CanvasObjects.
 */
export function fruchtermanReingoldStep(
    objects: CanvasObject[],
    connectedNodes: ConnectedNodes,
    canvasWidth: number,
    canvasHeight: number,
): CanvasObject[] {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Initialize force accumulators for all nodes.
    const forceAccumulators = initializeForceAccumulators(objects);

    // Build a spatial grid to limit pairwise calculations.
    const grid = new SpatialGrid(CELL_SIZE);
    for (const obj of objects) grid.insert(obj);

    // Apply simulation forces.
    applyRepulsiveForces(objects, connectedNodes, grid, forceAccumulators);
    applyAttractiveForces(objects, connectedNodes, forceAccumulators);
    applyGravity(objects, centerX, centerY, canvasWidth, canvasHeight, forceAccumulators);
    updatePositions(objects, forceAccumulators, canvasWidth, canvasHeight);
    removeNetMomentum(objects);
    //recenterPositions(objects, centerX, centerY);

    console.log(forceAccumulators[objects[0].id], objects[0])

    return objects;
}
