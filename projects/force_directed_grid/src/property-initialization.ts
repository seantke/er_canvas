import type {CanvasObject, ConnectedNodes } from "./types";

export function calculateObjectProperties(num_connections: number) {
    // Size scaling (rectangle dimensions) - JS side calculation
    const minSize = 10;
    const maxSize = 30;
    const sizeRange = maxSize - minSize;
    const connectionRatio = Math.min(1.0, num_connections / 5);
    const weight = Math.max(1, Math.min(num_connections**2, 100));
    const size = minSize + sizeRange * connectionRatio;

    // Color scaling (blue to red gradient) - JS side calculation
    const hue = 300 - Math.max(10, Math.min(connectionRatio * 290, 290));
    const saturation = 70;
    const lightness = 50;
    const color = `${hue}`;

    return { width: size, height: size, color: color, weight: weight };
}

export function initializeGraphProperties(objects: CanvasObject[], connectedNodes:ConnectedNodes): CanvasObject[] {
    return objects.map((obj) => {
        const props = calculateObjectProperties(connectedNodes[obj.id].size)
        return {
            ...obj,
            width: props.width,
            height: props.height,
            color: props.color,
            weight:props.weight
        };
    });
}
