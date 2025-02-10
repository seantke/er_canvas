from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles

from generate_nodes import NodeGenerationConfig, generate_node_relationships

app = FastAPI()


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        config = NodeGenerationConfig(
            total_nodes=200, isolated_percentage=2, max_group_size=20, min_group_size=4
        )

        result = generate_node_relationships(config)
        num_groups = len(result.groups.keys())
        height = max((num_groups // 2) * 500, 500)
        initial_data = {
            "objects": [node.to_dict() for node in result.nodes],
            "edges": result.edges,
            "width": 1,
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
