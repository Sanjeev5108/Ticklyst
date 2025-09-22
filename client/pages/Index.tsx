import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

interface Project {
  projectNo: string;
  client: string;
  description: string;
  auditPeriod: string;
  progressCompleted: number;
  status: 'completed' | 'in-progress';
}

const mockProjects: Project[] = [
  {
    projectNo: "PRJ-001",
    client: "Bull Machines India Pvt. LTD",
    description: "Financial audit and compliance review",
    auditPeriod: "Q1 2024",
    progressCompleted: 100,
    status: 'completed'
  },
  {
    projectNo: "PRJ-002",
    client: "Supreme Mobiles",
    description: "IT security assessment",
    auditPeriod: "Q2 2024",
    progressCompleted: 100,
    status: 'completed'
  },
  {
    projectNo: "PRJ-003",
    client: "Thalapakatti Hospitality Pvt. LTD",
    description: "Internal Audit",
    auditPeriod: "Q1 2024",
    progressCompleted: 100,
    status: 'completed'
  },
  {
    projectNo: "PRJ-004",
    client: "KTM",
    description: "Internal Audit",
    auditPeriod: "Q3 2024",
    progressCompleted: 75,
    status: 'in-progress'
  },
  {
    projectNo: "PRJ-005",
    client: "CPL",
    description: "Digital transformation audit",
    auditPeriod: "Q3 2024",
    progressCompleted: 45,
    status: 'in-progress'
  },
  {
    projectNo: "PRJ-006",
    client: "KMCH",
    description: "Infrastructure security review",
    auditPeriod: "Q4 2024",
    progressCompleted: 20,
    status: 'in-progress'
  }
];

export default function Index() {
  const [activeView, setActiveView] = useState<'completed' | 'in-progress'>('completed');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = mockProjects
    .filter(project => project.status === activeView)
    .filter(project => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        project.client.toLowerCase().includes(query) ||
        project.projectNo.toLowerCase().includes(query)
      );
    });

  const getProgressBadge = (progress: number) => {
    if (progress === 100) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">100%</Badge>;
    } else if (progress >= 75) {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{progress}%</Badge>;
    } else if (progress >= 50) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{progress}%</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{progress}%</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Hello <span className="text-blue-600">Sanjeev</span>
          </h1>
          <p className="text-slate-600">Manage your audit projects with ease</p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-white rounded-lg shadow-sm p-1 border">
            <Button
              variant={activeView === 'completed' ? 'default' : 'ghost'}
              onClick={() => setActiveView('completed')}
              className={`px-6 py-2 rounded-md transition-all duration-200 ${
                activeView === 'completed'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Completed
            </Button>
            <Button
              variant={activeView === 'in-progress' ? 'default' : 'ghost'}
              onClick={() => setActiveView('in-progress')}
              className={`px-6 py-2 rounded-md transition-all duration-200 ${
                activeView === 'in-progress'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              In Progress
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex justify-center mb-8">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <Input
              type="text"
              placeholder="Search by client name or project number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 w-full bg-white/80 backdrop-blur-sm border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl shadow-lg transition-all duration-200 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <span className="text-slate-400 hover:text-slate-600 transition-colors">
                  ✕
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Projects Table */}
        <Card className="shadow-xl bg-white/80 backdrop-blur-sm border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="text-xl font-semibold">
              {activeView === 'completed' ? 'Completed Projects' : 'In Progress Projects'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700 py-4">Project No.</TableHead>
                  <TableHead className="font-semibold text-slate-700">Client</TableHead>
                  <TableHead className="font-semibold text-slate-700">Project Description</TableHead>
                  <TableHead className="font-semibold text-slate-700">Audit Period</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center">Progress Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow
                    key={project.projectNo}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="font-medium text-blue-600 py-4">
                      {project.projectNo}
                    </TableCell>
                    <TableCell className="text-slate-700 font-medium">
                      {project.status === 'in-progress' ? (
                        <Link
                          to={`/client/${encodeURIComponent(project.client)}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                        >
                          {project.client}
                        </Link>
                      ) : (
                        project.client
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 max-w-xs">
                      {project.description}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {project.auditPeriod}
                    </TableCell>
                    <TableCell className="text-center">
                      {getProgressBadge(project.progressCompleted)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredProjects.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg">
                  {searchQuery
                    ? `No projects found matching "${searchQuery}"`
                    : `No ${activeView} projects found`
                  }
                </p>
                <p className="text-sm mt-2">
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'Check back later for updates'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {mockProjects.filter(p => p.status === 'completed').length}
              </div>
              <div className="text-green-700 font-medium">Completed Projects</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {mockProjects.filter(p => p.status === 'in-progress').length}
              </div>
              <div className="text-blue-700 font-medium">In Progress</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {mockProjects.length}
              </div>
              <div className="text-purple-700 font-medium">Total Projects</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
