import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'Admin' | 'HR' | 'Division Partner' | 'Division Head' | 'Team Member' | 'Team Leader';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  email?: string;
  department?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  setUserRole: (userId: string, role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Test credentials as specified
const testCredentials: Record<string, { password: string; role: UserRole }> = {
  'Admin': { password: '12345', role: 'Admin' },
  'HR': { password: '12345', role: 'HR' },
  'Division Partner': { password: '12345', role: 'Division Partner' },
  'Division Head': { password: '12345', role: 'Division Head' },
  'Team Leader': { password: '12345', role: 'Team Leader' },
  'Team Member': { password: '12345', role: 'Team Member' }
};

// Role-based permissions
const rolePermissions: Record<UserRole, string[]> = {
  'Admin': [
    'create_all', 'read_all', 'update_all', 'delete_all',
    'manage_industries', 'manage_departments', 'manage_master_checklist',
    'manage_users', 'manage_clients', 'manage_projects'
  ],
  'HR': [
    'add_employees', 'remove_employees', 'assign_roles', 'manage_credentials',
    'view_employees'
  ],
  'Division Partner': [
    'create_clients', 'create_projects', 'map_industries', 'add_departments',
    'add_checklist_questions', 'view_dashboards', 'view_comments'
  ],
  'Division Head': [
    'create_clients', 'create_projects', 'map_industries', 'add_departments',
    'add_checklist_questions', 'view_dashboards', 'view_comments',
    'assign_projects_to_teams', 'manage_teams'
  ],
  'Team Leader': [
    'view_all_team_projects', 'assign_tasks', 'view_assigned_projects', 'add_comments'
  ],
  'Team Member': [
    'view_assigned_projects', 'view_assigned_checklists', 'add_comments'
  ]
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Persisted users list (for settings management)
  const getStoredUsers = (): User[] => {
    const raw = localStorage.getItem('users');
    if (!raw) {
      // seed from testCredentials
      const seeded: User[] = Object.keys(testCredentials).map((k, idx) => ({
        id: `${idx + 1}`,
        username: k,
        role: testCredentials[k].role,
        email: `${k.toLowerCase().replace(' ', '.')}@company.com`,
        isActive: true
      }));
      localStorage.setItem('users', JSON.stringify(seeded));
      return seeded;
    }
    try { return JSON.parse(raw) as User[]; } catch { return []; }
  };

  const setStoredUsers = (users: User[]) => {
    localStorage.setItem('users', JSON.stringify(users));
  };

  useEffect(() => {
    // Check for stored authentication
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const credentials = testCredentials[username];

    if (credentials && credentials.password === password) {
      // try to find existing user in stored users
      const users = getStoredUsers();
      let existing = users.find(u => u.username === username);
      if (!existing) {
        existing = {
          id: `${Date.now()}`,
          username,
          role: credentials.role,
          email: `${username.toLowerCase().replace(' ', '.')}@company.com`,
          isActive: true
        };
        users.push(existing);
        setStoredUsers(users);
      }

      setUser(existing);
      localStorage.setItem('currentUser', JSON.stringify(existing));
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return rolePermissions[user.role]?.includes(permission) || false;
  };

  // Allows updating role for a stored user; updates currentUser if it matches
  const setUserRole = (userId: string, role: UserRole) => {
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return;
    users[idx].role = role;
    setStoredUsers(users);

    // If changing current user, update state and persisted currentUser
    if (user && user.id === userId) {
      const updated = { ...user, role };
      setUser(updated);
      localStorage.setItem('currentUser', JSON.stringify(updated));
    }
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    hasPermission,
    setUserRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
