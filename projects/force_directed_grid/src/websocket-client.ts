export const websocket = new WebSocket("ws://localhost:8000/force_directed_grid/ws");

websocket.onopen = (event) => {
    console.log("WebSocket connection opened");
};

websocket.onerror = (event) => {
    console.error("WebSocket error:", event);
};

websocket.onclose = (event) => {
    console.log("WebSocket connection closed");
};
