import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AssignmentTypeStore } from '@/contexts/AssignmentTypeStore';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as XLSX from 'xlsx';
import { Filter, Rows3, Columns2, Download } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Assignment Types */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-4">Assignment Types</h3>
          <p className="text-sm text-gray-600 mb-4">Create and manage assignment types. These appear in Project creation, Risk Assessment, and Fieldwork filters.</p>
          <AssignmentTypesEditor />
        </CardContent>
      </Card>

      {/* Role -> Module access mapping */}
      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-4">Role Access Configuration</h3>
          <p className="text-sm text-gray-600 mb-4">Select which modules each role can access. Changes are applied immediately.</p>

          <RoleAccessEditor />

        </CardContent>
      </Card>
    </div>
  );
}


function AssignmentTypesEditor() {
  const { useState, useEffect } = React as any;
  const [items, setItems] = useState<{id:string; name:string; description?:string; active?:boolean}[]>([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Record<string,string>>({});
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all'|'active'|'purged'>('all');
  const allFields = ['Assignment Type','Status'] as const;
  const [selectedFields, setSelectedFields] = useState<string[]>([...allFields]);
  useEffect(() => {
    const setFromStore = () => setItems(AssignmentTypeStore.getAll());
    const unsub = AssignmentTypeStore.subscribe(setFromStore);
    setFromStore();
    return () => unsub();
  }, []);
  const add = () => { AssignmentTypeStore.add(newName); setNewName(''); };
  const save = (id: string) => { const v = (editing[id]||'').trim(); if (v) AssignmentTypeStore.rename(id, v); setEditing(prev => { const c = {...prev}; delete c[id]; return c; }); };
  const purge = (id: string) => { AssignmentTypeStore.setActive(id, false); };
  const restore = (id: string) => { AssignmentTypeStore.setActive(id, true); };

  const filtered = items.filter(it => {
    const nameOk = !filterName || it.name.toLowerCase().includes(filterName.toLowerCase());
    const statusOk = filterStatus === 'all' ? true : filterStatus === 'active' ? (it.active ?? true) : !(it.active ?? true);
    return nameOk && statusOk;
  });

  const exportAssignment = () => {
    const rows = filtered.map(it => {
      const row: Record<string, any> = {};
      if (selectedFields.includes('Assignment Type')) row['Assignment Type'] = it.name;
      if (selectedFields.includes('Status')) row['Status'] = (it.active ?? true) ? 'Active' : 'Purged';
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assignment');
    XLSX.writeFile(wb, 'settings-assignment.xlsx');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Add new assignment type" value={newName} onChange={(e)=>setNewName(e.target.value)} className="max-w-xs" />
        <Button onClick={add}>Add</Button>
        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Filter className="h-4 w-4"/> Filter</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Assignment Type</Label>
                  <Input value={filterName} onChange={(e)=>setFilterName(e.target.value)} placeholder="Search by name" />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus} onValueChange={(v:any)=>setFilterStatus(v)}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="purged">Purged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={()=>{ setFilterName(''); setFilterStatus('all'); }}>Reset</Button></div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><Columns2 className="h-4 w-4"/> Fields</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="grid gap-2">
                {(['Assignment Type','Status'] as const).map(f => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selectedFields.includes(f)} onCheckedChange={(v)=> setSelectedFields(prev => v ? [...prev, f] : prev.filter(x=>x!==f))} />
                    <span>{f}</span>
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields(['Assignment Type','Status'])}>All</Button>
                  <Button size="sm" variant="outline" onClick={()=>setSelectedFields([])}>None</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={exportAssignment} className="flex items-center gap-2"><Download className="h-4 w-4"/> Export XLSX</Button>
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className="flex items-center gap-2 border rounded p-2">
            {editing[item.id] !== undefined ? (
              <>
                <Input className="flex-1" value={editing[item.id]} onChange={(e)=> setEditing(prev=>({ ...prev, [item.id]: e.target.value }))} />
                <Button size="sm" onClick={()=>save(item.id)}>Save</Button>
              </>
            ) : (
              <>
                <div className={`flex-1 text-sm ${item.active === false ? 'line-through text-gray-500' : ''}`}>
                  {item.name}
                  {item.active === false && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">Purged</span>}
                </div>
                <Button size="sm" variant="outline" onClick={()=> setEditing(prev=>({ ...prev, [item.id]: item.name }))}>Rename</Button>
                {item.active === false ? (
                  <Button size="sm" variant="secondary" onClick={()=>restore(item.id)}>Restore</Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={()=>purge(item.id)}>Purge</Button>
                )}
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-gray-500">No assignment types yet.</div>}
      </div>
    </div>
  );
}

// RoleAccessEditor component placed after Settings
function RoleAccessEditor() {
  const ROLE_KEY = 'roleModuleMap';
  const SCOPE_KEY = 'roleProjectScope';
  const USER_KEY = 'userModuleMap';
  const USER_SCOPE_KEY = 'userProjectScope';
  const ROLES = ['Admin','HR','Division Partner','Division Head','Team Leader','Team Member'];

  const [modulesList, setModulesList] = React.useState<{id:string;name:string;}[]>([]);
  const [mapState, setMapState] = React.useState<Record<string,string[]>>({});
  const [scopeState, setScopeState] = React.useState<Record<string,string>>({});

  const [userMapState, setUserMapState] = React.useState<Record<string,string[]>>({});
  const [userScopeState, setUserScopeState] = React.useState<Record<string,string>>({});
  const [users, setUsers] = React.useState<{id:string;name:string}[]>([]);

  const [selectedRole, setSelectedRole] = React.useState<string>(ROLES[0]);
  const [selectedUser, setSelectedUser] = React.useState<string>('none');

  const exportAccessControls = async () => {
    try {
      const md = await import('./ModularDashboard');
      const modules = (md && md.modules) ? md.modules as any[] : [];
      const idToName: Record<string,string> = {};
      modules.forEach((m:any)=>{ idToName[m.id] = m.name; });

      const fetchJson = async (key: string) => {
        try { const res = await fetch(`/api/settings/${key}`); if (res.ok) return await res.json(); } catch {}
        try { return JSON.parse(localStorage.getItem(key) || 'null') || {}; } catch { return {}; }
      };

      const roleMap: Record<string,string[]> = Object.keys(mapState||{}).length ? mapState : await fetchJson('roleModuleMap');
      const roleScope: Record<string,string> = Object.keys(scopeState||{}).length ? scopeState : await fetchJson('roleProjectScope');
      const userMap: Record<string,string[]> = Object.keys(userMapState||{}).length ? userMapState : await fetchJson('userModuleMap');
      const userScope: Record<string,string> = Object.keys(userScopeState||{}).length ? userScopeState : await fetchJson('userProjectScope');

      let employees: any[] = [];
      try {
        const raw = localStorage.getItem('employees');
        if (raw) employees = JSON.parse(raw);
        else {
          const res = await fetch('/api/employees');
          if (res.ok) employees = await res.json();
        }
      } catch {}

      const toModuleNames = (ids: string[] = []) => (ids||[]).map(id => idToName[id] || id).join(', ');

      const roleRows: any[] = [];
      const ALL_ROLES = ['Admin','HR','Division Partner','Division Head','Team Leader','Team Member'];
      for (const role of ALL_ROLES) {
        const mods = roleMap[role] || [];
        roleRows.push({ Role: role, Modules: toModuleNames(mods), Scope: roleScope[role] || 'all' });
      }

      const roleEmpRows: any[] = [];
      (employees||[]).forEach((e:any)=>{
        roleEmpRows.push({ Role: e.role || '', Employee: e.name || '', Email: e.email || '', Division: e.division || '', Status: (e.isActive ?? true) ? 'Active' : 'Purged' });
      });

      const empAccessRows: any[] = [];
      const byId: Record<string, any> = {};
      (employees||[]).forEach((e:any)=>{ if (e?.id) byId[String(e.id)] = e; });
      Object.keys(userMap||{}).forEach(uid => {
        const e = byId[uid] || {};
        empAccessRows.push({ Employee: e.name || uid, Email: e.email || '', Modules: toModuleNames(userMap[uid]||[]), Scope: userScope[uid] || 'all' });
      });

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(roleRows);
      const ws2 = XLSX.utils.json_to_sheet(roleEmpRows);
      const ws3 = XLSX.utils.json_to_sheet(empAccessRows);
      XLSX.utils.book_append_sheet(wb, ws1, 'Role Access Controls');
      XLSX.utils.book_append_sheet(wb, ws2, 'Role Employees');
      XLSX.utils.book_append_sheet(wb, ws3, 'Employee Access');
      XLSX.writeFile(wb, 'settings-access-controls.xlsx');
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const md = await import('./ModularDashboard');
        const list = (md && md.modules) ? md.modules.map((m:any)=>({ id: m.id, name: m.name })) : [];
        if (!mounted) return;
        setModulesList(list);

        try {
          const [roleMapRes, roleScopeRes, userMapRes, userScopeRes] = await Promise.all([
            fetch('/api/settings/roleModuleMap'),
            fetch('/api/settings/roleProjectScope'),
            fetch('/api/settings/userModuleMap'),
            fetch('/api/settings/userProjectScope')
          ]);
          if (roleMapRes.ok) setMapState(await roleMapRes.json());
          if (roleScopeRes.ok) setScopeState(await roleScopeRes.json());
          if (userMapRes.ok) setUserMapState(await userMapRes.json());
          if (userScopeRes.ok) setUserScopeState(await userScopeRes.json());
        } catch {}

        const stored = localStorage.getItem(ROLE_KEY);
        if (stored && Object.keys(mapState||{}).length===0) {
          try { setMapState(JSON.parse(stored)); } catch {}
        }
        const storedScope = localStorage.getItem(SCOPE_KEY);
        if (storedScope && Object.keys(scopeState||{}).length===0) {
          try { setScopeState(JSON.parse(storedScope)); } catch {}
        }

        const storedUserMap = localStorage.getItem(USER_KEY);
        if (storedUserMap && Object.keys(userMapState||{}).length===0) {
          try { setUserMapState(JSON.parse(storedUserMap)); } catch {}
        }
        const storedUserScope = localStorage.getItem(USER_SCOPE_KEY);
        if (storedUserScope && Object.keys(userScopeState||{}).length===0) {
          try { setUserScopeState(JSON.parse(storedUserScope)); } catch {}
        }

        // load users list from localStorage 'employees' or fallback to 'users'
        let userListRaw = localStorage.getItem('employees') || localStorage.getItem('users');
        if (userListRaw) {
          try {
            const parsed = JSON.parse(userListRaw) as any[];
            const mapped = parsed.map((u, idx) => ({ id: u.id || `${idx+1}`, name: u.username || u.name || `User ${idx+1}` }));
            setUsers(mapped);
          } catch (e) {
            setUsers([]);
          }
        } else {
          setUsers([]);
        }

        // build default role map if missing (Admin gets access to all modules)
        if (!stored) {
          const defaultMap: Record<string,string[]> = {};
          list.forEach(m => {
            if (!defaultMap['Admin']) defaultMap['Admin'] = [];
            if (!defaultMap['Admin'].includes(m.id)) defaultMap['Admin'].push(m.id);
          });
          setMapState(defaultMap);
          localStorage.setItem(ROLE_KEY, JSON.stringify(defaultMap));
        }

        // ensure default role scopes
        if (!storedScope) {
          const defaultScope: Record<string,string> = {};
          ROLES.forEach(r => { defaultScope[r] = 'all'; });
          setScopeState(defaultScope);
          localStorage.setItem(SCOPE_KEY, JSON.stringify(defaultScope));
        }

      } catch (err) {
        console.error('Failed loading modules for role editor', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const persistUserMap = (next: Record<string,string[]>) => {
    setUserMapState(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  };

  const toggleModuleTarget = async (moduleId: string) => {
    if (selectedUser && selectedUser !== 'none') {
      const uid = selectedUser;
      const next = { ...(userMapState || {}) };
      next[uid] = next[uid] ? [...next[uid]] : [];
      const idx = next[uid].indexOf(moduleId);
      if (idx === -1) next[uid].push(moduleId); else next[uid].splice(idx,1);
      persistUserMap(next);
      try { fetch('/api/settings/userModuleMap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {}); } catch {}
    } else {
      const role = selectedRole;
      setMapState(prev => {
        const copy = { ...(prev || {}) };
        copy[role] = copy[role] ? [...copy[role]] : [];
        const idx = copy[role].indexOf(moduleId);
        if (idx === -1) copy[role].push(moduleId); else copy[role].splice(idx,1);
        localStorage.setItem(ROLE_KEY, JSON.stringify(copy));
        try { fetch('/api/settings/roleModuleMap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) }); } catch {}
        return copy;
      });
    }
  };

  const setScopeTarget = (value: string) => {
    if (selectedUser && selectedUser !== 'none') {
      const uid = selectedUser;
      setUserScopeState(prev => {
        const copy = { ...(prev || {}) };
        copy[uid] = value;
        localStorage.setItem(USER_SCOPE_KEY, JSON.stringify(copy));
        try { fetch('/api/settings/userProjectScope', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) }); } catch {}
        return copy;
      });
    } else {
      const role = selectedRole;
      setScopeState(prev => {
        const copy = { ...(prev || {}) };
        copy[role] = value;
        localStorage.setItem(SCOPE_KEY, JSON.stringify(copy));
        try { fetch('/api/settings/roleProjectScope', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) }); } catch {}
        return copy;
      });
    }
  };

  const projectRelated = new Set(['projects','review','atr','fieldwork']);

  const checkedFor = (modId: string) => {
    if (selectedUser && selectedUser !== 'none') {
      return (userMapState[selectedUser] || []).includes(modId);
    }
    return (mapState[selectedRole] || []).includes(modId);
  };

  const scopeFor = () => {
    if (selectedUser && selectedUser !== 'none') return userScopeState[selectedUser] || 'all';
    return scopeState[selectedRole] || 'all';
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-64">
          <div className="text-sm text-gray-600">Select Role</div>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-64">
          <div className="text-sm text-gray-600">Select User (optional)</div>
          <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center space-x-2">
          <div className="text-sm text-gray-600">Project Scope</div>
          <div className="w-48">
            <Select value={scopeFor()} onValueChange={(v) => setScopeTarget(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="own">Own projects</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="ml-2"><Button size="sm" onClick={exportAccessControls} className="flex items-center gap-2"><Download className="h-4 w-4"/> Export XLSX</Button></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {modulesList.length === 0 ? (
          <div className="text-sm text-gray-500">No modules available</div>
        ) : modulesList.map(mod => {
          const checked = checkedFor(mod.id);
          return (
            <div key={mod.id} className="flex items-center justify-between gap-2 border p-2 rounded">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={checked} onChange={() => toggleModuleTarget(mod.id)} />
                <span className="text-sm">{mod.name}</span>
              </label>
              {projectRelated.has(mod.id) && (
                <div className="ml-2 w-32">
                  <Select value={scopeFor()} onValueChange={(v) => setScopeTarget(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="own">Own</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-500 mt-2">Tip: Choose a user to set user-specific module access. Leave "None" to edit role-level access.</div>
    </div>
  );
}
