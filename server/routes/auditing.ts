import { RequestHandler } from "express";

// Interfaces for the auditing system
export interface Industry {
  id: string;
  name: string;
  description: string;
  departments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  totalQuestions: number;
  createdAt: string;
}

export interface ChecklistQuestion {
  id: string;
  question: string;
  department: string;
  industries: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  assignedTeam: string[];
  status: 'pending' | 'in-progress' | 'completed';
  startDate: string;
  dueDate: string;
  checklist: ChecklistItem[];
  createdBy: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  questionId: string;
  status: 'pending' | 'in-progress' | 'completed';
  comments: Comment[];
  assignedTo?: string;
  completedAt?: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  type: 'note' | 'issue' | 'resolution';
  timestamp: string;
}

// Mock data storage (in production, this would be a database)
let industries: Industry[] = [
  {
    id: "1",
    name: "Manufacturing",
    description: "Manufacturing and production companies",
    departments: ["HR", "Purchase", "Quality", "Finance"],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  },
  {
    id: "2",
    name: "Milk & Dairy",
    description: "Dairy and milk processing industry",
    departments: ["HR", "Purchase", "Quality", "Service"],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  }
];

let departments: Department[] = [
  { id: "1", name: "HR", description: "Human Resources", totalQuestions: 150, createdAt: "2024-01-01" },
  { id: "2", name: "Purchase", description: "Procurement and Purchasing", totalQuestions: 200, createdAt: "2024-01-01" },
  { id: "3", name: "Service", description: "Customer Service", totalQuestions: 120, createdAt: "2024-01-01" },
  { id: "4", name: "Quality", description: "Quality Assurance", totalQuestions: 160, createdAt: "2024-01-01" },
  { id: "5", name: "Finance", description: "Financial Management", totalQuestions: 180, createdAt: "2024-01-01" }
];

let checklistQuestions: ChecklistQuestion[] = [
  {
    id: "1",
    question: "Are employee onboarding processes documented and followed?",
    department: "HR",
    industries: ["Manufacturing", "Milk & Dairy"],
    isActive: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  },
  {
    id: "2",
    question: "Is there a formal purchase order approval process?",
    department: "Purchase",
    industries: ["Manufacturing", "Milk & Dairy"],
    isActive: true,
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01"
  }
];

let clients: Client[] = [
  {
    id: "1",
    name: "Bull Machines India Pvt. LTD",
    industry: "Manufacturing",
    contactPerson: "John Doe",
    email: "john@bullmachines.com",
    phone: "+91-9876543210",
    address: "Chennai, India",
    createdAt: "2024-01-01"
  }
];

let projects: Project[] = [];

// API Handlers

// Industries
export const getIndustries: RequestHandler = (req, res) => {
  res.json(industries);
};

export const createIndustry: RequestHandler = (req, res) => {
  const { name, description, departments } = req.body;
  const newIndustry: Industry = {
    id: Date.now().toString(),
    name,
    description,
    departments: departments || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  industries.push(newIndustry);
  res.status(201).json(newIndustry);
};

export const updateIndustry: RequestHandler = (req, res) => {
  const { id } = req.params;
  const industryIndex = industries.findIndex(i => i.id === id);
  
  if (industryIndex === -1) {
    return res.status(404).json({ error: "Industry not found" });
  }
  
  industries[industryIndex] = {
    ...industries[industryIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  res.json(industries[industryIndex]);
};

export const deleteIndustry: RequestHandler = (req, res) => {
  const { id } = req.params;
  industries = industries.filter(i => i.id !== id);
  res.status(204).send();
};

// Departments
export const getDepartments: RequestHandler = (req, res) => {
  res.json(departments);
};

export const createDepartment: RequestHandler = (req, res) => {
  const { name, description } = req.body;
  const newDepartment: Department = {
    id: Date.now().toString(),
    name,
    description,
    totalQuestions: 0,
    createdAt: new Date().toISOString()
  };
  departments.push(newDepartment);
  res.status(201).json(newDepartment);
};

// Checklist Questions
export const getChecklistQuestions: RequestHandler = (req, res) => {
  const { department, industry } = req.query;
  let filtered = checklistQuestions;
  
  if (department) {
    filtered = filtered.filter(q => q.department === department);
  }
  
  if (industry) {
    filtered = filtered.filter(q => q.industries.includes(industry as string));
  }
  
  res.json(filtered);
};

export const createChecklistQuestion: RequestHandler = (req, res) => {
  const { question, department, industries } = req.body;
  const newQuestion: ChecklistQuestion = {
    id: Date.now().toString(),
    question,
    department,
    industries: industries || [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  checklistQuestions.push(newQuestion);
  res.status(201).json(newQuestion);
};

// Clients
export const getClients: RequestHandler = (req, res) => {
  res.json(clients);
};

export const createClient: RequestHandler = (req, res) => {
  const { name, industry, contactPerson, email, phone, address } = req.body;
  const newClient: Client = {
    id: Date.now().toString(),
    name,
    industry,
    contactPerson,
    email,
    phone,
    address,
    createdAt: new Date().toISOString()
  };
  clients.push(newClient);
  res.status(201).json(newClient);
};

// Projects
export const getProjects: RequestHandler = (req, res) => {
  res.json(projects);
};

export const createProject: RequestHandler = (req, res) => {
  const { name, clientId, assignedTeam, startDate, dueDate, checklistQuestionIds, createdBy } = req.body;
  
  const checklist: ChecklistItem[] = checklistQuestionIds.map((questionId: string) => ({
    id: Date.now().toString() + Math.random(),
    questionId,
    status: 'pending' as const,
    comments: []
  }));
  
  const newProject: Project = {
    id: Date.now().toString(),
    name,
    clientId,
    assignedTeam: assignedTeam || [],
    status: 'pending',
    startDate,
    dueDate,
    checklist,
    createdBy,
    createdAt: new Date().toISOString()
  };
  
  projects.push(newProject);
  res.status(201).json(newProject);
};

// Comments
export const addComment: RequestHandler = (req, res) => {
  const { projectId, checklistItemId } = req.params;
  const { content, type, author } = req.body;
  
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  
  const checklistItem = project.checklist.find(item => item.id === checklistItemId);
  if (!checklistItem) {
    return res.status(404).json({ error: "Checklist item not found" });
  }
  
  const newComment: Comment = {
    id: Date.now().toString(),
    author,
    content,
    type: type || 'note',
    timestamp: new Date().toISOString()
  };
  
  checklistItem.comments.push(newComment);
  res.status(201).json(newComment);
};
