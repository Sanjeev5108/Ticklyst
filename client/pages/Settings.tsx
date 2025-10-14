import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AssignmentTypeStore } from '@/contexts/AssignmentTypeStore';

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
  useEffect(() => {
    const setFromStore = () => setItems(AssignmentTypeStore.getAll());
    const unsub = AssignmentTypeStore.subscribe(setFromStore);
    setFromStore();
    return () => unsub();
  }, []);
  const add = () => { AssignmentTypeStore.add(newName); setNewName(''); };
  const save = (id: string) => { const v = (editing[id]||'').trim(); if (v) AssignmentTypeStore.rename(id, v); setEditing(prev => { const c = {...prev}; delete c[id]; return c; }); };
  const remove = (id: string) => { AssignmentTypeStore.remove(id); };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Add new assignment type" value={newName} onChange={(e)=>setNewName(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 border rounded p-2">
            {editing[item.id] !== undefined ? (
              <>
                <Input className="flex-1" value={editing[item.id]} onChange={(e)=> setEditing(prev=>({ ...prev, [item.id]: e.target.value }))} />
                <Button size="sm" onClick={()=>save(item.id)}>Save</Button>
              </>
            ) : (
              <>
                <div className="flex-1 text-sm">{item.name}</div>
                <Button size="sm" variant="outline" onClick={()=> setEditing(prev=>({ ...prev, [item.id]: item.name }))}>Rename</Button>
                <Button size="sm" variant="destructive" onClick={()=>remove(item.id)}>Delete</Button>
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

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const md = await import('./ModularDashboard');
        const list = (md && md.modules) ? md.modules.map((m:any)=>({ id: m.id, name: m.name })) : [];
        if (!mounted) return;
        setModulesList(list);

        const stored = localStorage.getItem(ROLE_KEY);
        if (stored) {
          try { setMapState(JSON.parse(stored)); } catch {}
        }
        const storedScope = localStorage.getItem(SCOPE_KEY);
        if (storedScope) {
          try { setScopeState(JSON.parse(storedScope)); } catch {}
        }

        const storedUserMap = localStorage.getItem(USER_KEY);
        if (storedUserMap) {
          try { setUserMapState(JSON.parse(storedUserMap)); } catch {}
        }
        const storedUserScope = localStorage.getItem(USER_SCOPE_KEY);
        if (storedUserScope) {
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

  const toggleModuleTarget = (moduleId: string) => {
    if (selectedUser && selectedUser !== 'none') {
      const uid = selectedUser;
      const next = { ...(userMapState || {}) };
      next[uid] = next[uid] ? [...next[uid]] : [];
      const idx = next[uid].indexOf(moduleId);
      if (idx === -1) next[uid].push(moduleId); else next[uid].splice(idx,1);
      persistUserMap(next);
    } else {
      const role = selectedRole;
      setMapState(prev => {
        const copy = { ...(prev || {}) };
        copy[role] = copy[role] ? [...copy[role]] : [];
        const idx = copy[role].indexOf(moduleId);
        if (idx === -1) copy[role].push(moduleId); else copy[role].splice(idx,1);
        localStorage.setItem(ROLE_KEY, JSON.stringify(copy));
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
        return copy;
      });
    } else {
      const role = selectedRole;
      setScopeState(prev => {
        const copy = { ...(prev || {}) };
        copy[role] = value;
        localStorage.setItem(SCOPE_KEY, JSON.stringify(copy));
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
