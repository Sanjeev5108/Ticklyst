import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  FolderOpen,
  FileText,
  BarChart3,
  ClipboardList,
  ListChecks,
  Lock,
  Settings as SettingsIcon,
  MessageSquare,
  Calendar,
  TrendingUp,
} from "lucide-react";

interface Module {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  roles: string[];
  route: string;
}

export const modules: Module[] = [
  {
    id: "client",
    name: "Client",
    icon: Briefcase,
    description: "Manage client information and relationships",
    roles: ["Admin", "Division Partner", "Division Head"],
    route: "/client",
  },
  {
    id: "employee",
    name: "Employee",
    icon: Users,
    description: "Employee management and role assignments",
    roles: ["Admin", "HR"],
    component: HRDashboard,
  },
  {
    id: "projects",
    name: "Projects",
    icon: FolderOpen,
    description: "Project creation and management",
    roles: [
      "Admin",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/projects",
  },
  {
    id: "framework",
    name: "Framework",
    icon: FileText,
    description: "Audit framework and process management",
    roles: [
      "Admin",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/framework",
  },
  {
    id: "risk-assessment",
    name: "Risk Assessment",
    icon: TrendingUp,
    description: "Configure risk models, scales, and thresholds",
    roles: ["Admin"],
    route: "/risk-assessment",
  },
  {
    id: "fieldwork",
    name: "Fieldwork",
    icon: BarChart3,
    description: "Fieldwork execution and tracking",
    roles: [
      "Admin",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/fieldwork",
  },
  {
    id: "review",
    name: "Review",
    icon: MessageSquare,
    description: "Review submitted fieldwork and provide comments",
    roles: [
      "Admin",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/review",
  },
  {
    id: "atr",
    name: "ATR",
    icon: ClipboardList,
    description: "Audit Track Reports",
    roles: [
      "Admin",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/atr",
  },
  {
    id: "soa",
    name: "Statement of Applicability",
    icon: ListChecks,
    description:
      "Decide checklist applicability by industry, client, and period",
    roles: [
      "Admin",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/statement-of-applicability",
  },
  {
    id: "settings",
    name: "Settings",
    icon: SettingsIcon,
    description: "System configuration and preferences",
    roles: [
      "Admin",
      "HR",
      "Division Partner",
      "Division Head",
      "Team Leader",
      "Team Member",
    ],
    route: "/settings",
  },
];

// Role -> moduleId[] mapping stored in localStorage under key 'roleModuleMap'
const ROLE_MODULE_KEY = "roleModuleMap";

const getStoredRoleModuleMap = (): Record<string, string[]> => {
  const raw = localStorage.getItem(ROLE_MODULE_KEY);
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export default function ModularDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter modules based on user role and dynamic role-module mapping
  const [roleModuleMap, setRoleModuleMap] = useState<Record<string, string[]>>(
    () => getStoredRoleModuleMap(),
  );
  const availableModules = modules.filter((module) => {
    const role = user?.role || "";
    if (!role) return false;
    const allowedFromUser = user?.allowedModules;
    if (allowedFromUser && allowedFromUser.length) {
      return allowedFromUser.includes(module.id);
    }
    const allowed = roleModuleMap[role];
    if (!allowed) {
      return module.roles.includes(role);
    }
    return allowed.includes(module.id);
  });

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/roleModuleMap");
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setRoleModuleMap(data);
            localStorage.setItem(ROLE_MODULE_KEY, JSON.stringify(data));
          }
        } else if (!localStorage.getItem(ROLE_MODULE_KEY)) {
          const map: Record<string, string[]> = {};
          modules.forEach((m) => {
            (m.roles || []).forEach((r) => {
              if (!map[r]) map[r] = [];
              if (!map[r].includes(m.id)) map[r].push(m.id);
            });
          });
          setRoleModuleMap(map);
          localStorage.setItem(ROLE_MODULE_KEY, JSON.stringify(map));
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Mock data for status cards
  const statusCards = [
    {
      title: "Ongoing Audits",
      value: "12",
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Pending Comments",
      value: "8",
      icon: MessageSquare,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Upcoming Deadlines",
      value: "5",
      icon: Calendar,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.username}
        </h1>
        <Badge className="bg-blue-100 text-blue-800">{user?.role}</Badge>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statusCards.map((card, index) => (
          <Card key={index} className={`${card.bgColor} border-0`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {card.value}
                  </p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableModules.map((module) => (
          <Card
            key={module.id}
            className="hover:shadow-lg transition-shadow cursor-pointer bg-white border border-gray-200"
            onClick={() => navigate(module.route)}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-blue-50">
                  <module.icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {module.name}
                  </h3>
                  <p className="text-sm text-gray-600">{module.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State for roles with no modules */}
      {availableModules.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No modules available
            </h3>
            <p className="text-gray-600">
              Your role does not have access to any modules. Contact your
              administrator for assistance.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
