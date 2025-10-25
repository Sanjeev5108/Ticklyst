import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import NewProjectDialog from '@/components/NewProjectDialog';
import { FieldworkStore } from '@/contexts/FieldworkStore';
import { FieldworkRecord } from '@shared/fieldwork';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Pause,
  Filter,
  Grid3x3,
  List,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectDetails {
  division: string;
  auditType: string;
  description: string;
  divisionHeads: string[];
  partners: string[];
  teamLeaders: string[];
  teamMembers: string[];
  auditUniverse: string[];
  scopeNotes: string;
  reportingFrequency: string;
  emailNotifications: boolean;
}

interface Project {
  id: string;
  projectCode: string;
  title: string;
  client: string;
  status: 'todo' | 'in-progress' | 'hold';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  startDate: string;
  endDate: string;
  teamMembers: Array<{
    id: string;
    name: string;
    avatar?: string;
    initials: string;
  }>;
  category: string;
  priority: 'high' | 'medium' | 'low';
  details?: ProjectDetails;
}

const mockProjects: Project[] = [
  {
    id: '1',
    projectCode: '2024-2025 001',
    title: 'SQ/25-26/0135 - Customisation T...',
    client: 'Pharma Care Limited',
    status: 'todo',
    progress: 0,
    totalTasks: 8,
    completedTasks: 0,
    startDate: '2024-01-15',
    endDate: '2024-03-15',
    teamMembers: [
      { id: '1', name: 'John Doe', initials: 'JD' },
      { id: '2', name: 'Jane Smith', initials: 'JS' }
    ],
    category: 'Customisation',
    priority: 'medium'
  },
  {
    id: '2',
    projectCode: '2024-2025 002',
    title: 'SQ/25-26/0150 - Customisation T...',
    client: 'MORGANS FOODS PRIVATE LIMITED',
    status: 'todo',
    progress: 0,
    totalTasks: 1,
    completedTasks: 0,
    startDate: '2024-01-20',
    endDate: '2024-04-20',
    teamMembers: [
      { id: '3', name: 'Mike Wilson', initials: 'MW' }
    ],
    category: 'Customisation',
    priority: 'low'
  },
  {
    id: '3',
    projectCode: '2024-2025 003',
    title: 'CA Articles Training',
    client: 'Internal Training',
    status: 'todo',
    progress: 0,
    totalTasks: 1,
    completedTasks: 0,
    startDate: '2024-02-01',
    endDate: '2024-02-28',
    teamMembers: [
      { id: '4', name: 'Emily Davis', initials: 'ED' }
    ],
    category: 'Training',
    priority: 'high'
  },
  {
    id: '4',
    projectCode: '2024-2025 004',
    title: 'Reshmi - Customisation',
    client: 'Reshmi Industries (India) Private Limited',
    status: 'in-progress',
    progress: 65,
    totalTasks: 23,
    completedTasks: 15,
    startDate: '2024-01-01',
    endDate: '2024-05-23',
    teamMembers: [
      { id: '5', name: 'Alex Johnson', initials: 'AJ' },
      { id: '6', name: 'Sarah Brown', initials: 'SB' }
    ],
    category: 'Customisation',
    priority: 'high'
  },
  {
    id: '5',
    projectCode: '2024-2025 005',
    title: 'Artika VII - Customisation',
    client: 'ARTIKA COTTON MILLS',
    status: 'in-progress',
    progress: 45,
    totalTasks: 18,
    completedTasks: 8,
    startDate: '2024-01-10',
    endDate: '2024-04-25',
    teamMembers: [
      { id: '7', name: 'David Lee', initials: 'DL' }
    ],
    category: 'Customisation',
    priority: 'medium'
  },
  {
    id: '6',
    projectCode: '2024-2025 006',
    title: 'SQ/25-26/0086 - Prashanthi Cust...',
    client: 'WESTRADE FUTURE PRIVATE LIMITED',
    status: 'in-progress',
    progress: 80,
    totalTasks: 12,
    completedTasks: 10,
    startDate: '2024-01-05',
    endDate: '2024-03-30',
    teamMembers: [
      { id: '8', name: 'Lisa Wang', initials: 'LW' },
      { id: '9', name: 'Tom Chen', initials: 'TC' }
    ],
    category: 'Customisation',
    priority: 'high'
  },
  {
    id: '7',
    projectCode: '2024-2025 007',
    title: 'SQ/25-26/0168 - RMCL CCA June...',
    client: 'Roots Multiclean Ltd',
    status: 'hold',
    progress: 25,
    totalTasks: 7,
    completedTasks: 2,
    startDate: '2024-02-05',
    endDate: '2024-06-30',
    teamMembers: [
      { id: '10', name: 'Kevin Park', initials: 'KP' }
    ],
    category: 'Audit & Assurance',
    priority: 'medium'
  },
  {
    id: '8',
    projectCode: '2024-2025 008',
    title: 'KSS Event ABC',
    client: 'Astral Business Consulting LLP',
    status: 'hold',
    progress: 15,
    totalTasks: 1,
    completedTasks: 0,
    startDate: '2024-01-25',
    endDate: '2024-04-15',
    teamMembers: [
      { id: '11', name: 'Amy Taylor', initials: 'AT' }
    ],
    category: 'Event Management',
    priority: 'low'
  },
  {
    id: '9',
    projectCode: '2024-2025 009',
    title: 'SQ/25-26/0059 - MMD IA April 2...',
    client: 'Milky Mist Dairy Food Ltd',
    status: 'hold',
    progress: 40,
    totalTasks: 1,
    completedTasks: 0,
    startDate: '2024-02-10',
    endDate: '2024-05-15',
    teamMembers: [
      { id: '12', name: 'Chris Martin', initials: 'CM' },
      { id: '13', name: 'Priya Patel', initials: 'PP' }
    ],
    category: 'Internal Audit',
    priority: 'high'
  }
];

const getCategoryColor = (category: string) => {
  const colors = {
    'Customisation': 'bg-green-100 text-green-800',
    'Audit & Assurance': 'bg-blue-100 text-blue-800',
    'Training': 'bg-purple-100 text-purple-800',
    'Event Management': 'bg-orange-100 text-orange-800',
    'Internal Audit': 'bg-red-100 text-red-800'
  };
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export default function ProjectManagement() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [fwRecords, setFwRecords] = useState<Record<string, FieldworkRecord>>({});

  const ROLE_PROJECT_SCOPE_KEY = 'roleProjectScope';
  const getRoleProjectScope = (role?: string) => {
    try {
      const raw = localStorage.getItem(ROLE_PROJECT_SCOPE_KEY);
      if (!raw) return undefined;
      const map = JSON.parse(raw) as Record<string,string>;
      return role ? map[role] : map;
    } catch { return undefined; }
  };

  const isUserOnProject = (project: Project) => {
    if (!user) return false;
    const uname = user.username || '';
    const initials = uname.split(' ').map(s=>s[0]).join('');
    return project.teamMembers.some(tm => tm.name === uname || tm.initials === initials);
  };

  React.useEffect(() => { const unsub = FieldworkStore.subscribe(() => setFwRecords(FieldworkStore.getAll())); setFwRecords(FieldworkStore.getAll()); return () => unsub(); }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('load_failed');
        const rows = await res.json();
        const mapped: Project[] = rows.map((r: any) => ({
          id: r.id,
          projectCode: r.code || r.data?.projectCode || '',
          title: r.name || r.data?.projectName || '',
          client: r.clientName || r.data?.clientName || '',
          status: (r.status as any) || 'todo',
          progress: 0,
          totalTasks: 1,
          completedTasks: 0,
          startDate: r.startDate || r.data?.startDate || '',
          endDate: r.endDate || r.data?.endDate || '',
          teamMembers: (r.data?.divisionHeads || []).map((name: string, i: number) => ({ id: `dh-${i}`, name, initials: name.split(' ').map((n:string)=>n[0]).join('') }))
            .concat((r.data?.partners || []).map((name: string, i: number) => ({ id: `p-${i}`, name, initials: name.split(' ').map((n:string)=>n[0]).join('') })))
            .concat((r.data?.teamLeaders || []).map((name: string, i: number) => ({ id: `tl-${i}`, name, initials: name.split(' ').map((n:string)=>n[0]).join('') })))
            .concat((r.data?.teamMembers || []).map((name: string, i: number) => ({ id: `tm-${i}`, name, initials: name.split(' ').map((n:string)=>n[0]).join('') }))),
          category: r.data?.auditType || 'General',
          priority: 'medium',
          details: {
            division: r.data?.division || '',
            auditType: r.data?.auditType || '',
            description: r.data?.projectDescription || '',
            divisionHeads: r.data?.divisionHeads || [],
            partners: r.data?.partners || [],
            teamLeaders: r.data?.teamLeaders || [],
            teamMembers: r.data?.teamMembers || [],
            auditUniverse: r.data?.auditUniverse || [],
            scopeNotes: r.data?.scopeNotes || '',
            reportingFrequency: r.data?.reportingFrequency || '',
            emailNotifications: !!r.data?.emailNotifications,
            checklistTemplate: r.data?.checklistTemplate || [],
            customChecklistItems: r.data?.customChecklistItems || '',
            selectedChecklistTree: r.data?.selectedChecklistTree || null,
            riskConfig: r.data?.riskConfig || null,
          }
        }));
        setProjects(mapped);
      } catch {}
    })();
  }, []);

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) || project.client.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    const scope = getRoleProjectScope(user?.role);
    if (!scope || scope === 'all') return true;
    if (scope === 'own') return isUserOnProject(project);
    return true;
  });

  const todoProjects = filteredProjects.filter(p => p.status === 'todo');
  const inProgressProjects = filteredProjects.filter(p => p.status === 'in-progress');
  const holdProjects = filteredProjects.filter(p => p.status === 'hold');

  const handleCreateProject = async (projectData: any) => {
    // If projectData provides a projectCode (from dialog), prefer it; otherwise generate
    let projectCode = projectData.projectCode;
    if (!projectCode) {
      const sd = projectData.startDate ? new Date(projectData.startDate) : new Date();
      const month = sd.getMonth();
      const year = sd.getFullYear();
      const fyStart = month >= 3 ? year : year - 1; // fiscal year starting April
      const fyString = `${fyStart}-${fyStart + 1}`;
      const existingCount = projects.filter(p => p.projectCode && p.projectCode.startsWith(fyString)).length;
      const seq = String(existingCount + 1).padStart(3, '0');
      projectCode = `${fyString} ${seq}`;
    }

    const newProject: Project = {
      id: Date.now().toString(),
      projectCode,
      title: projectData.projectName,
      client: projectData.clientName,
      status: 'in-progress',
      progress: 0,
      totalTasks: 1,
      completedTasks: 0,
      startDate: projectData.startDate ? projectData.startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: projectData.endDate ? projectData.endDate.toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      teamMembers: [
        ...projectData.divisionHeads.map((name: string, index: number) => ({
          id: `dh-${index}`,
          name,
          initials: name.split(' ').map(n => n[0]).join('')
        })),
        ...projectData.partners.map((name: string, index: number) => ({
          id: `p-${index}`,
          name,
          initials: name.split(' ').map(n => n[0]).join('')
        })),
        ...projectData.teamLeaders.map((name: string, index: number) => ({
          id: `tl-${index}`,
          name,
          initials: name.split(' ').map(n => n[0]).join('')
        })),
        ...projectData.teamMembers.map((name: string, index: number) => ({
          id: `tm-${index}`,
          name,
          initials: name.split(' ').map(n => n[0]).join('')
        }))
      ],
      category: projectData.auditType || 'General',
      priority: 'medium',
      details: {
        division: projectData.division || '',
        auditType: projectData.auditType || '',
        description: projectData.projectDescription || '',
        divisionHeads: projectData.divisionHeads || [],
        partners: projectData.partners || [],
        teamLeaders: projectData.teamLeaders || [],
        teamMembers: projectData.teamMembers || [],
        auditUniverse: projectData.auditUniverse || [],
        scopeNotes: projectData.scopeNotes || '',
        reportingFrequency: projectData.reportingFrequency || '',
        emailNotifications: !!projectData.emailNotifications,
        checklistTemplate: projectData.checklistTemplate || [],
        customChecklistItems: projectData.customChecklistItems || '',
        selectedChecklistTree: projectData.selectedChecklistTree || null,
        riskConfig: projectData.riskConfig || null,
      }
    };

    try {
      await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...projectData, id: newProject.id, status: 'in-progress' }) });
    } catch {}
    setProjects(prev => [...prev, newProject]);
  };

  const openDetails = (p: Project) => { setSelectedProject(p); setIsDetailsOpen(true); };
  const openEdit = (p: Project) => { setSelectedProject(p); setIsEditOpen(true); };

  const mapProjectToFormData = (p: Project) => ({
    projectName: p.title,
    projectCode: p.projectCode,
    clientName: p.client,
    division: p.details?.division || '',
    auditType: p.details?.auditType || p.category || '',
    projectDescription: p.details?.description || '',
    startDate: p.startDate ? new Date(p.startDate) : null,
    endDate: p.endDate ? new Date(p.endDate) : null,
    divisionHeads: p.details?.divisionHeads || [],
    partners: p.details?.partners || [],
    teamLeaders: p.details?.teamLeaders || [],
    teamMembers: p.details?.teamMembers || [],
    checklistTemplate: (p as any).details?.checklistTemplate || [],
    customChecklistItems: (p as any).details?.customChecklistItems || '',
    selectedChecklistTree: (p as any).details?.selectedChecklistTree || null,
    auditUniverse: p.details?.auditUniverse || [],
    scopeNotes: p.details?.scopeNotes || '',
    documents: [],
    references: '',
    emailNotifications: !!p.details?.emailNotifications,
    reportingFrequency: p.details?.reportingFrequency || '',
    auditCommentsModule: true,
    workflowStatus: 'Draft',
    changeLogsEnabled: true,
    riskConfig: (p as any).details?.riskConfig || null,
  });

  const handleEditSubmit = async (data: any) => {
    if (!selectedProject) return;
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? {
      ...p,
      title: data.projectName || p.title,
      projectCode: data.projectCode || p.projectCode,
      client: data.clientName || p.client,
      category: data.auditType || p.category,
      startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : p.startDate,
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : p.endDate,
      details: {
        division: data.division || p.details?.division || '',
        auditType: data.auditType || p.details?.auditType || '',
        description: data.projectDescription || p.details?.description || '',
        divisionHeads: data.divisionHeads || p.details?.divisionHeads || [],
        partners: data.partners || p.details?.partners || [],
        teamLeaders: data.teamLeaders || p.details?.teamLeaders || [],
        teamMembers: data.teamMembers || p.details?.teamMembers || [],
        auditUniverse: data.auditUniverse || p.details?.auditUniverse || [],
        scopeNotes: data.scopeNotes || p.details?.scopeNotes || '',
        reportingFrequency: data.reportingFrequency || p.details?.reportingFrequency || '',
        emailNotifications: !!data.emailNotifications,
        checklistTemplate: data.checklistTemplate || [],
        customChecklistItems: data.customChecklistItems || '',
        selectedChecklistTree: data.selectedChecklistTree || null,
        riskConfig: data.riskConfig || p.details?.riskConfig || null,
      }
    } : p));
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          id: selectedProject.id,
          status: selectedProject.status,
        })
      });
    } catch {}
    setIsEditOpen(false);
  };

  const updateProjectStatus = async (proj: Project, next: 'todo'|'in-progress'|'hold') => {
    setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, status: next } : p));
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: proj.id,
          projectCode: proj.projectCode,
          projectName: proj.title,
          clientName: proj.client,
          status: next,
          startDate: proj.startDate,
          endDate: proj.endDate,
          data: proj.details
        })
      });
    } catch {}
  };

  // Count total controls from project's selected checklist tree
  const countTotalControlsFromTree = (tree: any): number => {
    if (!tree || typeof tree !== 'object') return 0;
    let total = 0;
    try {
      for (const procNode of Object.values<any>(tree)) {
        const subs = (procNode && typeof procNode === 'object' && (procNode as any).subprocesses) || {};
        for (const subNode of Object.values<any>(subs)) {
          const acts = (subNode && typeof subNode === 'object' && (subNode as any).activities) || {};
          for (const actNode of Object.values<any>(acts)) {
            const risks = (actNode && typeof actNode === 'object' && (actNode as any).risks) || {};
            for (const riskNode of Object.values<any>(risks)) {
              const ctrls = Array.isArray((riskNode as any).controls) ? (riskNode as any).controls : [];
              total += ctrls.length;
            }
          }
        }
      }
    } catch {}
    return total;
  };

  // Derive progress from approved controls / total controls
  React.useEffect(() => {
    if (!projects.length) return;
    const approvedMap: Record<string, Set<string>> = {};
    for (const rec of Object.values(fwRecords || {})) {
      if (!rec || !rec.projectId) continue;
      if (rec.status === 'approved') {
        const set = approvedMap[rec.projectId] || (approvedMap[rec.projectId] = new Set<string>());
        set.add(rec.controlId);
      }
    }
    const next = projects.map(p => {
      const total = countTotalControlsFromTree((p as any).details?.selectedChecklistTree);
      const approvedRaw = approvedMap[p.id]?.size || 0;
      const approved = Math.min(approvedRaw, total);
      const progress = total > 0 ? Math.round((approved / total) * 100) : 0;
      const totalTasks = total;
      const completedTasks = approved;
      return progress === p.progress && totalTasks === p.totalTasks && completedTasks === p.completedTasks ? p : { ...p, progress, totalTasks, completedTasks };
    });
    let changed = false;
    for (let i=0;i<projects.length;i++) {
      if (projects[i] !== next[i]) { changed = true; break; }
    }
    if (changed) setProjects(next);
  }, [fwRecords, projects]);

  const ProjectCard = ({ project }: { project: Project }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div>
                <div className="text-xs text-gray-500">{project.projectCode}</div>
                <h4 className="font-medium text-sm text-gray-900 line-clamp-2">{project.title}</h4>
                <p className="text-xs text-gray-600 mt-1">{project.client}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openDetails(project)}>View details</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="More">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Set status</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => updateProjectStatus(project, 'todo')}>Completed</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateProjectStatus(project, 'in-progress')}>In Progress</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateProjectStatus(project, 'hold')}>Hold</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>{project.totalTasks} Controls</span>
            </div>
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <span>{project.completedTasks}/{project.totalTasks}</span>
            </div>
          </div>

          {/* Team Members */}
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {project.teamMembers.slice(0, 3).map((member) => (
                <Avatar key={member.id} className="h-6 w-6 border-2 border-white">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
              {project.teamMembers.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{project.teamMembers.length - 3}</span>
                </div>
              )}
            </div>
            <Badge className={`text-xs ${getCategoryColor(project.category)}`}>
              {project.category}
            </Badge>
          </div>

        </div>
      </CardContent>
    </Card>
  );

  const Column = ({ 
    title, 
    count, 
    projects, 
    icon: Icon, 
    color 
  }: { 
    title: string; 
    count: number; 
    projects: Project[];
    icon: React.ComponentType<any>;
    color: string;
  }) => (
    <div className="flex-1 min-w-0">
      <div className="bg-gray-50 rounded-lg p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-0 max-h-[calc(100vh-300px)] overflow-y-auto">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-600">Manage your project portfolio</p>
        </div>
        <Button
          className="flex items-center gap-2"
          onClick={() => setIsNewProjectOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'board' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('board')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'board' ? (
        <div className="flex gap-6 h-full">
          <Column
            title="Completed"
            count={todoProjects.length}
            projects={todoProjects}
            icon={CheckCircle2}
            color="text-green-600"
          />
          <Column
            title="In Progress"
            count={inProgressProjects.length}
            projects={inProgressProjects}
            icon={Clock}
            color="text-blue-600"
          />
          <Column
            title="Hold"
            count={holdProjects.length}
            projects={holdProjects}
            icon={Pause}
            color="text-orange-600"
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredProjects.map((project, index) => (
                <div
                  key={project.id}
                  className={`flex items-center justify-between p-4 hover:bg-gray-50 ${
                    index !== filteredProjects.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{project.title}</h3>
                      <p className="text-sm text-gray-500">{project.client}</p>
                    </div>
                    <div className="w-32">
                      <Progress value={project.progress} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">{project.progress}%</p>
                    </div>
                    <Badge className={getCategoryColor(project.category)}>
                      {project.category}
                    </Badge>
                    <div className="flex -space-x-1">
                      {project.teamMembers.slice(0, 3).map((member) => (
                        <Avatar key={member.id} className="h-6 w-6 border-2 border-white">
                          <AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => openDetails(project)}>View details</Button>
              </div>
            </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Project Details</DialogTitle>
              {selectedProject && (
                <Button size="sm" className="mr-2" onClick={() => openEdit(selectedProject)}>Edit</Button>
              )}
            </div>
          </DialogHeader>
          {selectedProject ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Project Code</div>
                  <div className="font-medium">{selectedProject.projectCode}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-medium">{selectedProject.status === 'completed' ? 'Completed' : selectedProject.status === 'in-progress' ? 'In Progress' : selectedProject.status === 'hold' ? 'Hold' : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Client</div>
                  <div className="font-medium">{selectedProject.client}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Project Name</div>
                  <div className="font-medium">{selectedProject.title}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Division</div>
                  <div className="font-medium">{selectedProject.details?.division || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Nature of Assignment</div>
                  <div className="font-medium">{selectedProject.details?.auditType || selectedProject.category}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Reporting Frequency</div>
                  <div className="font-medium">{selectedProject.details?.reportingFrequency || '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Project Description</div>
                <div className="font-medium whitespace-pre-wrap">{selectedProject.details?.description || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Start Date</div>
                  <div className="font-medium">{new Date(selectedProject.startDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">End Date</div>
                  <div className="font-medium">{new Date(selectedProject.endDate).toLocaleDateString()}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-1">Progress completed</div>
                <div className="flex items-center gap-3">
                  <Progress value={selectedProject.progress} className="h-2 w-64" />
                  <span className="text-sm font-medium">{selectedProject.progress}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Division Heads</div>
                  <div className="text-sm">{(selectedProject.details?.divisionHeads || []).join(', ') || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Partners</div>
                  <div className="text-sm">{(selectedProject.details?.partners || []).join(', ') || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Team Leaders</div>
                  <div className="text-sm">{(selectedProject.details?.teamLeaders || []).join(', ') || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Team Members</div>
                  <div className="text-sm">{(selectedProject.details?.teamMembers || []).join(', ') || '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Audit Universe</div>
                <div className="text-sm">{(selectedProject.details?.auditUniverse || []).join(', ') || '-'}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Scope & Checklist</div>
                {(() => {
                  const tree: any = (selectedProject as any).details?.selectedChecklistTree;
                  if (!tree || typeof tree !== 'object' || Object.keys(tree).length === 0) {
                    return <div className="text-sm">-</div>;
                  }
                  const renderControls = (controls: string[], prefix: string) => (
                    <div className="space-y-1">
                      {controls.map((ctrl, i) => (
                        <div key={`${prefix}|${ctrl}|${i}`} className="flex items-center gap-2 pl-8">
                          <Checkbox checked disabled aria-readonly className="h-3.5 w-3.5" />
                          <span className="text-sm">{ctrl}</span>
                        </div>
                      ))}
                    </div>
                  );
                  const items: JSX.Element[] = [];
                  Object.entries<any>(tree).forEach(([procName, procVal]) => {
                    items.push(
                      <div key={`proc|${procName}`} className="mt-2">
                        <div className="text-sm font-medium text-blue-800">{procName}</div>
                      </div>
                    );
                    const subprocesses = (procVal && procVal.subprocesses) || {};
                    Object.entries<any>(subprocesses).forEach(([subName, subVal]) => {
                      items.push(
                        <div key={`sub|${procName}|${subName}`} className="pl-2">
                          <div className="text-sm font-medium text-emerald-800">{subName}</div>
                        </div>
                      );
                      const activities = (subVal && subVal.activities) || {};
                      Object.entries<any>(activities).forEach(([actName, actVal]) => {
                        items.push(
                          <div key={`act|${procName}|${subName}|${actName}`} className="pl-4">
                            <div className="text-sm font-medium text-amber-800">{actName}</div>
                          </div>
                        );
                        const risks = (actVal && actVal.risks) || {};
                        Object.entries<any>(risks).forEach(([riskName, riskVal]) => {
                          items.push(
                            <div key={`risk|${procName}|${subName}|${actName}|${riskName}`} className="pl-6">
                              <div className="text-sm font-medium text-red-800">{riskName}</div>
                              {Array.isArray(riskVal?.controls) && riskVal.controls.length > 0 && renderControls(riskVal.controls, `${procName}|${subName}|${actName}|${riskName}`)}
                            </div>
                          );
                        });
                      });
                    });
                  });
                  return <div className="mt-1 space-y-1">{items}</div>;
                })()}
              </div>

              <div>
                <div className="text-sm text-gray-500">Scope Notes</div>
                <div className="text-sm whitespace-pre-wrap">{selectedProject.details?.scopeNotes || '-'}</div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Project (6 steps) */}
      <NewProjectDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        mode="edit"
        initialData={selectedProject ? mapProjectToFormData(selectedProject) : undefined}
        onProjectEdit={handleEditSubmit}
      />

      {/* New Project Dialog */}
      <NewProjectDialog
        open={isNewProjectOpen}
        onOpenChange={setIsNewProjectOpen}
        onProjectCreate={handleCreateProject}
      />
    </div>
  );
}
