import { readdir, stat, watch, } from "node:fs/promises";
import { join } from "node:path";

// Define paths
const projectsDir = "./projects";
const staticDir = "./dist";

// Function to find all projects
async function getProjects() {
    const dirs = await readdir(projectsDir);
    return dirs.filter(async (dir) => (await stat(join(projectsDir, dir))).isDirectory());
}

// Function to build a project
async function buildProject(project: string) {
    console.log(`Building ${project}...`);
    const inputFile = join(projectsDir, project, "index.ts");
    const outDir = join(staticDir, project);

    // Run Bun build command
    const bunBuild = Bun.spawn(["bun", "build", inputFile, "--outdir", outDir]);
    return bunBuild.exited
}

// Watch projects and rebuild on change
async function watchProjects() {
    const projects = await getProjects();
    console.log(`Watching projects: ${projects.join(", ")}`);

    for(const project of projects) {
        const projectPath = join(projectsDir, project);
        const watcher = watch(projectPath, {recursive:true})
        
        for await (const event of watcher) {
            console.log(`Detected changes in ${project}, rebuilding...`);
            if (event.eventType === "change") await buildProject(project);
        }
    }
        
}


// Start the watcher
watchProjects().catch(console.error);