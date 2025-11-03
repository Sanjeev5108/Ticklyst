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
  deleteAllClients,
  getProjects,
  createProject,
  deleteAllProjects,
  addComment,
  updateClient
} from "./routes/auditing";
import { getEmployees, createEmployee, deleteAllEmployees, updateEmployee, setEmployeeStatus } from "./routes/employees";
import { login, forgotPassword, resetPassword } from "./routes/auth";
import { getSetting, setSetting } from "./routes/settings";
import { getFrameworkTree, createFrameworkNode, updateFrameworkNode, deleteFrameworkNode, downloadFrameworkTemplate, importFrameworkRows } from "./routes/framework";
import { initProjectProgressScheduler } from "./routes/auditing";
import { getAllFieldwork, getFieldworkById, upsertFieldwork, bulkUpsertFieldwork } from "./routes/fieldwork";

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

  // Employees (persisted to Postgres)
  app.get('/api/employees', getEmployees);
  app.post('/api/employees', createEmployee);
  app.put('/api/employees/:id', updateEmployee);
  app.patch('/api/employees/:id/status', setEmployeeStatus);
  app.delete('/api/employees', deleteAllEmployees);

  // Auth
  app.post('/api/auth/login', login);
  app.post('/api/auth/forgot', forgotPassword);
  app.post('/api/auth/reset', resetPassword);

  // Settings persistence
  app.get('/api/settings/:key', getSetting);
  app.post('/api/settings/:key', setSetting);

  // Framework
  app.get('/api/framework/tree', getFrameworkTree);
  app.post('/api/framework/nodes', createFrameworkNode);
  app.put('/api/framework/nodes/*', updateFrameworkNode);
  app.delete('/api/framework/nodes/*', deleteFrameworkNode);
  app.get('/api/framework/template', downloadFrameworkTemplate);
  app.post('/api/framework/import-rows', importFrameworkRows);

  // Fieldwork persistence
  app.get('/api/fieldwork', getAllFieldwork);
  app.get('/api/fieldwork/:id', getFieldworkById);
  app.put('/api/fieldwork/:id', upsertFieldwork);
  app.post('/api/fieldwork/bulk', bulkUpsertFieldwork);

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
  app.put('/api/clients/:id', updateClient);
  app.delete("/api/clients", deleteAllClients as any);

  // Projects
  app.get("/api/projects", getProjects);
  app.post("/api/projects", createProject);
  app.delete("/api/projects", deleteAllProjects);

  // Comments
  app.post("/api/projects/:projectId/checklist/:checklistItemId/comments", addComment);

  // Background schedulers
  initProjectProgressScheduler();

  return app;
}
