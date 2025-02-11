import os

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jinja2 import Environment, FileSystemLoader, select_autoescape

from projects.force_directed_grid.force_directed_grid import websocket_endpoint

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
PROJECT_DIR = os.path.join(BASE_DIR, "projects")

env = Environment(
    loader=FileSystemLoader([TEMPLATES_DIR, PROJECT_DIR]),
    autoescape=select_autoescape(["html", "xml"]),
)

templates = Jinja2Templates(env=env)

# Decorate the function *after* defining it
app.websocket("/force_directed_grid/ws")(websocket_endpoint)
app.mount("/dist", StaticFiles(directory=DIST_DIR), name="dist")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="dist")


def get_projects(dir: str):
    """Retrieve project directories from dir"""
    return [d for d in os.listdir(PROJECT_DIR) if os.path.isdir(os.path.join(dir, d))]


templates.env.globals["nav"] = get_projects(PROJECT_DIR)


@app.get(path="/projects/{project}/", response_class=HTMLResponse)
async def render_page(request: Request, project: str):
    print(f"hit on {project}")
    project_path = os.path.join(PROJECT_DIR, project, "index.html")
    if os.path.exists(project_path):
        return templates.TemplateResponse(f"{project}/index.html", {"request": request})
    else:
        return HTMLResponse(content="<h1> Page Not Found</h1>", status_code=404)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("__main__:app", host="0.0.0.0", port=8000, reload=True)
