import type {CanvasObject, LayoutParameters, ConnectedNodes} from './types';
import {ForceAccumulator} from './types';

// Default parameters that can be scaled per subgraph
const DEFAULT_PARAMETERS: LayoutParameters = {
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

/**
 * Clamps a value between a minimum and maximum.
 * @param value - The value to clamp.
 * @param min - Minimum allowed value.
 * @param max - Maximum allowed value.
 * @returns The clamped value.
 */
const clamp = (value: number, min: number, max: number): number =>
    Number.isNaN(value) ? (min + max) / 2 : Math.min(Math.max(value, min), max);


const computeDistance = (x1: number, y1: number, x2: number, y2: number): { x: number; y: number; dist: number } => {
    const x = x1 - x2;
    const y = y1 - y2;
    const dist = Math.max(0.1, Math.sqrt(x ** 2 + y ** 2));
    return { x, y, dist };
};

// Modified force calculations to accept parameters
const calculateAttractiveForce = (dist: number, params: LayoutParameters): number => {
    const displacement = dist - params.naturalLength;
    const springConstant = 0.3;
    return springConstant * displacement;
};

const calculateRepulsiveForce = (dist: number, areConnected: boolean, params: LayoutParameters): number => {
    const effectiveStrength = params.baseRepulsiveStrength * (0.5 * (areConnected ? 2.0 : 0.2));
    const distScale = clamp(dist / 200.0, 0.1, 1.0);
    const softening = 50.0;
    const baseForce = effectiveStrength / (dist + softening ** 1.5);
    return baseForce * (1.0 - distScale * 0.5);
};

const resolveOverlap = (
    nodeA: { x: number; y: number }, 
    nodeB: { x: number; y: number }, 
    d: {x:number,y:number,dist:number},
    minDistance:number
) => {
    // if (d.dist === 0) {
    //     const angle = Math.random() * 2 * Math.PI;
    //     nodeA.x += Math.cos(angle) * minDistance * 0.5;
    //     nodeA.y += Math.sin(angle) * minDistance * 0.5;
    //     nodeB.x -= Math.cos(angle) * minDistance * 0.5;
    //     nodeB.y -= Math.sin(angle) * minDistance * 0.5;
    // }
    const variability = 2000
    if (d.dist < minDistance*0.1) {
        nodeA.x += (Math.random() * variability) - (variability/2)
        nodeA.y += (Math.random() * variability) - (variability/2)
        nodeB.x += (Math.random() * variability) - (variability/2)
        nodeB.y += (Math.random() * variability) - (variability/2)
    }
    else if (d.dist < minDistance*1.1) {
        const overlap = minDistance - d.dist; // How much they overlap
        const pushX = (d.x / d.dist) * (overlap / 2); // Adjust both nodes equally
        const pushY = (d.y / d.dist) * (overlap / 2);
        // Move nodes apart
        nodeA.x += pushX;
        nodeA.y += pushY;
        nodeB.x -= pushX;
        nodeB.y -= pushY;
    }

};

/**
 * Applies repulsive forces between nodes using the spatial grid.
 */
const applyForces = (
    objects: CanvasObject[],
    connectedNodes: ConnectedNodes,
    forceAccumulators: { [id: string]: ForceAccumulator },
    params: LayoutParameters
): void => {
    // Calculate all pairwise forces
    for (let i = 0; i < objects.length; i++) {
        const obj1 = objects[i];
        
        for (let j = i + 1; j < objects.length; j++) {
            const obj2 = objects[j];
            const d = computeDistance(obj1.x, obj1.y, obj2.x, obj2.y);
            
            // Calculate repulsive force
            const areConnected = connectedNodes[obj1.id]?.has(obj2.id) ?? false; 
            const repulsiveForce = calculateRepulsiveForce(d.dist, areConnected, params);
            
            // Calculate attractive force if nodes are connected
            const attractiveForce = areConnected ? calculateAttractiveForce(d.dist, params) : 0;
            // Combine forces
            const totalForce = repulsiveForce - attractiveForce;
            const fx = (totalForce * d.x) / d.dist;
            const fy = (totalForce * d.y) / d.dist;

            resolveOverlap(obj1, obj2, d,params.minDistance)
            
            // Apply forces to both nodes
            forceAccumulators[obj1.id].fx += fx;
            forceAccumulators[obj1.id].fy += fy;
            forceAccumulators[obj2.id].fx -= fx;
            forceAccumulators[obj2.id].fy -= fy;
        }
    }
};

const applyGravity = (
    objects: CanvasObject[],
    boundingBox: { x: number; y: number; width: number; height: number },
    forceAccumulators: { [id: string]: ForceAccumulator },
    params: LayoutParameters
): void => {
    const centerX = boundingBox.x;
    const centerY = boundingBox.y;
    
    for (const obj of objects) {
        const dx = obj.x - centerX;
        const dy = obj.y - centerY;
        const dist = clamp(Math.sqrt(dx * dx + dy * dy), params.minDistance, 1000.0);
        const localGravity = params.gravityStrength * 
            (1.0 - clamp(dist / (Math.max(boundingBox.width, boundingBox.height) * 0.8), 0.1, 1.0));
        
        forceAccumulators[obj.id].fx += -localGravity * dx;
        forceAccumulators[obj.id].fy += -localGravity * dy;
    }
};

/**
 * Updates positions and velocities of objects based on accumulated forces.
 */
const updatePositions = (
    objects: CanvasObject[],
    forceAccumulators: { [id: string]: ForceAccumulator },
    boundingBox: { x: number; y: number; width: number; height: number },
    params: LayoutParameters
): void => {
    for (const obj of objects) {
        const accelX = forceAccumulators[obj.id].fx;
        const accelY = forceAccumulators[obj.id].fy;
        
        obj.vx = clamp((obj.vx + accelX) * params.damping, -params.maxVelocity, params.maxVelocity);
        obj.vy = clamp((obj.vy + accelY) * params.damping, -params.maxVelocity, params.maxVelocity);
        
        obj.x += obj.vx;
        obj.y += obj.vy;

        // Keep nodes within cell bounds
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
        { sumVx: 0, sumVy: 0 }
    );
    
    const avgVx = Math.max(sumVx / objects.length, 0.2);
    const avgVy = Math.max(sumVy / objects.length, 0.2);
    
    for (const obj of objects) {
        obj.vx -= avgVx;
        obj.vy -= avgVy;
    }
};

/**
 * Gently recenters the overall layout toward the canvas center if drift is excessive.
 */
const recenterPositions = (
    objects: CanvasObject[],
    centerX: number,
    centerY: number,
    params: LayoutParameters
): void => {
    const { sumX, sumY } = objects.reduce(
        (acc, obj) => {
            acc.sumX += obj.x;
            acc.sumY += obj.y;
            return acc;
        },
        { sumX: 0, sumY: 0 }
    );
    
    const avgX = sumX / objects.length;
    const avgY = sumY / objects.length;
    const driftX = centerX - avgX;
    const driftY = centerY - avgY;
    const driftDist = Math.sqrt(driftX * driftX + driftY * driftY);
    
    if (driftDist > params.recenterThreshold) {
        const offsetX = driftX * params.recenterFactor;
        const offsetY = driftY * params.recenterFactor;
        for (const obj of objects) {
            obj.x += offsetX;
            obj.y += offsetY;
        }
    }
};

export function simulate(
    objects: CanvasObject[],
    connectedNodes: ConnectedNodes,
    boundingBox: { x: number; y: number; width: number; height: number },
    params: LayoutParameters = DEFAULT_PARAMETERS
): CanvasObject[] {
    const forceAccumulators = objects.reduce(
        (acc, obj) => {
            acc[obj.id] = new ForceAccumulator();
            return acc;
        },
        {} as { [id: string]: ForceAccumulator }
    );

    applyForces(objects, connectedNodes, forceAccumulators, params);
    applyGravity(objects, boundingBox, forceAccumulators, params);
    updatePositions(objects, forceAccumulators, boundingBox, params);
    //removeNetMomentum(objects);
    //recenterPositions(objects, boundingBox.x, boundingBox.y, params);

    return objects;
}
