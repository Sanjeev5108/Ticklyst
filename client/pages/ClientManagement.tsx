import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Search, 
  Building2, 
  MapPin, 
  Globe, 
  Star,
  Users,
  Calendar,
  DollarSign,
  Filter,
  Grid3x3,
  List,
  Upload
} from 'lucide-react';

interface ContactPerson {
  name: string;
  designation: string;
  email: string;
  mobile: string;
}

interface Client {
  id: string;
  name: string;
  sector?: string;
  industry?: string;
  location: string;
  city: string;
  state: string;
  pincode: string;
  street1?: string;
  street2?: string;
  website?: string;
  logo?: string;
  // support multiple contact persons
  contactPersons: ContactPerson[];
  // legacy single contact for compatibility
  contactPerson?: ContactPerson;
  auditUniverse: {
    units: string[];
    departments: string[];
    additionalDepartments: { [unit: string]: string[] };
    sections?: { unit: string[]; departments: string[] }[];
  };
  stats: {
    projects: number;
    ongoing: number;
    revenue: string;
    rating: number;
    progressPercentage: number;
  };
  createdAt: string;
}

const mockClients: Client[] = [
  {
    id: '1',
    name: 'Naargo Industries Private Limited',
    industry: 'Manufacturing',
    location: 'Coimbatore, India',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641001',
    website: 'www.naargo.com',
    contactPerson: {
      name: 'Rajesh Kumar',
      designation: 'Managing Director',
      email: 'rajesh@naargo.com',
      mobile: '+91 9876543210'
    },
    auditUniverse: {
      units: ['Factory 1', 'Factory 2'],
      departments: ['Production', 'Quality', 'Finance'],
      additionalDepartments: {}
    },
    stats: { projects: 5, ongoing: 0, revenue: '$150', rating: 4.8, progressPercentage: 85 },
    createdAt: '2024-01-15'
  },
  {
    id: '2',
    name: 'Milky Mist Dairy Food Ltd',
    industry: 'Food & Beverages',
    location: 'Erode, India',
    city: 'Erode',
    state: 'Tamil Nadu',
    pincode: '638001',
    website: 'www.milkymist.in',
    contactPerson: {
      name: 'Suresh Babu',
      designation: 'CEO',
      email: 'suresh@milkymist.in',
      mobile: '+91 9876543211'
    },
    auditUniverse: {
      units: ['Dairy Unit 1'],
      departments: ['Production', 'Quality Control', 'Supply Chain'],
      additionalDepartments: {}
    },
    stats: { projects: 7, ongoing: 0, revenue: '$190', rating: 4.9, progressPercentage: 92 },
    createdAt: '2024-01-10'
  },
  {
    id: '3',
    name: 'Freyr Software Services Pvt Ltd',
    industry: 'Technology',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500001',
    website: 'www.freyr.com',
    contactPerson: {
      name: 'Priya Sharma',
      designation: 'CTO',
      email: 'priya@freyr.com',
      mobile: '+91 9876543212'
    },
    auditUniverse: {
      units: ['Development Center'],
      departments: ['Engineering', 'QA', 'DevOps'],
      additionalDepartments: {}
    },
    stats: { projects: 0, ongoing: 0, revenue: '$0', rating: 5.0, progressPercentage: 0 },
    createdAt: '2024-01-20'
  },
  {
    id: '4',
    name: 'Titan Company Limited-West Bengal',
    industry: 'Retail',
    location: 'Kolkata, India',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700001',
    website: 'www.titan.co.in',
    contactPerson: {
      name: 'Amit Das',
      designation: 'Regional Manager',
      email: 'amit@titan.co.in',
      mobile: '+91 9876543213'
    },
    auditUniverse: {
      units: ['Retail Store'],
      departments: ['Sales', 'Inventory', 'Customer Service'],
      additionalDepartments: {}
    },
    stats: { projects: 0, ongoing: 0, revenue: '$73', rating: 4.7, progressPercentage: 45 },
    createdAt: '2024-01-12'
  },
  {
    id: '5',
    name: 'Titan Company Limited-Rajasthan',
    industry: 'Retail',
    location: 'Jaipur, India',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    website: 'www.titan.co.in',
    contactPerson: {
      name: 'Rohit Agarwal',
      designation: 'Store Manager',
      email: 'rohit@titan.co.in',
      mobile: '+91 9876543214'
    },
    auditUniverse: {
      units: ['Retail Store'],
      departments: ['Sales', 'Inventory'],
      additionalDepartments: {}
    },
    stats: { projects: 0, ongoing: 0, revenue: '$92', rating: 4.6, progressPercentage: 60 },
    createdAt: '2024-01-08'
  },
  {
    id: '6',
    name: 'ENES TEXTILE MILLS',
    industry: 'Textile',
    location: 'TIRUPUR, India',
    city: 'Tirupur',
    state: 'Tamil Nadu',
    pincode: '641601',
    website: 'www.enestextiles.com',
    contactPerson: {
      name: 'Mohammed Ali',
      designation: 'Production Head',
      email: 'ali@enestextiles.com',
      mobile: '+91 9876543215'
    },
    auditUniverse: {
      units: ['Textile Mill 1'],
      departments: ['Weaving', 'Dyeing', 'Finishing'],
      additionalDepartments: {}
    },
    stats: { projects: 0, ongoing: 0, revenue: '$0', rating: 4.5, progressPercentage: 20 },
    createdAt: '2024-01-05'
  }
];

const states = [
  'Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Maharashtra', 
  'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Delhi', 'Haryana'
];

const sectors = [
  'Manufacturing', 'Technology', 'Healthcare', 'Finance', 'Retail', 'Food & Beverages',
  'Textile', 'Automotive', 'Chemical', 'Construction', 'Education', 'Energy'
];
const industryOptions = [...sectors];

const unitOptions = [
  'Factory 1', 'Factory 2', 'Head Office', 'Branch Office', 'Warehouse',
  'Distribution Center', 'Retail Store', 'Service Center'
];

const departmentOptions = [
  'Production', 'Quality Control', 'Finance', 'Human Resources', 'Marketing',
  'Sales', 'IT', 'Supply Chain', 'Research & Development', 'Legal'
];

const UnitsMultiSelect = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<string[]>(() => unitOptions);
  const [newUnit, setNewUnit] = React.useState('');
  const display = value && value.length ? (value.length <= 2 ? value.join(', ') : `${value.slice(0,2).join(', ')} (+${value.length-2})`) : 'Select units';
  const toggle = (u: string) => {
    let next = Array.isArray(value) ? [...value] : [];
    const has = next.includes(u);
    if (has) next = next.filter(x => x !== u); else next.push(u);
    onChange(next);
  };
  const addNew = () => {
    const name = newUnit.trim();
    if (!name) return;
    const existing = options.find(o => o.toLowerCase() === name.toLowerCase());
    if (existing) { toggle(existing); setNewUnit(''); return; }
    const next = [...options, name];
    setOptions(next);
    toggle(name);
    setNewUnit('');
  };
  const stop = (e:any) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{display}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-72 p-0">
        <Command>
          <CommandInput placeholder="Search units..." />
          <CommandEmpty>No unit found.</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandGroup heading="Units">
              {options.map(opt => (
                <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                  <Checkbox className="mr-2" checked={value?.includes(opt)} onClick={stop} onMouseDown={stop} onCheckedChange={() => toggle(opt)} /> {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              placeholder="Add new unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }}
            />
            <Button size="sm" onClick={addNew}>Add</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const DepartmentsMultiSelect = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<string[]>(() => departmentOptions);
  const [newDept, setNewDept] = React.useState('');
  const display = value && value.length ? (value.length <= 2 ? value.join(', ') : `${value.slice(0,2).join(', ')} (+${value.length-2})`) : 'Select departments';
  const toggle = (dep: string) => {
    let next = Array.isArray(value) ? [...value] : [];
    const has = next.includes(dep);
    if (has) next = next.filter(d => d !== dep); else next.push(dep);
    onChange(next);
  };
  const addNew = () => {
    const name = newDept.trim();
    if (!name) return;
    const existing = options.find(o => o.toLowerCase() === name.toLowerCase());
    if (existing) { toggle(existing); setNewDept(''); return; }
    const next = [...options, name];
    setOptions(next);
    toggle(name);
    setNewDept('');
  };
  const stop = (e:any) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{display}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-72 p-0">
        <Command>
          <CommandInput placeholder="Search departments..." />
          <CommandEmpty>No department found.</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandGroup heading="Departments">
              {options.map(dep => (
                <CommandItem key={dep} value={dep} onSelect={() => toggle(dep)}>
                  <Checkbox className="mr-2" checked={value?.includes(dep)} onClick={stop} onMouseDown={stop} onCheckedChange={() => toggle(dep)} /> {dep}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              placeholder="Add new department"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addNew(); }}
            />
            <Button size="sm" onClick={addNew}>Add</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>('all');

  // New client form state
  const [newClient, setNewClient] = useState<Partial<Client>>({
    name: '',
    industry: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    pincode: '',
    website: '',
    logo: '',
    contactPersons: [{ name: '', designation: '', email: '', mobile: '' }],
    contactPerson: { name: '', designation: '', email: '', mobile: '' },
    auditUniverse: {
      units: [],
      departments: [],
      additionalDepartments: {}
    }
  });

  const [auditSections, setAuditSections] = useState<{ unit: string[]; departments: string[] }[]>(() => {
    const au = ({} as any) || {};
    try {
      // newClient is defined above; use its auditUniverse as default
      const defaultAU = ({} as any);
    } catch (e) {
      // fallback
    }
    const auDefault = (typeof newClient !== 'undefined' && newClient.auditUniverse) ? newClient.auditUniverse as any : { units: [], departments: [], sections: [] };
    if (Array.isArray(auDefault.sections) && auDefault.sections.length) {
      return auDefault.sections.map((s: any) => ({ unit: s.unit || [], departments: s.departments || [] }));
    }
    return [{ unit: auDefault.units || [], departments: auDefault.departments || [] }];
  });

  // when newClient.auditUniverse changes (e.g., editing), sync auditSections
  React.useEffect(() => {
    const auDefault = (typeof newClient !== 'undefined' && newClient.auditUniverse) ? newClient.auditUniverse as any : { units: [], departments: [], sections: [] };
    if (Array.isArray(auDefault.sections) && auDefault.sections.length) {
      setAuditSections(auDefault.sections.map((s: any) => ({ unit: s.unit || [], departments: s.departments || [] })));
    } else {
      setAuditSections([{ unit: auDefault.units || [], departments: auDefault.departments || [] }]);
    }
  }, [newClient.auditUniverse]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedClientDetails, setSelectedClientDetails] = useState<Client | null>(null);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<Partial<Client>>({
    name: '',
    industry: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    pincode: '',
    website: '',
    logo: '',
    contactPersons: [{ name: '', designation: '', email: '', mobile: '' }],
    contactPerson: { name: '', designation: '', email: '', mobile: '' },
    auditUniverse: { units: [], departments: [], additionalDepartments: {} }
  });

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = selectedSector === 'all' || client.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  const handleAddClient = () => {
    const firstContactName = (newClient.contactPersons && newClient.contactPersons[0] && newClient.contactPersons[0].name) || '';
    if (!newClient.name || !firstContactName) return;

    // Build auditUniverse from auditSections
    const sections = auditSections || [];
    const units = Array.from(new Set(sections.flatMap(s => s.unit || [])));
    const departments = Array.from(new Set(sections.flatMap(s => s.departments || [])));
    const additionalDepartments: { [unit: string]: string[] } = {};

    const client: Client = {
      id: Date.now().toString(),
      name: newClient.name || '',
      sector: newClient.sector || '',
      industry: newClient.industry || '',
      location: `${newClient.city || ''}, India`,
      city: newClient.city || '',
      state: newClient.state || '',
      pincode: newClient.pincode || '',
      street1: newClient.street1,
      street2: newClient.street2,
      website: newClient.website,
      logo: newClient.logo,
      contactPersons: newClient.contactPersons || [{ name: '', designation: '', email: '', mobile: '' }],
      contactPerson: (newClient.contactPersons && newClient.contactPersons[0]) || { name: '', designation: '', email: '', mobile: '' },
      auditUniverse: {
        units,
        departments,
        additionalDepartments,
        sections: sections.map(s => ({ unit: s.unit, departments: s.departments }))
      },
      stats: { projects: 0, ongoing: 0, revenue: '$0', rating: 0, progressPercentage: 0 },
      createdAt: new Date().toISOString().split('T')[0]
    };

    setClients([...clients, client]);
    setNewClient({
      name: '',
      sector: '',
      industry: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      pincode: '',
      website: '',
      logo: '',
      contactPersons: [{ name: '', designation: '', email: '', mobile: '' }],
      contactPerson: { name: '', designation: '', email: '', mobile: '' },
      auditUniverse: { units: [], departments: [], additionalDepartments: {} }
    });
    setAuditSections([]);
    setIsNewClientOpen(false);
  };

  const openEditClient = (c: Client) => {
    setIsDetailsOpen(false);
    setEditClientId(c.id);
    setEditClient({
      id: c.id,
      name: c.name,
      sector: c.sector,
      industry: c.industry,
      street1: c.street1,
      street2: c.street2,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      website: c.website,
      logo: c.logo,
      contactPersons: c.contactPersons && c.contactPersons.length ? c.contactPersons : [c.contactPerson || { name: '', designation: '', email: '', mobile: '' }],
      contactPerson: (c.contactPersons && c.contactPersons[0]) || c.contactPerson || { name: '', designation: '', email: '', mobile: '' },
      auditUniverse: c.auditUniverse
    });
    const au = c.auditUniverse;
    const nextSections = (au.sections && au.sections.length) ? au.sections.map(s => ({ unit: s.unit, departments: s.departments })) : [{ unit: au.units || [], departments: au.departments || [] }];
    setAuditSections(nextSections);
    setIsEditClientOpen(true);
  };

  const handleUpdateClient = () => {
    const firstContactName = (editClient.contactPersons && editClient.contactPersons[0] && editClient.contactPersons[0].name) || '';
    if (!editClientId || !editClient.name || !firstContactName) return;

    const sections = auditSections || [];
    const units = Array.from(new Set(sections.flatMap(s => s.unit || [])));
    const departments = Array.from(new Set(sections.flatMap(s => s.departments || [])));

    let updatedObj: Client | null = null;
    const next = clients.map(cl => {
      if (cl.id !== editClientId) return cl;
      const updated: Client = {
        ...cl,
        name: editClient.name || cl.name,
        sector: editClient.sector || cl.sector,
        industry: editClient.industry || cl.industry,
        location: `${editClient.city || cl.city}, India`,
        city: editClient.city || cl.city,
        state: editClient.state || cl.state,
        pincode: editClient.pincode || cl.pincode,
        street1: editClient.street1,
        street2: editClient.street2,
        website: editClient.website,
        logo: editClient.logo,
        contactPersons: editClient.contactPersons || cl.contactPersons,
        contactPerson: (editClient.contactPersons && editClient.contactPersons[0]) || editClient.contactPerson || cl.contactPerson,
        auditUniverse: {
          units,
          departments,
          additionalDepartments: {},
          sections: sections.map(s => ({ unit: s.unit, departments: s.departments }))
        },
      };
      updatedObj = updated;
      return updated;
    });
    setClients(next);
    if (updatedObj) setSelectedClientDetails(updatedObj);
    setIsEditClientOpen(false);
  };

  const ClientCard = ({ client }: { client: Client }) => (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                {client.name}
              </h3>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                <MapPin className="h-3 w-3 mr-1" />
                {client.location}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-6 mb-2">
              <div>
                <div className="text-2xl font-bold text-blue-600">{client.stats.projects}</div>
                <p className="text-sm text-gray-600 font-medium">Projects</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{client.stats.ongoing}</div>
                <p className="text-sm text-gray-600 font-medium">In Progress</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            {client.sector || client.industry}
          </Badge>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setSelectedClientDetails(client); setIsDetailsOpen(true); }}>
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900"><p>Clients</p></h1>
          <p className="text-sm text-gray-600">Manage your client relationships</p>
        </div>
        <Dialog open={isNewClientOpen} onOpenChange={setIsNewClientOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Client Master</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Client Name */}
              <div>
                <Label htmlFor="clientName" className="text-sm font-medium">
                  Client Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="clientName"
                  value={newClient.name || ''}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Enter client name"
                  className="mt-1"
                />
              </div>

              {/* Sector & Industry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Sector</Label>
                  <Select value={newClient.sector || ''} onValueChange={(value) => setNewClient({ ...newClient, sector: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map(sec => (
                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Industry</Label>
                  <Select value={newClient.industry || ''} onValueChange={(value) => setNewClient({ ...newClient, industry: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industryOptions.map(ind => (
                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Client Address */}
              <div>
                <Label className="text-sm font-medium">Client Address</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Input
                      placeholder="Street 1"
                      value={newClient.street1 || ''}
                      onChange={(e) => setNewClient({ ...newClient, street1: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Street 2"
                      value={newClient.street2 || ''}
                      onChange={(e) => setNewClient({ ...newClient, street2: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="City"
                      value={newClient.city || ''}
                      onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Select 
                      value={newClient.state || ''} 
                      onValueChange={(value) => setNewClient({ ...newClient, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input
                      placeholder="Pincode"
                      value={newClient.pincode || ''}
                      onChange={(e) => setNewClient({ ...newClient, pincode: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Website */}
              <div>
                <Label htmlFor="website" className="text-sm font-medium">Website</Label>
                <Input
                  id="website"
                  value={newClient.website || ''}
                  onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
                  placeholder="Enter website URL"
                  className="mt-1"
                />
              </div>

              {/* Client Logo */}
              <div>
                <Label htmlFor="logo" className="text-sm font-medium">Client Logo</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Audit Universe */}
              <div>
                <Label className="text-sm font-medium">Audit Universe</Label>
                <div className="space-y-3 mt-2">
                  {auditSections.map((sec, idx) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <UnitsMultiSelect value={sec.unit} onChange={(val) => {
                            const updated = [...auditSections];
                            updated[idx] = { ...updated[idx], unit: val };
                            setAuditSections(updated);
                          }} />
                        </div>
                      </div>

                      <div className="mt-3">
                        <Label className="text-xs">Departments</Label>
                        <div className="mt-2">
                          <DepartmentsMultiSelect value={sec.departments} onChange={(val) => {
                            const updated = [...auditSections];
                            updated[idx] = { ...updated[idx], departments: val };
                            setAuditSections(updated);
                          }} />
                        </div>
                      </div>

                    </div>
                  ))}

                </div>
              </div>

              {/* Contact Persons */}
              <div>
                <Label className="text-sm font-medium">Contact Person(s)</Label>
                <div className="space-y-3 mt-2">
                  {(newClient.contactPersons || []).map((cp, idx) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Input
                            placeholder="Name"
                            value={cp.name}
                            onChange={(e) => {
                              const next = [...(newClient.contactPersons || [])];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setNewClient({ ...newClient, contactPersons: next, contactPerson: next[0] });
                            }}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Designation"
                            value={cp.designation}
                            onChange={(e) => {
                              const next = [...(newClient.contactPersons || [])];
                              next[idx] = { ...next[idx], designation: e.target.value };
                              setNewClient({ ...newClient, contactPersons: next, contactPerson: next[0] });
                            }}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Email"
                            type="email"
                            value={cp.email}
                            onChange={(e) => {
                              const next = [...(newClient.contactPersons || [])];
                              next[idx] = { ...next[idx], email: e.target.value };
                              setNewClient({ ...newClient, contactPersons: next, contactPerson: next[0] });
                            }}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Mobile"
                            value={cp.mobile}
                            onChange={(e) => {
                              const next = [...(newClient.contactPersons || [])];
                              next[idx] = { ...next[idx], mobile: e.target.value };
                              setNewClient({ ...newClient, contactPersons: next, contactPerson: next[0] });
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => {
                          const next = (newClient.contactPersons || []).filter((_, i) => i !== idx);
                          setNewClient({ ...newClient, contactPersons: next.length ? next : [{ name: '', designation: '', email: '', mobile: '' }], contactPerson: (next[0] || { name: '', designation: '', email: '', mobile: '' }) });
                        }} disabled={(newClient.contactPersons || []).length <= 1}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div>
                    <Button size="sm" onClick={() => {
                      const next = [...(newClient.contactPersons || []), { name: '', designation: '', email: '', mobile: '' }];
                      setNewClient({ ...newClient, contactPersons: next, contactPerson: next[0] });
                    }}>+ Add Contact Person</Button>
                  </div>
                </div>
              </div>

              <Button onClick={handleAddClient} className="w-full">
                Add Client
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Sectors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sectors</SelectItem>
              {sectors.map(sec => (
                <SelectItem key={sec} value={sec}>{sec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
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

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {filteredClients.length} of {clients.length} clients
        </p>
      </div>

      {/* Client Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredClients.map((client, index) => (
                <div
                  key={client.id}
                  className={`flex items-center justify-between p-4 hover:bg-gray-50 ${
                    index !== filteredClients.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{client.name}</h3>
                      <p className="text-sm text-gray-500">{client.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <Badge variant="secondary">{client.industry}</Badge>
                    <div className="text-right">
                      <p className="text-sm font-medium">{client.stats.revenue}</p>
                      <p className="text-xs text-gray-500">Revenue</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedClientDetails(client); setIsDetailsOpen(true); }}>
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Client Details</DialogTitle>
              {selectedClientDetails && (
                <Button size="sm" className="mr-2" onClick={() => openEditClient(selectedClientDetails)}>Edit</Button>
              )}
            </div>
          </DialogHeader>
          {selectedClientDetails ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedClientDetails.name}</h3>
                  <p className="text-sm text-gray-600">{selectedClientDetails.sector || selectedClientDetails.industry}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">Created: {selectedClientDetails.createdAt}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-700"><span className="font-medium">Location:</span> {selectedClientDetails.location}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium">Website:</span> {selectedClientDetails.website || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-700"><span className="font-medium">City:</span> {selectedClientDetails.city}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium">State:</span> {selectedClientDetails.state}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Contact Person(s)</h4>
                <div className="space-y-3">
                  {(selectedClientDetails.contactPersons || [selectedClientDetails.contactPerson || { name: '', designation: '', email: '', mobile: '' }]).map((cp, i) => (
                    <div key={i} className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-700">{cp?.name || '-'}</p>
                        <p className="text-xs text-gray-500">Name</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{cp?.designation || '-'}</p>
                        <p className="text-xs text-gray-500">Designation</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{cp?.email || '-'}</p>
                        <p className="text-xs text-gray-500">Email</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Audit Universe</h4>
                <div className="space-y-3">
                  {selectedClientDetails.auditUniverse.sections && selectedClientDetails.auditUniverse.sections.length > 0 ? (
                    selectedClientDetails.auditUniverse.sections.map((sec, i) => (
                      <div key={i} className="border p-3 rounded">
                        <p className="text-sm text-gray-700"><span className="font-medium">Units:</span> {sec.unit.join(', ')}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Departments:</span> {sec.departments.join(', ')}</p>
                      </div>
                    ))
                  ) : (
                    <div>
                      <p className="text-sm text-gray-700"><span className="font-medium">Units:</span> {selectedClientDetails.auditUniverse.units.join(', ') || '-'}</p>
                      <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Departments:</span> {selectedClientDetails.auditUniverse.departments.join(', ') || '-'}</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <p>No details available</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Client dialog */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="clientNameEdit" className="text-sm font-medium">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientNameEdit"
                value={editClient.name || ''}
                onChange={(e) => setEditClient({ ...editClient, name: e.target.value })}
                placeholder="Enter client name"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Sector</Label>
                <Select value={editClient.sector || ''} onValueChange={(value) => setEditClient({ ...editClient, sector: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map(sec => (
                      <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Industry</Label>
                <Select value={editClient.industry || ''} onValueChange={(value) => setEditClient({ ...editClient, industry: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industryOptions.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Client Address</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Input
                    placeholder="Street 1"
                    value={editClient.street1 || ''}
                    onChange={(e) => setEditClient({ ...editClient, street1: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Street 2"
                    value={editClient.street2 || ''}
                    onChange={(e) => setEditClient({ ...editClient, street2: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    placeholder="City"
                    value={editClient.city || ''}
                    onChange={(e) => setEditClient({ ...editClient, city: e.target.value })}
                  />
                </div>
                <div>
                  <Select
                    value={editClient.state || ''}
                    onValueChange={(value) => setEditClient({ ...editClient, state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    placeholder="Pincode"
                    value={editClient.pincode || ''}
                    onChange={(e) => setEditClient({ ...editClient, pincode: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="websiteEdit" className="text-sm font-medium">Website</Label>
              <Input
                id="websiteEdit"
                value={editClient.website || ''}
                onChange={(e) => setEditClient({ ...editClient, website: e.target.value })}
                placeholder="Enter website URL"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Audit Universe</Label>
              <div className="space-y-3 mt-2">
                {auditSections.map((sec, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <UnitsMultiSelect value={sec.unit} onChange={(val) => {
                          const updated = [...auditSections];
                          updated[idx] = { ...updated[idx], unit: val };
                          setAuditSections(updated);
                        }} />
                      </div>
                    </div>

                    <div className="mt-3">
                      <Label className="text-xs">Departments</Label>
                      <div className="mt-2">
                        <DepartmentsMultiSelect value={sec.departments} onChange={(val) => {
                          const updated = [...auditSections];
                          updated[idx] = { ...updated[idx], departments: val };
                          setAuditSections(updated);
                        }} />
                      </div>
                    </div>

                  </div>
                ))}

              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Contact Person(s)</Label>
              <div className="space-y-3 mt-2">
                {(editClient.contactPersons || []).map((cp, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Input
                          placeholder="Name"
                          value={cp.name}
                          onChange={(e) => {
                            const next = [...(editClient.contactPersons || [])];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setEditClient({ ...editClient, contactPersons: next, contactPerson: next[0] });
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Designation"
                          value={cp.designation}
                          onChange={(e) => {
                            const next = [...(editClient.contactPersons || [])];
                            next[idx] = { ...next[idx], designation: e.target.value };
                            setEditClient({ ...editClient, contactPersons: next, contactPerson: next[0] });
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Email"
                          type="email"
                          value={cp.email}
                          onChange={(e) => {
                            const next = [...(editClient.contactPersons || [])];
                            next[idx] = { ...next[idx], email: e.target.value };
                            setEditClient({ ...editClient, contactPersons: next, contactPerson: next[0] });
                          }}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Mobile"
                          value={cp.mobile}
                          onChange={(e) => {
                            const next = [...(editClient.contactPersons || [])];
                            next[idx] = { ...next[idx], mobile: e.target.value };
                            setEditClient({ ...editClient, contactPersons: next, contactPerson: next[0] });
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => {
                        const next = (editClient.contactPersons || []).filter((_, i) => i !== idx);
                        setEditClient({ ...editClient, contactPersons: next.length ? next : [{ name: '', designation: '', email: '', mobile: '' }], contactPerson: (next[0] || { name: '', designation: '', email: '', mobile: '' }) });
                      }} disabled={(editClient.contactPersons || []).length <= 1}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                <div>
                  <Button size="sm" onClick={() => {
                    const next = [...(editClient.contactPersons || []), { name: '', designation: '', email: '', mobile: '' }];
                    setEditClient({ ...editClient, contactPersons: next, contactPerson: next[0] });
                  }}>+ Add Contact Person</Button>
                </div>
              </div>
            </div>

            <Button onClick={handleUpdateClient} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No clients found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedSector !== 'all'
                ? "Try adjusting your search or filters"
                : "Get started by adding your first client"}
            </p>
            {!searchTerm && selectedSector === 'all' && (
              <Button onClick={() => setIsNewClientOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Client
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
