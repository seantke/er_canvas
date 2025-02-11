/**
 * Represents the accumulated force on a node.
 */
export class ForceAccumulator {
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
    public weight = 10;
    public color = "";
}

/**
 * A graph edge defined as a tuple of two node IDs.
 */
export type GraphEdge = [string, string];

/**
 * A mapping from node IDs to the set of IDs of connected nodes.
 */
//
export interface ConnectedNodes { [key: string]: Set<string> };

function getConnectedNodes(nodeId: string, graph_edges: GraphEdge[]) {
    const connected = new Set<string>();
    for (const edge of graph_edges) {
        if (edge.includes(nodeId)) {
            for (const node of edge) connected.add(node);
        }
    }
    connected.delete(nodeId);
    return connected;
}
export function ConnectedNodes(objects: CanvasObject[], graph_edges: GraphEdge[]): ConnectedNodes {
    const connections: ConnectedNodes = {};
    for (const obj of objects) {
        connections[obj.id] = getConnectedNodes(obj.id, graph_edges);
    }
    return connections;
}



// Keep these base constants but make them configurable per subgraph
export interface LayoutParameters {
    minDistance: number;
    maxVelocity: number;
    damping: number;
    padding: number;
    recenterThreshold: number;
    recenterFactor: number;
    gravityStrength: number;
    naturalLength: number;
    baseRepulsiveStrength: number;
}
