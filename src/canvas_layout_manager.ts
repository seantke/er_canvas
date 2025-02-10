import type { CanvasObject, GraphEdge } from "./types";
import { ConnectedNodes } from "./types";
import { simulate } from "./force-layout";
import { initializeGraphProperties } from "./property-initialization";

interface SubgraphData {
    objects: CanvasObject[];
    connections: ConnectedNodes;
    boundingBox: BoundingBox;
    graphEdges: GraphEdge[];
    isSmallGraph: boolean;
}

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class CanvasLayoutManager {
    private padding = 5;
    private minSubgraphSize = 400;
    private smallGraphSize = 400;
    public subgraphs: SubgraphData[] = [];
    constructor(
        private canvasWidth: number,
        private canvasHeight: number,
    ) {}

    public simulate(){
        // Simulate force-directed layout for each subgraph
        for (const subgraph of this.subgraphs) {
            simulate(subgraph.objects, subgraph.connections, subgraph.boundingBox)
        }
    }

    public layoutCanvas(initialObjects: CanvasObject[], initialEdges: GraphEdge[]): void {
        const graphEdges: GraphEdge[] = [];
        for (const edge of initialEdges) {
            graphEdges.push([edge[0], edge[1]]);
        }
        const connectedNodes = ConnectedNodes(initialObjects, graphEdges);
        const objects = initializeGraphProperties(initialObjects, connectedNodes);
        console.log("post-configuration objects:", objects);

        // Identify and separate subgraphs
        this.subgraphs = this.identifySubgraphs(objects, connectedNodes, graphEdges);

        // Calculate initial bounding boxes
        this.calculateSubgraphSizes();

        // Arrange subgraphs on canvas
        this.arrangeSubgraphs();
    }

    private identifySubgraphs(objects: CanvasObject[], connections: ConnectedNodes, graphEdgesGlobal:GraphEdge[]): SubgraphData[] {
        const visited = new Set<string>();
        const subgraphs: SubgraphData[] = [];
        const smallGraphNodes: CanvasObject[] = [];
        const graphEdges: GraphEdge[] = [];

        const findConnectedNodes = (startId: string): CanvasObject[] => {
            const connectedNodes: CanvasObject[] = [];
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

        // Process each unvisited node
        for (const obj of objects) {
            if (!visited.has(obj.id)) {
                const connectedNodes = findConnectedNodes(obj.id);

                // Handle small graphs separately
                if (connectedNodes.length <= 2 ) {
                    smallGraphNodes.push(...connectedNodes);
                } else {
                    subgraphs.push({
                        objects: connectedNodes,
                        connections: this.extractSubgraphConnections(connectedNodes, connections),
                        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
                        graphEdges: graphEdges,
                        isSmallGraph: false,
                    });
                }
            }
        }

        // Create a single subgraph for all small components if any exist
        if (smallGraphNodes.length > 0) {
            subgraphs.push({
                objects: smallGraphNodes,
                connections: this.extractSubgraphConnections(smallGraphNodes, connections),
                graphEdges: graphEdges,
                boundingBox: { x: 0, y: 0, width: 0, height: 0 },
                isSmallGraph: true,
            });
        }

        return subgraphs;
    }

    private extractSubgraphConnections(nodes: CanvasObject[], fullConnections: ConnectedNodes): ConnectedNodes {
        const subConnections: ConnectedNodes = {};
        const nodeIds = new Set(nodes.map((n) => n.id));

        for (const node of nodes) {
            subConnections[node.id] = new Set(
                Array.from(fullConnections[node.id] || []).filter((id) => nodeIds.has(id)),
            );
        }
        return subConnections;
    }

    private calculateSubgraphSizes(): void {
        for (const subgraph of this.subgraphs) {
            if (subgraph.isSmallGraph) {
                // Calculate size based on number of small components
                const nodeCount = subgraph.objects.length;
                const cols = Math.ceil(Math.sqrt(nodeCount));
                const rows = Math.ceil(nodeCount / cols);

                subgraph.boundingBox = {
                    x: 0,
                    y: 0,
                    width: cols * this.smallGraphSize + (cols - 1) * this.padding,
                    height: rows * this.smallGraphSize + (rows - 1) * this.padding,
                };
            } else {
                // Calculate size based on node count and connectivity
                const nodeCount = subgraph.objects.length;
                const baseSize = Math.max(this.minSubgraphSize, Math.sqrt(nodeCount) * 100);

                subgraph.boundingBox = {
                    x: 0,
                    y: 0,
                    width: baseSize,
                    height: baseSize,
                };
            }
        }
    }

    private arrangeSubgraphs(): void {
        if (this.subgraphs.length === 0) return;

        // Sort subgraphs by size (largest first)
        this.subgraphs.sort(
            (a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height,
        );

        // Calculate grid dimensions
        const totalArea = this.subgraphs.reduce((sum, sg) => sum + sg.boundingBox.width * sg.boundingBox.height, 0);
        const aspectRatio = this.canvasWidth / this.canvasHeight;
        const estimatedRows = Math.sqrt(totalArea / aspectRatio);
        const cols = Math.ceil(Math.sqrt(this.subgraphs.length * aspectRatio));
        const rows = Math.ceil(this.subgraphs.length / cols);

        // Calculate cell sizes and positions
        const cellWidth = (this.canvasWidth - (cols + 1) * this.padding) / cols;
        const cellHeight = (this.canvasHeight - (rows + 1) * this.padding) / rows;

        // Position subgraphs
        let currentRow = 0;
        let currentCol = 0;
        for (const subgraph of this.subgraphs) {
            // Calculate position
            const x = this.padding + currentCol * (cellWidth + this.padding) + cellWidth / 2;
            const y = this.padding + currentRow * (cellHeight + this.padding) + cellHeight / 2;

            // Scale subgraph to fit cell if necessary
            const scale = Math.min(
                (cellWidth - this.padding) / subgraph.boundingBox.width,
                (cellHeight - this.padding) / subgraph.boundingBox.height,
            );

            subgraph.boundingBox.width *= scale;
            subgraph.boundingBox.height *= scale;
            subgraph.boundingBox.x = x;
            subgraph.boundingBox.y = y;

            // Update node positions to match new bounding box
            if (subgraph.isSmallGraph) {
                this.layoutSmallGraph(subgraph);
            }

            // Move to next position
            currentCol++;
            if (currentCol >= cols) {
                currentCol = 0;
                currentRow++;
            }
        }
    }

    private layoutSmallGraph(subgraph: SubgraphData): void {
        const { objects, boundingBox } = subgraph;
        const cols = Math.ceil(Math.sqrt(objects.length));
        const smallGraphPadding = this.padding / 2;

        objects.forEach((obj, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            const cellSize =
                this.smallGraphSize *
                Math.min(
                    boundingBox.width / (cols * this.smallGraphSize + (cols - 1) * smallGraphPadding),
                    boundingBox.height /
                        (Math.ceil(objects.length / cols) * this.smallGraphSize +
                            (Math.ceil(objects.length / cols) - 1) * smallGraphPadding),
                );

            obj.x = boundingBox.x - boundingBox.width / 2 + col * (cellSize + smallGraphPadding) + cellSize / 2;
            obj.y = boundingBox.y - boundingBox.height / 2 + row * (cellSize + smallGraphPadding) + cellSize / 2;
        });
    }
}
