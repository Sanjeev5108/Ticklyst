import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  getIndustries,
  createIndustry,
  updateIndustry,
  deleteIndustry,
  getDepartments,
  createDepartment,
  getChecklistQuestions,
  createChecklistQuestion,
  getClients,
  createClient,
  getProjects,
  createProject,
  addComment
} from "./routes/auditing";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auditing System API Routes

  // Industries
  app.get("/api/industries", getIndustries);
  app.post("/api/industries", createIndustry);
  app.put("/api/industries/:id", updateIndustry);
  app.delete("/api/industries/:id", deleteIndustry);

  // Departments
  app.get("/api/departments", getDepartments);
  app.post("/api/departments", createDepartment);

  // Checklist Questions
  app.get("/api/checklist-questions", getChecklistQuestions);
  app.post("/api/checklist-questions", createChecklistQuestion);

  // Clients
  app.get("/api/clients", getClients);
  app.post("/api/clients", createClient);

  // Projects
  app.get("/api/projects", getProjects);
  app.post("/api/projects", createProject);

  // Comments
  app.post("/api/projects/:projectId/checklist/:checklistItemId/comments", addComment);

  return app;
}
