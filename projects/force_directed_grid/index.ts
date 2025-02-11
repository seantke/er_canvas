// index.ts
import { drawFrame, initializeCanvas } from "./src/drawing";
import { websocket } from "./src/websocket-client";
import type { CanvasLayoutManager } from "./src/canvas_layout_manager";

function simulateAndDraw(layoutManager: CanvasLayoutManager) {
    function drawLoop() {
        layoutManager.simulate();
        drawFrame(layoutManager, {
            showBoundingBoxes: false, // Optional: show subgraph boundaries
            debug: false, // Optional: show debug information
        });
        requestAnimationFrame(drawLoop);
    }
    requestAnimationFrame(drawLoop);
}

websocket.onmessage = (event) => {
    const initialData = JSON.parse(event.data);
    console.log("Initial data received:", initialData);
    const layoutManager = initializeCanvas(window.innerWidth-20, initialData.height);
    layoutManager.layoutCanvas(initialData.objects, initialData.edges);
    simulateAndDraw(layoutManager);
};