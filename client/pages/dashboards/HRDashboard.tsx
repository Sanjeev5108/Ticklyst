import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  Users,
  UserPlus,
  UserMinus,
  Mail,
  Shield,
  Filter as FilterIcon,
  Columns2,
  Rows3,
  Download
} from 'lucide-react';
import { UserRole } from '@/contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  division: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export default function HRDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for adding employee
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: '' as UserRole,
    division: '',
    password: ''
  });

  const [editEmployee, setEditEmployee] = useState({
    name: '',
    email: '',
    role: '' as UserRole,
    division: '',
    password: ''
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'inactive'>('all');
  const [filterDivisions, setFilterDivisions] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none'|'role'|'status'|'division'>('none');
  const allFields = ['Name','Email','Role','Division','Status','Last Login'] as const;
  const [selectedFields, setSelectedFields] = useState<string[]>([...allFields]);

  const roles: UserRole[] = ['Admin', 'HR', 'Division Partner', 'Division Head', 'Team Leader', 'Team Member'];
  const divisions = ['Audit & Assurance', 'Risk Advisory', 'Continuous Assurance Services', 'Cycle Count', 'Fixed Asset Management', 'Consulting', 'Best Accountant'];

  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('failed to fetch');
      const data = await res.json();
      setEmployees(data as Employee[]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const stats = [
    { title: 'Total Employees', value: employees.length, icon: Users, color: 'text-blue-600' },
    { title: 'Active Users', value: employees.filter(e => e.isActive).length, icon: UserPlus, color: 'text-green-600' },
    { title: 'Inactive Users', value: employees.filter(e => !e.isActive).length, icon: UserMinus, color: 'text-red-600' },
    { title: 'Division Heads', value: employees.filter(e => e.role === 'Division Head').length, icon: Shield, color: 'text-orange-600' },
    { title: 'Division Partners', value: employees.filter(e => e.role === 'Division Partner').length, icon: Shield, color: 'text-indigo-600' },
    { title: 'Team Leaders', value: employees.filter(e => e.role === 'Team Leader').length, icon: Shield, color: 'text-yellow-600' },
    { title: 'Team Members', value: employees.filter(e => e.role === 'Team Member').length, icon: Shield, color: 'text-purple-600' }
  ];

  const handleAddEmployee = async () => {
    try {
      const name = newEmployee.name?.trim();
      const email = newEmployee.email?.trim();
      const role = newEmployee.role;
      const pwd = newEmployee.password;
      const emailOk = /.+@.+\..+/.test(email || '');
      if (!name || !emailOk || !role || !pwd || pwd.length < 8) {
        toast({ title: 'Please fill all required fields', description: 'Name, Email (valid), Role, and Password (min 8) are mandatory.' });
        return;
      }
      const body = { name, email, role, division: newEmployee.division || null, password: pwd };
      const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        let msg = 'failed to create';
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
        toast({ title: 'Create failed', description: msg });
        return;
      }
      await loadEmployees();
      setNewEmployee({ name: '', email: '', role: '' as UserRole, division: '', password: '' });
      setIsAddEmployeeOpen(false);
      toast({ title: 'Employee created successfully' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Create failed' });
    }
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingId(emp.id);
    setEditEmployee({ name: emp.name, email: emp.email, role: emp.role, division: emp.division, password: '' });
    setIsEditEmployeeOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingId) { setIsEditEmployeeOpen(false); return; }
    try {
      const name = editEmployee.name?.trim();
      const email = editEmployee.email?.trim();
      const role = editEmployee.role;
      const pwd = editEmployee.password;
      const emailOk = /.+@.+\..+/.test(email || '');
      if (!name || !emailOk || !role || !pwd || pwd.length < 8) {
        toast({ title: 'Please fill all required fields', description: 'Name, Email (valid), Role, and Password (min 8) are mandatory.' });
        return;
      }
      const payload: any = { name, email, role, division: editEmployee.division || null, password: pwd };
      const res = await fetch(`/api/employees/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        let msg = 'failed to update';
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
        toast({ title: 'Update failed', description: msg });
        return;
      }
      setIsEditEmployeeOpen(false);
      setEditingId(null);
      setEditEmployee({ name: '', email: '', role: '' as UserRole, division: '', password: '' });
      await loadEmployees();
      toast({ title: 'Employee updated successfully' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Update failed' });
    }
  };

  const handleRemoveEmployee = async (id: string) => {
    try {
      const res = await fetch(`/api/employees/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      });
      if (!res.ok) {
        let msg = 'failed to purge';
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
        toast({ title: 'Purge failed', description: msg });
        return;
      }
      await loadEmployees();
      toast({ title: 'Employee purged' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Purge failed' });
    }
  };

  const handleReactivateEmployee = async (id: string) => {
    try {
      const res = await fetch(`/api/employees/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      });
      if (!res.ok) {
        let msg = 'failed to reactivate';
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch {}
        toast({ title: 'Reactivate failed', description: msg });
        return;
      }
      await loadEmployees();
      toast({ title: 'Employee reactivated' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Reactivate failed' });
    }
  };

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => {
      const matchesTerm = emp.name.toLowerCase().includes(term) || emp.email.toLowerCase().includes(term) || emp.role.toLowerCase().includes(term) || (emp.division||'').toLowerCase().includes(term);
      const matchesRole = !filterRoles.length || filterRoles.includes(emp.role);
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? emp.isActive : !emp.isActive);
      const matchesDivision = !filterDivisions.length || filterDivisions.includes(emp.division);
      return matchesTerm && matchesRole && matchesStatus && matchesDivision;
    });
  }, [employees, searchTerm, filterRoles, filterStatus, filterDivisions]);

  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<string,string> = {
      'Admin': 'bg-red-100 text-red-800',
      'HR': 'bg-blue-100 text-blue-800',
      'Division Partner': 'bg-purple-100 text-purple-800',
      'Division Head': 'bg-orange-100 text-orange-800',
      'Team Member': 'bg-green-100 text-green-800',
      'Team Leader': 'bg-yellow-100 text-yellow-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  const renderRoleDistribution = () => (
    <Card>
      <CardHeader>
        <CardTitle>Role Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roles.map(role => {
            const count = employees.filter(e => e.role === role && e.isActive).length;
            const pct = employees.length ? Math.round((count / employees.length) * 100) : 0;
            return (
              <div key={role} className="flex items-center justify-between">
                <span className="font-medium">{role}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderEmployees = () => (
    <div className="space-y-6">
      {/* Stats Cards (moved from Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          index === 0 ? (
            <Card key={index} className="cursor-pointer" onClick={() => setIsRoleDialogOpen(true)}>
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
          ) : (
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
          )
        ))}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Employee Management</h2>
        <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="role">Role <span className="text-red-500">*</span></Label>
                <Select 
                  value={newEmployee.role} 
                  onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="division">Division</Label>
                <Select
                  value={newEmployee.division}
                  onValueChange={(value) => setNewEmployee({ ...newEmployee, division: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map(div => (
                      <SelectItem key={div} value={div}>{div}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="password">Temporary Password <span className="text-red-500">*</span></Label>
                <Input
                  id="password"
                  type="password"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                  placeholder="Enter temporary password"
                />
              </div>
              <Button onClick={handleAddEmployee} className="w-full">
                Add Employee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditEmployeeOpen} onOpenChange={setIsEditEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Full Name <span className="text-red-500">*</span></Label>
              <Input id="edit-name" value={editEmployee.name} onChange={(e)=>setEditEmployee({ ...editEmployee, name: e.target.value })} placeholder="Enter full name" />
            </div>
            <div>
              <Label htmlFor="edit-email">Email <span className="text-red-500">*</span></Label>
              <Input id="edit-email" type="email" value={editEmployee.email} onChange={(e)=>setEditEmployee({ ...editEmployee, email: e.target.value })} placeholder="Enter email address" />
            </div>
            <div>
              <Label htmlFor="edit-role">Role <span className="text-red-500">*</span></Label>
              <Select value={editEmployee.role} onValueChange={(v)=>setEditEmployee({ ...editEmployee, role: v as UserRole })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-division">Division</Label>
              <Select value={editEmployee.division} onValueChange={(v)=>setEditEmployee({ ...editEmployee, division: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map(div => (<SelectItem key={div} value={div}>{div}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-password">Temporary Password <span className="text-red-500">*</span></Label>
              <Input id="edit-password" type="password" value={editEmployee.password} onChange={(e)=>setEditEmployee({ ...editEmployee, password: e.target.value })} placeholder="Enter temporary password" />
            </div>
            <Button onClick={handleUpdateEmployee} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Role Distribution</DialogTitle>
          </DialogHeader>
          {renderRoleDistribution()}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><FilterIcon className="h-4 w-4" /> Filters</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Role</div>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                    {roles.map(r => (
                      <label key={r} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={filterRoles.includes(r)} onCheckedChange={(v)=> setFilterRoles(prev => v ? [...prev, r] : prev.filter(x=>x!==r))} />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Status</div>
                  <div className="flex items-center gap-2 text-sm">
                    {(['all','active','inactive'] as const).map(s => (
                      <Button key={s} size="sm" variant={filterStatus===s?'default':'outline'} onClick={()=>setFilterStatus(s)} className="capitalize">{s}</Button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-1">Division</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                    {divisions.map(d => (
                      <label key={d} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={filterDivisions.includes(d)} onCheckedChange={(v)=> setFilterDivisions(prev => v ? [...prev, d] : prev.filter(x=>x!==d))} />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={()=>{ setFilterRoles([]); setFilterStatus('all'); setFilterDivisions([]); }}>Reset</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Rows3 className="h-4 w-4" /> Group By</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="grid gap-2">
                {(['none','role','status','division'] as const).map(opt => (
                  <Button key={opt} variant={groupBy===opt?'default':'outline'} size="sm" className="capitalize justify-start" onClick={()=>setGroupBy(opt)}>
                    {opt === 'none' ? 'None' : opt}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Columns2 className="h-4 w-4" /> Fields</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="grid gap-2">
                {allFields.map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedFields.includes(f)} onCheckedChange={(v)=> setSelectedFields(prev => v ? [...prev, f] : prev.filter(x=>x!==f))} />
                    <span>{f}</span>
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields([...allFields])}>All</Button>
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields([])}>None</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={()=>{
            const rows = filteredEmployees.map(e => {
              const row: Record<string, any> = {};
              for (const f of selectedFields) {
                if (f === 'Name') row['Name'] = e.name;
                else if (f === 'Email') row['Email'] = e.email;
                else if (f === 'Role') row['Role'] = e.role;
                else if (f === 'Division') row['Division'] = e.division;
                else if (f === 'Status') row['Status'] = e.isActive ? 'Active' : 'Purged';
                else if (f === 'Last Login') row['Last Login'] = e.lastLogin || '';
              }
              return row;
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Employees');
            XLSX.writeFile(wb, 'employees.xlsx');
          }} className="flex items-center gap-2"><Download className="h-4 w-4" /> Export XLSX</Button>
        </div>
      </div>

          <Table>
            <TableHeader>
              <TableRow>
                {selectedFields.includes('Name') && (<TableHead>Name</TableHead>)}
                {selectedFields.includes('Email') && (<TableHead>Email</TableHead>)}
                {selectedFields.includes('Role') && (<TableHead>Role</TableHead>)}
                {selectedFields.includes('Division') && (<TableHead>Division</TableHead>)}
                {selectedFields.includes('Status') && (<TableHead>Status</TableHead>)}
                {selectedFields.includes('Last Login') && (<TableHead>Last Login</TableHead>)}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const renderRow = (employee: Employee) => (
                  <TableRow key={employee.id}>
                    {selectedFields.includes('Name') && (<TableCell className="font-medium">{employee.name}</TableCell>)}
                    {selectedFields.includes('Email') && (
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{employee.email}</span>
                        </div>
                      </TableCell>
                    )}
                    {selectedFields.includes('Role') && (
                      <TableCell>
                        <Badge className={getRoleBadgeColor(employee.role)}>
                          {employee.role}
                        </Badge>
                      </TableCell>
                    )}
                    {selectedFields.includes('Division') && (<TableCell>{employee.division}</TableCell>)}
                    {selectedFields.includes('Status') && (
                      <TableCell>
                        <Badge className={employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {employee.isActive ? 'Active' : 'Purged'}
                        </Badge>
                      </TableCell>
                    )}
                    {selectedFields.includes('Last Login') && (<TableCell>{employee.lastLogin || 'Never'}</TableCell>)}
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" title="Edit" aria-label="Edit" onClick={() => openEditEmployee(employee)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {employee.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveEmployee(employee.id)}
                            title="Purge"
                            aria-label="Purge"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivateEmployee(employee.id)}
                            title="Reactivate"
                            aria-label="Reactivate"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );

                if (groupBy === 'none') {
                  return filteredEmployees.map(emp => renderRow(emp));
                }

                const groups: Record<string, Employee[]> = {};
                for (const e of filteredEmployees) {
                  const key = groupBy === 'role' ? e.role : groupBy === 'status' ? (e.isActive ? 'Active' : 'Purged') : (e.division || '');
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(e);
                }
                const keys = Object.keys(groups).sort();
                return keys.map(k => (
                  <>
                    <TableRow key={`group-${k}`}>
                      <TableCell colSpan={selectedFields.length + 1} className="bg-slate-50 text-slate-700 font-medium">{k || '—'} ({groups[k].length})</TableCell>
                    </TableRow>
                    {groups[k].map(e => renderRow(e))}
                  </>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">HR Dashboard</h1>
      </div>

      {renderEmployees()}
    </div>
  );
}
