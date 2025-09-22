import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  Edit3,
  Save,
  X,
  MessageSquare,
  Send
} from 'lucide-react';

interface MasterScreenRow {
  id: string;
  level: number; // 1 = P1, 2 = P2, 3 = P3
  parentId?: string;
  isExpanded?: boolean;
  process: string; // P1 level
  subProcess: string; // P2 level
  riskDescription: string; // P3 level only
  riskCategory: string;
  controlDescription: string;
  controlCategory: string;
  controls?: string[];
}

interface TransactionScreenRow {
  id: string;
  controlName: string;
  controlImplementation: string;
  controlNature: string;
  effectiveness: string;
  auditObservation: string;
}

interface AuditTrackRow {
  id: string;
  auditObservation: string;
  actionPlan: string;
  responsibility: string;
  designation: string;
  dueDate: string;
  status: string;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: 'note' | 'issue' | 'resolution';
}

const riskCategories = ["Operational Efficiency", "Financial Risk", "Compliance Risk", "Strategic Risk"];
const controlCategories = ["Preventive", "Detective", "Corrective", "Compensating"];
const controlImplementations = ["Manual", "Automated", "Semi-Automated"];
const controlNatures = ["Preventive", "Detective", "Corrective"];
const effectiveness = ["Effective", "Ineffective", "Partially Effective"];
const statuses = ["Open", "In Progress", "Closed", "Overdue"];

interface Client {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress';
  industry: string;
  assignedProjects: number;
}

export default function TeamMemberDashboard() {
  const [activeTab, setActiveTab] = useState("completed");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [auditTab, setAuditTab] = useState("framework");
  const [searchTerm, setSearchTerm] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'note' | 'issue' | 'resolution'>('note');
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [clients] = useState<Client[]>([
    {
      id: 'CLT-001',
      name: 'Bull Machines India Pvt. LTD',
      description: 'Manufacturing and production company specializing in industrial machinery',
      status: 'in-progress',
      industry: 'Manufacturing',
      assignedProjects: 2
    },
    {
      id: 'CLT-002',
      name: 'Supreme Mobiles',
      description: 'Mobile phone retail and distribution company',
      status: 'in-progress',
      industry: 'Retail',
      assignedProjects: 1
    },
    {
      id: 'CLT-003',
      name: 'Thalapakatti Hospitality Pvt. LTD',
      description: 'Restaurant chain and hospitality services',
      status: 'completed',
      industry: 'Hospitality',
      assignedProjects: 1
    },
    {
      id: 'CLT-004',
      name: 'KTM',
      description: 'Automotive and motorcycle manufacturing',
      status: 'in-progress',
      industry: 'Automotive',
      assignedProjects: 3
    },
    {
      id: 'CLT-005',
      name: 'KMCH',
      description: 'Healthcare and medical services provider',
      status: 'completed',
      industry: 'Healthcare',
      assignedProjects: 1
    }
  ]);

  const [masterData, setMasterData] = useState<MasterScreenRow[]>([
    {
      id: "p1-1",
      level: 1,
      isExpanded: true,
      process: "Indent to Pay",
      subProcess: "",
      riskDescription: "",
      riskCategory: "",
      controlDescription: "",
      controlCategory: ""
    },
    {
      id: "p2-1",
      level: 2,
      parentId: "p1-1",
      isExpanded: true,
      process: "",
      subProcess: "Purchase Requisition",
      riskDescription: "",
      riskCategory: "",
      controlDescription: "",
      controlCategory: ""
    },
    {
      id: "p3-1",
      level: 3,
      parentId: "p2-1",
      process: "",
      subProcess: "",
      riskDescription: "Holding cost is high",
      riskCategory: "Operational Efficiency",
      controlDescription: "",
      controlCategory: ""
    },
    {
      id: "p2-2",
      level: 2,
      parentId: "p1-1",
      isExpanded: false,
      process: "",
      subProcess: "Purchase Planning",
      riskDescription: "",
      riskCategory: "",
      controlDescription: "",
      controlCategory: ""
    },
    {
      id: "p3-2",
      level: 3,
      parentId: "p2-2",
      process: "",
      subProcess: "",
      riskDescription: "Existing stock is not considered",
      riskCategory: "Operational Efficiency",
      controlDescription: "Stock taking is done periodically Stock Levels are fixed",
      controlCategory: "Preventive"
    }
  ]);

  const [transactionData, setTransactionData] = useState<TransactionScreenRow[]>([
    {
      id: "t1",
      controlName: "Control 1",
      controlImplementation: "",
      controlNature: "",
      effectiveness: "",
      auditObservation: ""
    }
  ]);

  const [auditTrackData, setAuditTrackData] = useState<AuditTrackRow[]>([
    {
      id: "at1",
      auditObservation: "",
      actionPlan: "",
      responsibility: "",
      designation: "",
      dueDate: "",
      status: ""
    }
  ]);

  const [comments, setComments] = useState<Comment[]>([]);

  const toggleExpanded = (id: string) => {
    setMasterData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, isExpanded: !row.isExpanded } : row
      )
    );
  };

  const updateMasterField = (id: string, field: keyof MasterScreenRow, value: string) => {
    setMasterData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const updateTransactionField = (id: string, field: keyof TransactionScreenRow, value: string) => {
    setTransactionData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const updateAuditTrackField = (id: string, field: keyof AuditTrackRow, value: string) => {
    setAuditTrackData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const addMasterRow = (parentId?: string, level: number = 1) => {
    const newId = `p${level}-${Date.now()}`;
    const newRow: MasterScreenRow = {
      id: newId,
      level,
      parentId,
      isExpanded: false,
      process: "",
      subProcess: "",
      riskDescription: "",
      riskCategory: "",
      controlDescription: "",
      controlCategory: ""
    };
    setMasterData(prev => [...prev, newRow]);
  };

  const removeMasterRow = (id: string) => {
    setMasterData(prev => prev.filter(row => row.id !== id && row.parentId !== id));
  };

  const getVisibleMasterRows = () => {
    const result: MasterScreenRow[] = [];

    const addRowAndChildren = (row: MasterScreenRow) => {
      result.push(row);
      if (row.isExpanded) {
        const children = masterData.filter(r => r.parentId === row.id);
        children.forEach(addRowAndChildren);
      }
    };

    const topLevelRows = masterData.filter(row => !row.parentId);
    topLevelRows.forEach(addRowAndChildren);

    return result;
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'Team Member',
      content: newComment.trim(),
      timestamp: new Date().toLocaleString(),
      type: commentType
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');
    setIsCommentDialogOpen(false);
  };

  const getFilteredClients = (status: 'completed' | 'in-progress') => {
    return clients
      .filter(client => client.status === status)
      .filter(client => {
        if (!searchTerm) return true;
        const query = searchTerm.toLowerCase();
        return (
          client.name.toLowerCase().includes(query) ||
          client.id.toLowerCase().includes(query) ||
          client.description.toLowerCase().includes(query)
        );
      });
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
  };

  const getCommentTypeColor = (type: string) => {
    const colors = {
      'note': 'bg-blue-100 text-blue-800',
      'issue': 'bg-red-100 text-red-800',
      'resolution': 'bg-green-100 text-green-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const renderCompletedClients = () => {
    const completedClients = getFilteredClients('completed');

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {completedClients.map((client) => (
            <Card key={client.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <Badge className="bg-green-100 text-green-800">
                    {client.status}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">Client ID: {client.id}</span>
                  <span>•</span>
                  <span>{client.industry}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{client.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {client.assignedProjects} completed project{client.assignedProjects !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClientSelect(client.id)}
                    >
                      View Only
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {completedClients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm
                ? `No completed clients found matching "${searchTerm}"`
                : 'No completed clients assigned'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderInProgressClients = () => {
    const inProgressClients = getFilteredClients('in-progress');

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {inProgressClients.map((client) => (
            <Card key={client.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <Badge className="bg-blue-100 text-blue-800">
                    {client.status}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">Client ID: {client.id}</span>
                  <span>•</span>
                  <span>{client.industry}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{client.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {client.assignedProjects} active project{client.assignedProjects !== 1 ? 's' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClientSelect(client.id)}
                    >
                      Edit Project
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {inProgressClients.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm
                ? `No in-progress clients found matching "${searchTerm}"`
                : 'No in-progress clients assigned'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFrameworkScreen = () => {
    const selectedClientData = clients.find(c => c.id === selectedClient);
    const isReadOnly = selectedClientData?.status === 'completed';

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Framework</h3>
          {!isReadOnly && (
            <Button onClick={() => addMasterRow(undefined, 1)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Process
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 border-r">Process</th>
                <th className="text-left p-3 border-r">Sub Process</th>
                <th className="text-left p-3 border-r">Risk Description</th>
                <th className="text-left p-3 border-r">Risk Category</th>
                <th className="text-left p-3 border-r">Control Description</th>
                <th className="text-left p-3">Control Category</th>
              </tr>
            </thead>
            <tbody>
              {getVisibleMasterRows().map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 border-r">
                    <div className="flex items-center" style={{ paddingLeft: `${(row.level - 1) * 20}px` }}>
                      {row.level === 1 && (
                        <div className="flex items-center gap-2 w-full">
                          {row.level < 3 && !isReadOnly && (
                            <button
                              onClick={() => toggleExpanded(row.id)}
                              className="mr-2 p-1 hover:bg-slate-100 rounded"
                            >
                              {row.isExpanded ?
                                <ChevronDown className="h-3 w-3" /> :
                                <ChevronRight className="h-3 w-3" />
                              }
                            </button>
                          )}
                          <Input
                            value={row.process}
                            onChange={(e) => updateMasterField(row.id, 'process', e.target.value)}
                            className="border-0 p-0 h-8 flex-1"
                            placeholder="Enter process name"
                            disabled={isReadOnly}
                          />
                          {!isReadOnly && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => addMasterRow(row.id, row.level + 1)}
                                className="text-green-600 hover:bg-green-50 p-1 rounded text-xs"
                                title="Add Sub Process"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              {row.level > 1 && (
                                <button
                                  onClick={() => removeMasterRow(row.id)}
                                  className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                                  title="Remove Process"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {row.level !== 1 && (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 border-r">
                    <div className="flex items-center" style={{ paddingLeft: `${Math.max(0, row.level - 2) * 20}px` }}>
                      {row.level === 2 && (
                        <div className="flex items-center gap-2 w-full">
                          {row.level < 3 && !isReadOnly && (
                            <button
                              onClick={() => toggleExpanded(row.id)}
                              className="mr-2 p-1 hover:bg-slate-100 rounded"
                            >
                              {row.isExpanded ?
                                <ChevronDown className="h-3 w-3" /> :
                                <ChevronRight className="h-3 w-3" />
                              }
                            </button>
                          )}
                          <Input
                            value={row.subProcess}
                            onChange={(e) => updateMasterField(row.id, 'subProcess', e.target.value)}
                            className="border-0 p-0 h-8 flex-1"
                            placeholder="Enter sub process name"
                            disabled={isReadOnly}
                          />
                          {!isReadOnly && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => addMasterRow(row.id, row.level + 1)}
                                className="text-green-600 hover:bg-green-50 p-1 rounded text-xs"
                                title="Add Risk"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => removeMasterRow(row.id)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                                title="Remove Sub Process"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {row.level !== 2 && (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 border-r">
                    <div className="flex items-center" style={{ paddingLeft: `${Math.max(0, row.level - 3) * 20}px` }}>
                      {row.level === 3 && (
                        <div className="flex items-center gap-2 w-full">
                          <Input
                            value={row.riskDescription}
                            onChange={(e) => updateMasterField(row.id, 'riskDescription', e.target.value)}
                            className="border-0 p-0 h-8 flex-1"
                            placeholder="Enter risk description"
                            disabled={isReadOnly}
                          />
                          {!isReadOnly && (
                            <button
                              onClick={() => removeMasterRow(row.id)}
                              className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                              title="Remove Risk"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {row.level !== 3 && (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 border-r">
                    <Select
                      value={row.riskCategory}
                      onValueChange={(value) => updateMasterField(row.id, 'riskCategory', value)}
                      disabled={row.level !== 3 || isReadOnly}
                    >
                      <SelectTrigger className="border-0 p-0 h-8">
                        <SelectValue placeholder={row.level === 3 ? "Select category" : ""} />
                      </SelectTrigger>
                      <SelectContent>
                        {riskCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.controlDescription}
                      onChange={(e) => updateMasterField(row.id, 'controlDescription', e.target.value)}
                      className="border-0 p-0 h-8"
                      placeholder="Enter control description"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3">
                    <Select
                      value={row.controlCategory}
                      onValueChange={(value) => updateMasterField(row.id, 'controlCategory', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="border-0 p-0 h-8">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {controlCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Read-Only Mode:</strong> This project is completed and cannot be edited.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFieldworkScreen = () => {
    const selectedClientData = clients.find(c => c.id === selectedClient);
    const isReadOnly = selectedClientData?.status === 'completed';

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Fieldwork</h3>
          {!isReadOnly && (
            <Button onClick={() => setTransactionData(prev => [...prev, {
              id: `t${Date.now()}`,
              controlName: `Control ${prev.length + 1}`,
              controlImplementation: "",
              controlNature: "",
              effectiveness: "",
              auditObservation: ""
            }])} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 border-r">Control Implementation</th>
                <th className="text-left p-3 border-r">Control Nature</th>
                <th className="text-left p-3 border-r">Effectiveness</th>
                <th className="text-left p-3">Audit Observation</th>
              </tr>
            </thead>
            <tbody>
              {transactionData.map((row, index) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 border-r">
                    <div className="mb-2 text-sm font-medium">{row.controlName}</div>
                    <Select
                      value={row.controlImplementation}
                      onValueChange={(value) => updateTransactionField(row.id, 'controlImplementation', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select implementation" />
                      </SelectTrigger>
                      <SelectContent>
                        {controlImplementations.map(impl => (
                          <SelectItem key={impl} value={impl}>{impl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 border-r">
                    <Select
                      value={row.controlNature}
                      onValueChange={(value) => updateTransactionField(row.id, 'controlNature', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select nature" />
                      </SelectTrigger>
                      <SelectContent>
                        {controlNatures.map(nature => (
                          <SelectItem key={nature} value={nature}>{nature}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 border-r">
                    <Select
                      value={row.effectiveness}
                      onValueChange={(value) => updateTransactionField(row.id, 'effectiveness', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select effectiveness" />
                      </SelectTrigger>
                      <SelectContent>
                        {effectiveness.map(eff => (
                          <SelectItem key={eff} value={eff}>{eff}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Input
                      value={row.auditObservation}
                      onChange={(e) => updateTransactionField(row.id, 'auditObservation', e.target.value)}
                      placeholder="Enter audit observation"
                      disabled={isReadOnly}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Read-Only Mode:</strong> This project is completed and cannot be edited.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderAuditTrackScreen = () => {
    const selectedClientData = clients.find(c => c.id === selectedClient);
    const isReadOnly = selectedClientData?.status === 'completed';

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Audit Track Report Screen</h3>
          <div className="flex gap-2">
            <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Add Comments</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Comment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comment-type">Comment Type</Label>
                    <select
                      id="comment-type"
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value as any)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="note">Note</option>
                      <option value="issue">Issue</option>
                      <option value="resolution">Resolution</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="comment">Comment</Label>
                    <Textarea
                      id="comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Enter your comment..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleAddComment} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Add Comment
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            {!isReadOnly && (
              <Button onClick={() => setAuditTrackData(prev => [...prev, {
                id: `at${Date.now()}`,
                auditObservation: "",
                actionPlan: "",
                responsibility: "",
                designation: "",
                dueDate: "",
                status: ""
              }])} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Row
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 border-r">Audit Observation</th>
                <th className="text-left p-3 border-r">Action Plan</th>
                <th className="text-left p-3 border-r">Responsibility</th>
                <th className="text-left p-3 border-r">Designation</th>
                <th className="text-left p-3 border-r">Due date</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {auditTrackData.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 border-r">
                    <Input
                      value={row.auditObservation}
                      onChange={(e) => updateAuditTrackField(row.id, 'auditObservation', e.target.value)}
                      placeholder="Enter audit observation"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.actionPlan}
                      onChange={(e) => updateAuditTrackField(row.id, 'actionPlan', e.target.value)}
                      placeholder="Enter action plan"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.responsibility}
                      onChange={(e) => updateAuditTrackField(row.id, 'responsibility', e.target.value)}
                      placeholder="Enter responsibility"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.designation}
                      onChange={(e) => updateAuditTrackField(row.id, 'designation', e.target.value)}
                      placeholder="Enter designation"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateAuditTrackField(row.id, 'dueDate', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3">
                    <Select
                      value={row.status}
                      onValueChange={(value) => updateAuditTrackField(row.id, 'status', value)}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Read-Only Mode:</strong> This project is completed and cannot be edited. You can only view and add comments.
            </p>
          </div>
        )}

        {/* Comments Section */}
        {comments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium">{comment.author}</span>
                        <Badge className={`text-xs ${getCommentTypeColor(comment.type)}`}>
                          {comment.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (selectedClient) {
    const client = clients.find(c => c.id === selectedClient);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{client?.name || 'Client'}</h1>
            <p className="text-gray-600">Client ID: {selectedClient} • {client?.industry}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleBackToClients}>
              Back to Clients
            </Button>
            <Badge className="bg-green-100 text-green-800">Audit Access</Badge>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            <Tabs value={auditTab} onValueChange={setAuditTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="framework">Framework</TabsTrigger>
                <TabsTrigger value="fieldwork">Fieldwork</TabsTrigger>
                <TabsTrigger value="audit-track">Audit Track Report</TabsTrigger>
              </TabsList>

              <TabsContent value="framework" className="mt-6">
                {renderFrameworkScreen()}
              </TabsContent>

              <TabsContent value="fieldwork" className="mt-6">
                {renderFieldworkScreen()}
              </TabsContent>

              <TabsContent value="audit-track" className="mt-6">
                {renderAuditTrackScreen()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Team Member Dashboard</h1>
        <Badge className="bg-green-100 text-green-800">Assigned Projects Access</Badge>
      </div>

      {/* Search Bar */}
      <div className="flex justify-center">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MessageSquare className="h-5 w-5 text-slate-400" />
          </div>
          <Input
            type="text"
            placeholder="Search by client name, ID, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 w-full bg-white/80 backdrop-blur-sm border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl shadow-lg transition-all duration-200 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <span className="text-slate-400 hover:text-slate-600 transition-colors">
                ✕
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Client Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="completed" className="mt-6">
          {renderCompletedClients()}
        </TabsContent>

        <TabsContent value="in-progress" className="mt-6">
          {renderInProgressClients()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
