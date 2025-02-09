import type { CanvasObject, GraphEdge } from "./force-layout";

const canvas = document.querySelector("#simulationCanvas") as HTMLCanvasElement | null;
const ctx = canvas?.getContext("2d") as CanvasRenderingContext2D | null;

// Set canvas size
export function resizeCanvas(cw = 1400, ch = 900) {
    if (!ctx || !canvas) throw new Error("Canvas context not found");
    canvas.width = cw;
    canvas.height = ch;
}

export function drawFrame(objects: CanvasObject[], graph_edges: GraphEdge[]) {
    // Pass objects and edges as arguments
    if (!ctx || !canvas) throw new Error("Canvas context not found");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges first (behind nodes)
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

    // Draw nodes as rectangles
    for (const obj of objects) {
        ctx.beginPath();
        // Draw rectangle centered at obj.x, obj.y
        ctx.rect(obj.x - obj.width / 2, obj.y - obj.height / 2, obj.width, obj.height);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
