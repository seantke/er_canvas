import random
from typing import List, Tuple

from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles

app = FastAPI()


class Object:
    def __init__(
        self, id: str, x: float, y: float, width: float, height: float, color: str
    ):
        self.id = id
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.color = color
        self.vx = 0.01
        self.vy = 0.01

    def to_dict(self):
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "color": self.color,
        }


# Global variables
objects: List[Object] = []
graph_edges: List[Tuple[str, str]] = []
connection_probability = 0.01  # 2% chance of connection


def init_objects(num_objects: int, width: float, height: float):
    global objects, graph_edges
    objects = []

    # Create objects - now just randomly positioned and sized initially
    for i in range(num_objects):
        x = random.uniform(width * 0.3, width * 0.7)  # Random x position
        y = random.uniform(height * 0.3, height * 0.7)  # Random y position

        objects.append(
            Object(
                id=f"obj{i}",
                x=x,
                y=y,
                width=10,  # Initial width
                height=10,  # Initial height
                color="hsl(240, 70%, 50%)",  # Default color
            )
        )

    init_probability_based_edges(objects)


def init_probability_based_edges(objects: List[Object]):
    global graph_edges
    graph_edges = []
    num_objects = len(objects)

    for i in range(num_objects):
        for j in range(i + 1, num_objects):
            if random.random() < connection_probability:
                edge = (f"obj{i}", f"obj{j}")
                graph_edges.append(edge)


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        ratio = 16 / 9
        height = 1000
        width = height * ratio
        num_objects = 150
        init_objects(num_objects, width, height)  # Initialize objects and edges

        initial_data = {
            "objects": [obj.to_dict() for obj in objects],
            "edges": graph_edges,
            "width": width,
            "height": height,
        }
        await websocket.send_json(initial_data)  # Send initial data once

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()


app.websocket("/ws")(websocket_endpoint)  # Decorate the function *after* defining it

app.mount("/", StaticFiles(directory="./static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("__main__:app", host="0.0.0.0", port=8000, reload=True)
