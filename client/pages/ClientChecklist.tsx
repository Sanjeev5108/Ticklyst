import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, FolderOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'not-started';
  progressPercentage: number;
  auditPeriod: string;
}

interface ClientData {
  projectNo: string;
  client: string;
  description: string;
  auditPeriod: string;
  projects: Project[];
}

const clientData: Record<string, ClientData> = {
  "KTM": {
    projectNo: "PRJ-004",
    client: "KTM",
    description: "Internal Audit",
    auditPeriod: "Q3 2024",
    projects: [
      {
        id: "ktm-internal-audit",
        name: "Internal Audit Assessment",
        description: "Comprehensive internal audit covering financial and operational processes",
        status: "in-progress",
        progressPercentage: 75,
        auditPeriod: "Q3 2024"
      },
      {
        id: "ktm-compliance-review",
        name: "Compliance Review",
        description: "Review of regulatory compliance and governance frameworks",
        status: "not-started",
        progressPercentage: 0,
        auditPeriod: "Q4 2024"
      }
    ]
  },
  "CPL": {
    projectNo: "PRJ-005",
    client: "CPL",
    description: "Digital transformation audit",
    auditPeriod: "Q3 2024",
    projects: [
      {
        id: "cpl-digital-transformation",
        name: "Digital Transformation Audit",
        description: "Assessment of digital initiatives and technology adoption",
        status: "in-progress",
        progressPercentage: 45,
        auditPeriod: "Q3 2024"
      },
      {
        id: "cpl-cybersecurity",
        name: "Cybersecurity Assessment",
        description: "Evaluation of cybersecurity measures and data protection",
        status: "in-progress",
        progressPercentage: 60,
        auditPeriod: "Q3 2024"
      }
    ]
  },
  "KMCH": {
    projectNo: "PRJ-006",
    client: "KMCH",
    description: "Infrastructure security review",
    auditPeriod: "Q4 2024",
    projects: [
      {
        id: "kmch-infrastructure",
        name: "Infrastructure Security Review",
        description: "Comprehensive security assessment of IT infrastructure",
        status: "in-progress",
        progressPercentage: 20,
        auditPeriod: "Q4 2024"
      },
      {
        id: "kmch-network-security",
        name: "Network Security Audit",
        description: "Detailed network security and penetration testing",
        status: "not-started",
        progressPercentage: 0,
        auditPeriod: "Q1 2025"
      }
    ]
  }
};

export default function ClientChecklist() {
  const { clientName } = useParams<{ clientName: string }>();
  
  const client = clientData[clientName || ""];
  
  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Client Not Found</h2>
            <p className="text-slate-600 mb-4">The requested client could not be found.</p>
            <Link to="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalProgress = client.projects.reduce((sum, project) => sum + project.progressPercentage, 0) / client.projects.length;
  const completedProjects = client.projects.filter(p => p.status === 'completed').length;
  const inProgressProjects = client.projects.filter(p => p.status === 'in-progress').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'in-progress': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'not-started': return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'in-progress': return <Clock className="h-4 w-4" />;
      case 'not-started': return <FolderOpen className="h-4 w-4" />;
      default: return <FolderOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link to="/">
            <Button variant="outline" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{client.client}</h1>
            <p className="text-slate-600">{client.projectNo} • {client.description}</p>
          </div>
        </div>

        {/* Progress Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {Math.round(totalProgress)}%
                </div>
                <div className="text-slate-600">Average Progress</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {completedProjects}
                </div>
                <div className="text-slate-600">Completed Projects</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {inProgressProjects}
                </div>
                <div className="text-slate-600">In Progress</div>
              </div>
            </div>
            <div className="mt-6">
              <Progress value={totalProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-slate-600" />
              Audit Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.projects.map(project => (
              <Link
                key={project.id}
                to={`/client/${encodeURIComponent(clientName || '')}/project/${project.id}`}
                className="block"
              >
                <div className="p-6 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(project.status)}
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {project.name}
                        </h3>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <p className="text-slate-600 mb-3">
                        {project.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                          Audit Period: {project.auditPeriod}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-slate-700">
                            {project.progressPercentage}% Complete
                          </div>
                          <Progress value={project.progressPercentage} className="w-24 h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
