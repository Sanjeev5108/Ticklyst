import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Users,
  UserPlus,
  UserMinus,
  Mail,
  Shield
} from 'lucide-react';
import { UserRole } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

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

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
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
                <Label htmlFor="password">Temporary Password</Label>
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
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={editEmployee.name} onChange={(e)=>setEditEmployee({ ...editEmployee, name: e.target.value })} placeholder="Enter full name" />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editEmployee.email} onChange={(e)=>setEditEmployee({ ...editEmployee, email: e.target.value })} placeholder="Enter email address" />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
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
              <Label htmlFor="edit-password">Temporary Password</Label>
              <Input id="edit-password" type="password" value={editEmployee.password} onChange={(e)=>setEditEmployee({ ...editEmployee, password: e.target.value })} placeholder="Set/Reset temporary password (optional)" />
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
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{employee.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(employee.role)}>
                      {employee.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.division}</TableCell>
                  <TableCell>
                    <Badge className={employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {employee.isActive ? 'Active' : 'Purged'}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.lastLogin || 'Never'}</TableCell>
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
        <h1 className="text-3xl font-bold text-gray-900">HR Dashboard</h1>
      </div>

      {renderEmployees()}
    </div>
  );
}
