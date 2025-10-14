import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  FileText, 
  BarChart3,
  Plus,
  Eye
} from 'lucide-react';

export default function DivisionPartnerDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const stats = [
    { title: 'Active Clients', value: 12, icon: Building2, color: 'text-blue-600' },
    { title: 'Active Projects', value: 28, icon: FileText, color: 'text-green-600' },
    { title: 'Team Members', value: 45, icon: Users, color: 'text-purple-600' },
    { title: 'Completed Audits', value: 156, icon: BarChart3, color: 'text-orange-600' }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
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
      
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full justify-start" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create New Client
          </Button>
          <Button className="w-full justify-start" variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Create New Project
          </Button>
          <Button className="w-full justify-start" variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View Dashboard Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Division Partner Dashboard</h1>
        <Badge className="bg-purple-100 text-purple-800">Client & Project Management</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">{renderOverview()}</TabsContent>
        <TabsContent value="clients">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Client management interface will be implemented here</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="projects">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Project management interface will be implemented here</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">Analytics dashboard will be implemented here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
