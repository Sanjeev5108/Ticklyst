import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Database,
  Building2,
  Users,
  CheckSquare,
  BarChart3
} from 'lucide-react';

interface Industry {
  id: string;
  name: string;
  description: string;
  totalDepartments: number;
}

interface Department {
  id: string;
  name: string;
  description: string;
  totalQuestions: number;
}

interface ChecklistQuestion {
  id: string;
  question: string;
  department: string;
  industry: string[];
  isActive: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data
  const [industries] = useState<Industry[]>([
    { id: '1', name: 'Manufacturing', description: 'Manufacturing and production companies', totalDepartments: 8 },
    { id: '2', name: 'Milk & Dairy', description: 'Dairy and milk processing industry', totalDepartments: 6 },
    { id: '3', name: 'Technology', description: 'Software and IT companies', totalDepartments: 5 },
    { id: '4', name: 'Healthcare', description: 'Healthcare and medical services', totalDepartments: 7 }
  ]);

  const [departments] = useState<Department[]>([
    { id: '1', name: 'HR', description: 'Human Resources', totalQuestions: 150 },
    { id: '2', name: 'Purchase', description: 'Procurement and Purchasing', totalQuestions: 200 },
    { id: '3', name: 'Service', description: 'Customer Service and Support', totalQuestions: 120 },
    { id: '4', name: 'Finance', description: 'Financial Management', totalQuestions: 180 },
    { id: '5', name: 'IT', description: 'Information Technology', totalQuestions: 90 },
    { id: '6', name: 'Quality', description: 'Quality Assurance', totalQuestions: 160 }
  ]);

  const [checklistQuestions] = useState<ChecklistQuestion[]>([
    {
      id: '1',
      question: 'Are employee onboarding processes documented and followed?',
      department: 'HR',
      industry: ['Manufacturing', 'Technology'],
      isActive: true,
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      question: 'Is there a formal purchase order approval process?',
      department: 'Purchase',
      industry: ['Manufacturing', 'Milk & Dairy'],
      isActive: true,
      createdAt: '2024-01-16'
    },
    {
      id: '3',
      question: 'Are customer complaints tracked and resolved within SLA?',
      department: 'Service',
      industry: ['Technology', 'Healthcare'],
      isActive: true,
      createdAt: '2024-01-17'
    }
  ]);

  const stats = [
    { title: 'Total Industries', value: industries.length, icon: Building2, color: 'text-blue-600' },
    { title: 'Total Departments', value: departments.length, icon: Users, color: 'text-green-600' },
    { title: 'Checklist Questions', value: checklistQuestions.length, icon: CheckSquare, color: 'text-purple-600' },
    { title: 'Active Mappings', value: 45, icon: Database, color: 'text-orange-600' }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">New checklist questions added to Manufacturing/HR</p>
                <p className="text-sm text-gray-600">15 questions added by Admin</p>
              </div>
              <Badge>Today</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Healthcare industry mapping updated</p>
                <p className="text-sm text-gray-600">Quality department questions revised</p>
              </div>
              <Badge variant="secondary">Yesterday</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderIndustries = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Manage Industries</h2>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Industry
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search industries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Industry Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {industries.map((industry) => (
                <TableRow key={industry.id}>
                  <TableCell className="font-medium">{industry.name}</TableCell>
                  <TableCell>{industry.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{industry.totalDepartments} departments</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderDepartments = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Manage Departments</h2>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Total Questions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>{dept.description}</TableCell>
                  <TableCell>
                    <Badge>{dept.totalQuestions} questions</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderMasterChecklist = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Master Checklist Database</h2>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Question
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 mb-4">
            <Input
              placeholder="Search questions..."
              className="max-w-sm"
            />
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Industries</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checklistQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell className="max-w-xs">
                    <p className="truncate">{question.question}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{question.department}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {question.industry.map((ind, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {ind}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={question.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {question.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <Badge className="bg-red-100 text-red-800">Full Access</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="industries">Industries</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="checklist">Master Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">{renderOverview()}</TabsContent>
        <TabsContent value="industries">{renderIndustries()}</TabsContent>
        <TabsContent value="departments">{renderDepartments()}</TabsContent>
        <TabsContent value="checklist">{renderMasterChecklist()}</TabsContent>
      </Tabs>
    </div>
  );
}
