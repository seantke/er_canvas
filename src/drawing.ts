import type { CanvasObject, GraphEdge } from "./types";
import { CanvasLayoutManager } from "./canvas_layout_manager";
const canvas = document.querySelector("#simulationCanvas") as HTMLCanvasElement | null;
const ctx = canvas?.getContext("2d", {alpha:false}) as CanvasRenderingContext2D | null;

export function resizeCanvas(cw = 1400, ch = 900) {
    if (!ctx || !canvas) throw new Error("Canvas context not found");
    canvas.width = cw;
    canvas.height = ch;
    
    // Return dimensions for the layout manager
    return { width: cw, height: ch };
}

interface RenderOptions {
    showBoundingBoxes?: boolean;
    debug?: boolean;
}

export function drawFrame(
    layoutManager: CanvasLayoutManager,
    options: RenderOptions = {}
) {
    if (!ctx || !canvas) throw new Error("Canvas context not found");

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    // Draw rectangle centered at obj.x, obj.y
    ctx.rect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = "hsl(0, 0.00%, 20%)";
    ctx.fill();

    // Access subgraphs through the layout manager
    const subgraphs = layoutManager.subgraphs;
    for (const subgraph of subgraphs) {
        const objects = subgraph.objects;
        const graphEdges = subgraph.graphEdges;
        // Draw edges first (behind nodes)
        drawEdges(objects, graphEdges);

        // Draw nodes
        drawNodes(objects);

        // Draw bounding boxes if requested
        if (layoutManager && options.showBoundingBoxes) {
            drawBoundingBoxes(layoutManager);
        }

        // Draw debug information if requested
        if (options.debug) {
            drawDebugInfo(objects, layoutManager);
        }
    }
}

function drawEdges(objects: CanvasObject[], graphEdges: GraphEdge[]) {
    if (!ctx) return;

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

function drawNodes(objects: CanvasObject[]) {
    if (!ctx) return;

    for (const obj of objects) {
        ctx.beginPath();
        // Draw rectangle centered at obj.x, obj.y
        ctx.rect(
            obj.x - obj.width / 2,
            obj.y - obj.height / 2,
            obj.width,
            obj.height
        );
        ctx.fillStyle = `hsl(${obj.color}, 50%, 90%)`;
        ctx.fill();

        ctx.strokeStyle = `hsl(${obj.color}, 50%, 60%)`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function drawBoundingBoxes(layoutManager: CanvasLayoutManager) {
    if (!ctx) return;

    // Access subgraphs through the layout manager
    const subgraphs = layoutManager.subgraphs;

    for (const subgraph of subgraphs) {
        const { x, y, width, height } = subgraph.boundingBox;

        // Draw subgraph bounding box
        ctx.beginPath();
        ctx.rect(
            x - width / 2,
            y - height / 2,
            width,
            height
        );
        ctx.strokeStyle = subgraph.isSmallGraph ? "rgba(255, 165, 0, 0.3)" : "rgba(0, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function drawDebugInfo(objects: CanvasObject[], layoutManager?: CanvasLayoutManager) {
    if (!ctx) return;

    ctx.font = "14px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";

    // Draw node IDs
    for (const obj of objects) {
        ctx.fillText(obj.id, obj.x + obj.width / 2 + 5, obj.y);
    }

    if (layoutManager) {
        const subgraphs = layoutManager.subgraphs;
        
        // Draw subgraph information
        for (const subgraph of subgraphs) {
            const { x, y, width } = subgraph.boundingBox;
            const info = `${subgraph.objects.length} nodes${subgraph.isSmallGraph ? " (small)" : ""}`;
            ctx.fillText(info, x - width / 2, y - 10);
        }
    }
}

// New initialization function to set up both canvas and layout manager
export function initializeCanvas(width = 1400, height = 900) {
    const dimensions = resizeCanvas(width, height);
    return new CanvasLayoutManager(dimensions.width, dimensions.height);
}