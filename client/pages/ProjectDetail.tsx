import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  ChevronRight, 
  ChevronDown,
  Edit3,
  Save,
  X
} from "lucide-react";

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

const riskCategories = ["Operational Efficiency", "Financial Risk", "Compliance Risk", "Strategic Risk"];
const controlCategories = ["Preventive", "Detective", "Corrective", "Compensating"];
const controlImplementations = ["Manual", "Automated", "Semi-Automated"];
const controlNatures = ["Preventive", "Detective", "Corrective"];
const effectiveness = ["Effective", "Ineffective", "Partially Effective"];
const statuses = ["Open", "In Progress", "Closed", "Overdue"];

export default function ProjectDetail() {
  const { clientName, projectId } = useParams<{ clientName: string; projectId: string }>();
  
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

  const [activeTab, setActiveTab] = useState("master");

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

  const renderMasterScreen = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Framework</h3>
        <Button onClick={() => addMasterRow(undefined, 1)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Process
        </Button>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 border-r">P1 / P2 / P3</th>
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
                <td className="p-3 border-r w-32">
                  <div className="flex items-center" style={{ paddingLeft: `${(row.level - 1) * 20}px` }}>
                    {row.level < 3 && (
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
                    <span className="text-green-600 font-mono">P{row.level}</span>
                    <div className="ml-2 flex gap-1">
                      <button
                        onClick={() => addMasterRow(row.id, row.level + 1)}
                        className="text-green-600 hover:bg-green-50 p-1 rounded text-xs"
                        disabled={row.level >= 3}
                      >
                        +/-
                      </button>
                      {row.level > 1 && (
                        <button
                          onClick={() => removeMasterRow(row.id)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 border-r">
                  <Input
                    value={row.process}
                    onChange={(e) => updateMasterField(row.id, 'process', e.target.value)}
                    className="border-0 p-0 h-8"
                    placeholder={row.level === 1 ? "Enter process name" : ""}
                    disabled={row.level !== 1}
                  />
                </td>
                <td className="p-3 border-r">
                  <Input
                    value={row.subProcess}
                    onChange={(e) => updateMasterField(row.id, 'subProcess', e.target.value)}
                    className="border-0 p-0 h-8"
                    placeholder={row.level === 2 ? "Enter sub process name" : ""}
                    disabled={row.level !== 2}
                  />
                </td>
                <td className="p-3 border-r">
                  <Input
                    value={row.riskDescription}
                    onChange={(e) => updateMasterField(row.id, 'riskDescription', e.target.value)}
                    className="border-0 p-0 h-8"
                    placeholder={row.level === 3 ? "Enter risk description" : ""}
                    disabled={row.level !== 3}
                  />
                </td>
                <td className="p-3 border-r">
                  <Select
                    value={row.riskCategory}
                    onValueChange={(value) => updateMasterField(row.id, 'riskCategory', value)}
                    disabled={row.level !== 3}
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
                  />
                </td>
                <td className="p-3">
                  <Select
                    value={row.controlCategory}
                    onValueChange={(value) => updateMasterField(row.id, 'controlCategory', value)}
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
    </div>
  );

  const renderTransactionScreen = () => (
    <div className="space-y-4">
      <div className="flex gap-4">
        {/* Mini Master Screen Reference */}
        <div className="w-48 bg-slate-50 p-3 rounded border">
          <h4 className="font-semibold text-sm mb-2">Framework</h4>
          <div className="space-y-1 text-xs">
            {masterData.slice(0, 5).map(row => (
              <div key={row.id} className="flex items-center" style={{ paddingLeft: `${(row.level - 1) * 8}px` }}>
                <span className="text-green-600">P{row.level}</span>
                <span className="ml-1 truncate">{row.riskDescription}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Table */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Fieldwork</h3>
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
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuditTrackScreen = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Audit Track Report Screen</h3>
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
                  />
                </td>
                <td className="p-3 border-r">
                  <Input
                    value={row.actionPlan}
                    onChange={(e) => updateAuditTrackField(row.id, 'actionPlan', e.target.value)}
                    placeholder="Enter action plan"
                  />
                </td>
                <td className="p-3 border-r">
                  <Input
                    value={row.responsibility}
                    onChange={(e) => updateAuditTrackField(row.id, 'responsibility', e.target.value)}
                    placeholder="Enter responsibility"
                  />
                </td>
                <td className="p-3 border-r">
                  <Input
                    value={row.designation}
                    onChange={(e) => updateAuditTrackField(row.id, 'designation', e.target.value)}
                    placeholder="Enter designation"
                  />
                </td>
                <td className="p-3 border-r">
                  <Input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => updateAuditTrackField(row.id, 'dueDate', e.target.value)}
                  />
                </td>
                <td className="p-3">
                  <Select
                    value={row.status}
                    onValueChange={(value) => updateAuditTrackField(row.id, 'status', value)}
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
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link to={`/client/${clientName}`}>
            <Button variant="outline" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{clientName} - Project Detail</h1>
            <p className="text-slate-600">Project ID: {projectId}</p>
          </div>
        </div>

        {/* Tabs for the three screens */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="master">Framework</TabsTrigger>
                <TabsTrigger value="transaction">Fieldwork</TabsTrigger>
                <TabsTrigger value="audit-track">Audit Track Report</TabsTrigger>
              </TabsList>
              
              <TabsContent value="master" className="mt-6">
                {renderMasterScreen()}
              </TabsContent>
              
              <TabsContent value="transaction" className="mt-6">
                {renderTransactionScreen()}
              </TabsContent>
              
              <TabsContent value="audit-track" className="mt-6">
                {renderAuditTrackScreen()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
