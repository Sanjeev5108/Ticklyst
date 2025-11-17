import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Filter as FilterIcon,
  Columns2,
  Rows3,
  Download,
  Trash2,
  Maximize2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Plus, MessageSquare, Send } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { FieldworkStore } from "@/contexts/FieldworkStore";
import { FieldworkRecord } from "@shared/fieldwork";
import { useAuth } from "@/contexts/AuthContext";

interface AuditTrackRow {
  id: string;
  auditObservation: string;
  actionPlan: string;
  responsibility: string;
  designation: string;
  department: string;
  dueDate: string;
  actualCompletionDate?: string;
  previousDueDates?: string[];
  status: string;
}

interface Client {
  id: string;
  name: string;
  description: string;
  status: "completed" | "in-progress";
  industry: string;
  assignedProjects: number;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: "note" | "issue" | "resolution";
}

const statuses = ["Open", "In Progress", "Closed", "Overdue"];

// Date helpers: ensure previous due dates are valid and reasonable (year range 1900–2100)
const isValidISODate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100) return false;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return !isNaN(dt.getTime());
};
const sanitizePrevDates = (arr?: string[]) => (arr || []).filter(isValidISODate);

const MultiSelectSimple = ({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = React.useState(false);
  const display =
    value && value.length
      ? value.length <= 2
        ? value.join(", ")
        : `${value.slice(0, 2).join(", ")} (+${value.length - 2})`
      : placeholder || "Select";
  const toggle = (opt: string) => {
    let next = Array.isArray(value) ? [...value] : [];
    const has = next.includes(opt);
    if (has) next = next.filter((x) => x !== opt);
    else next.push(opt);
    onChange(next);
  };
  const stop = (e: any) => {
    e.stopPropagation();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{display}</span>
          <span className="ml-2 text-xs text-muted-foreground">Select</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[80]">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>No results.</CommandEmpty>
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                  <Checkbox
                    className="mr-2"
                    checked={value?.includes(opt)}
                    onPointerDown={stop}
                    onMouseDown={stop}
                    onClick={stop}
                    onCheckedChange={() => toggle(opt)}
                  />{" "}
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2 flex justify-between">
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Clear
          </Button>
          <Button size="sm" onClick={() => onChange([...options])}>
            Select All
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ExpandableChartCardProps {
  title: React.ReactNode;
  cardClassName?: string;
  children: (innerClassName: string) => React.ReactNode;
}

const ExpandableChartCard: React.FC<ExpandableChartCardProps> = ({
  title,
  cardClassName,
  children,
}) => {
  const cardClasses = ["shadow-sm", cardClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog>
      <Card className={cardClasses}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="sr-only">Expand chart</span>
            </Button>
          </DialogTrigger>
        </CardHeader>
        <CardContent>{children("h-72")}</CardContent>
      </Card>
      <DialogContent className="max-w-5xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 h-[60vh]">{children("h-full")}</div>
      </DialogContent>
    </Dialog>
  );
};

export default function ATRDashboard() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<
    "note" | "issue" | "resolution"
  >("note");
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);

  const [clients] = useState<Client[]>([
    {
      id: "CLT-001",
      name: "Bull Machines India Pvt. LTD",
      description:
        "Manufacturing and production company specializing in industrial machinery",
      status: "in-progress",
      industry: "Manufacturing",
      assignedProjects: 2,
    },
    {
      id: "CLT-002",
      name: "Supreme Mobiles",
      description: "Mobile phone retail and distribution company",
      status: "in-progress",
      industry: "Retail",
      assignedProjects: 1,
    },
    {
      id: "CLT-003",
      name: "Thalapakatti Hospitality Pvt. LTD",
      description: "Restaurant chain and hospitality services",
      status: "completed",
      industry: "Hospitality",
      assignedProjects: 1,
    },
    {
      id: "CLT-004",
      name: "KTM",
      description: "Automotive and motorcycle manufacturing",
      status: "in-progress",
      industry: "Automotive",
      assignedProjects: 3,
    },
    {
      id: "CLT-005",
      name: "KMCH",
      description: "Healthcare and medical services provider",
      status: "completed",
      industry: "Healthcare",
      assignedProjects: 1,
    },
  ]);

  // Controls (copied parsing logic from Fieldwork) ------------------------------------------------
  interface ControlRow {
    id: string;
    name: string;
    process?: string;
    subprocess?: string;
    activity?: string;
    risk?: string;
  }
  const FRAMEWORK_DATA_URL =
    "https://cdn.builder.io/o/assets%2F977aa5fd74e44b0b93e04285eac4a20c%2Feee14d66d4fb432282ea6ee92ec74183?alt=media&token=416386ad-d7e8-48b3-8b35-0a67061828b1&apiKey=977aa5fd74e44b0b93e04285eac4a20c";
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [controlsSearch, setControlsSearch] = useState("");
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [fwRecords, setFwRecords] = useState<Record<string, FieldworkRecord>>(
    {},
  );
  const [projects, setProjects] = useState<
    { id: string; title: string; raw?: any }[]
  >([]);
  const [reportableProjectFilter, setReportableProjectFilter] =
    useState<string>("");
  const { user } = useAuth();

  useEffect(() => {
    const unsub = FieldworkStore.subscribe(() =>
      setFwRecords(FieldworkStore.getAll()),
    );
    setFwRecords(FieldworkStore.getAll());
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const rows = await res.json();
        const mapped = (rows || []).map((r: any) => ({
          id: r.id,
          title: r.name || r.data?.projectName || r.code || "Untitled Project",
          raw: r,
        }));

        const roleScopeMap = (() => {
          try {
            return JSON.parse(localStorage.getItem("roleProjectScope") || "{}");
          } catch {
            return {};
          }
        })();
        const userScopeMap = (() => {
          try {
            return JSON.parse(localStorage.getItem("userProjectScope") || "{}");
          } catch {
            return {};
          }
        })();
        const scope =
          user?.id && userScopeMap[user.id]
            ? userScopeMap[user.id]
            : user?.role
              ? roleScopeMap[user.role]
              : "all";
        const normalizedRole = (user?.role || "").toLowerCase();
        const isTargetRole = [
          "division partner",
          "partner",
          "division head",
          "team leader",
          "team member",
        ].includes(normalizedRole);
        const userName = user?.username || "";
        const initials = userName
          .split(" ")
          .map((s: string) => s[0])
          .join("");
        const isOnProject = (prj: any) => {
          const d = prj?.raw?.data || {};
          const lists: string[][] = [
            d.divisionHeads || [],
            d.partners || [],
            d.teamLeaders || [],
            d.teamMembers || [],
          ];
          const flat = lists.flat().map((s: string) => String(s || ""));
          return flat.includes(userName) || flat.includes(initials);
        };
        const filtered =
          scope === "own" && isTargetRole && user
            ? mapped.filter(isOnProject)
            : mapped;
        setProjects(filtered);
      } catch {}
    })();
  }, [user]);

  useEffect(() => {
    if (controls.length) return;
    const normalizeRows = (data: any): any[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if ((data as any).Sheet1 && Array.isArray((data as any).Sheet1))
        return (data as any).Sheet1;
      if ((data as any).sheets && typeof (data as any).sheets === "object") {
        const first = Object.values((data as any).sheets)[0] as any[];
        if (Array.isArray(first)) return first;
      }
      const keys = Object.keys(data);
      if (keys.length === 1 && Array.isArray((data as any)[keys[0]]))
        return (data as any)[keys[0]];
      return [];
    };

    (async () => {
      try {
        const res = await fetch(FRAMEWORK_DATA_URL);
        const json = await res.json();
        const rows = normalizeRows(json);
        if (!rows.length) return;
        const controlsList: ControlRow[] = [];
        const procIndex = new Map<string, string>();
        const subIndex = new Map<string, string>();
        const actIndex = new Map<string, string>();
        const riskCounts = new Map<string, number>();
        const ctrlCounts = new Map<string, number>();
        const get = (row: any, keys: string[]) => {
          for (const k of keys) {
            const v = row[k];
            if (v != null && String(v).trim() !== "") return String(v).trim();
          }
          return "";
        };
        const getNext = {
          proc: () => `P${procIndex.size + 1}`,
          sub: (p: string) =>
            `${p}.${Array.from(subIndex.values()).filter((id) => id.startsWith(p + ".")).length + 1}`,
          act: (s: string) =>
            `${s}.${Array.from(actIndex.values()).filter((id) => id.startsWith(s + ".")).length + 1}`,
          risk: (a: string) => {
            const c = (riskCounts.get(a) || 0) + 1;
            riskCounts.set(a, c);
            return `${a}/R${c}`;
          },
          ctrl: (r: string) => {
            const c = (ctrlCounts.get(r) || 0) + 1;
            ctrlCounts.set(r, c);
            return `${r}/C${c}`;
          },
        };
        for (const row of rows) {
          const processName = get(row, ["Process", "process", "PROCESS"]);
          const subName = get(row, ["Sub Process", "SubProcess", "subprocess"]);
          const activityName = get(row, ["Activity", "activity"]);
          const riskDesc = get(row, [
            "Identification of Risk of Material Misstatement (What could go wrong?) Risk Description",
            "Risk Description",
            "Risk",
            "risk",
          ]);
          const controlDesc = get(row, [
            "Controls in Place",
            "Control",
            "Control Description",
          ]);
          if (!processName) continue;
          let procId = procIndex.get(processName);
          if (!procId) {
            procId = getNext.proc();
            procIndex.set(processName, procId);
          }
          let subId = "";
          if (subName) {
            const key = procId + "|" + subName;
            subId = subIndex.get(key) || "";
            if (!subId) {
              subId = getNext.sub(procId);
              subIndex.set(key, subId);
            }
          }
          let actId = "";
          if (activityName) {
            const key = (subId || procId) + "|" + activityName;
            actId = actIndex.get(key) || "";
            if (!actId) {
              const parent = subId || getNext.sub(procId);
              if (!subId) {
                subId = parent;
              }
              actId = getNext.act(subId);
              actIndex.set(key, actId);
            }
          }
          let riskId = "";
          if (riskDesc) {
            const parentAct =
              actId ||
              (() => {
                if (!subId) {
                  subId = getNext.sub(procId);
                }
                return getNext.act(subId);
              })();
            riskId = getNext.risk(parentAct);
          }
          if (riskId && controlDesc) {
            const ctrlId = getNext.ctrl(riskId);
            controlsList.push({
              id: ctrlId,
              name: controlDesc || "Control",
              process: processName,
              subprocess: subName || "General",
              activity: activityName || "General",
              risk: riskDesc,
            });
          }
        }
        setControls(controlsList);
      } catch (err) {
        console.error("Failed to fetch framework", err);
      }
    })();
  }, [controls.length]);

  const [auditTrackData, setAuditTrackData] = useState<AuditTrackRow[]>([
    {
      id: "at1",
      auditObservation: "",
      actionPlan: "",
      responsibility: "",
      designation: "",
      department: "",
      dueDate: "",
      previousDueDates: [],
      status: "",
    },
  ]);

  const [comments, setComments] = useState<Comment[]>([]);

  const updateAuditTrackField = (
    id: string,
    field: keyof AuditTrackRow,
    value: string,
  ) => {
    setAuditTrackData((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === "dueDate") {
          const prevDate = row.dueDate;
          if (prevDate && prevDate !== value && isValidISODate(prevDate)) {
            const prevList = row.previousDueDates
              ? [...row.previousDueDates]
              : [];
            prevList.unshift(prevDate);
            return {
              ...row,
              dueDate: value,
              previousDueDates: prevList,
            } as AuditTrackRow;
          }
          return { ...row, dueDate: value } as AuditTrackRow;
        }
        return { ...row, [field]: value } as AuditTrackRow;
      }),
    );
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
  };

  const handleBackToClients = () => {
    setSelectedClient(null);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: "Team Member",
      content: newComment.trim(),
      timestamp: new Date().toLocaleString(),
      type: commentType,
    };

    setComments((prev) => [...prev, comment]);
    setNewComment("");
    setIsCommentDialogOpen(false);
  };

  const getCommentTypeColor = (type: string) => {
    const colors = {
      note: "bg-blue-100 text-blue-800",
      issue: "bg-red-100 text-red-800",
      resolution: "bg-green-100 text-green-800",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const renderATREditor = () => {
    const selectedClientData = clients.find((c) => c.id === selectedClient);
    // If editing a control, editor should be editable. If viewing a completed client ATR, read-only.
    const isReadOnly = !!selectedControl
      ? false
      : selectedClientData?.status === "completed";

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            ATR Editor (Audit Track Report)
          </h3>
          <div className="flex gap-2">
            <Dialog
              open={isCommentDialogOpen}
              onOpenChange={setIsCommentDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-2"
                >
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
              <Button
                onClick={() =>
                  setAuditTrackData((prev) => [
                    ...prev,
                    {
                      id: `at${Date.now()}`,
                      auditObservation: "",
                      actionPlan: "",
                      responsibility: "",
      designation: "",
      department: "",
      dueDate: "",
                      status: "",
                    },
                  ])
                }
                size="sm"
              >
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
                <th className="text-left p-3 border-r">Department</th>
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
                      onChange={(e) =>
                        updateAuditTrackField(
                          row.id,
                          "auditObservation",
                          e.target.value,
                        )
                      }
                      placeholder="Enter audit observation"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.actionPlan}
                      onChange={(e) =>
                        updateAuditTrackField(
                          row.id,
                          "actionPlan",
                          e.target.value,
                        )
                      }
                      placeholder="Enter action plan"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.responsibility}
                      onChange={(e) =>
                        updateAuditTrackField(
                          row.id,
                          "responsibility",
                          e.target.value,
                        )
                      }
                      placeholder="Enter responsibility"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.designation}
                      onChange={(e) =>
                        updateAuditTrackField(
                          row.id,
                          "designation",
                          e.target.value,
                        )
                      }
                      placeholder="Enter designation"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      value={row.department || ""}
                      onChange={(e) =>
                        updateAuditTrackField(
                          row.id,
                          "department",
                          e.target.value,
                        )
                      }
                      placeholder="Enter department"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="p-3 border-r">
                    <Input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) =>
                        updateAuditTrackField(row.id, "dueDate", e.target.value)
                      }
                      disabled={isReadOnly}
                    />
                    {row.previousDueDates &&
                      row.previousDueDates.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          <div>Previous dates:</div>
                          {sanitizePrevDates(row.previousDueDates).map((d, idx) => (
                            <div key={idx}>{d}</div>
                          ))}
                        </div>
                      )}
                  </td>
                  <td className="p-3">
                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        updateAuditTrackField(row.id, "status", value)
                      }
                      disabled={isReadOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
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
              <strong>Read-Only Mode:</strong> This ATR report is completed and
              cannot be edited. You can only view and add comments.
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
                  <div
                    key={comment.id}
                    className="border-l-4 border-blue-200 pl-4 py-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium">
                          {comment.author}
                        </span>
                        <Badge
                          className={`text-xs ${getCommentTypeColor(comment.type)}`}
                        >
                          {comment.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {comment.timestamp}
                      </span>
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

  const reportableRows = useMemo(() => {
    const slug = (s: string) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const partsFromId = (id: string) => {
      const parts = String(id || "").split("|");
      // expect: fw|proc|sub|act|risk|idx
      return { proc: parts[1] || "", sub: parts[2] || "" };
    };
    const all = Object.values(fwRecords || {});
    const approved = all.filter((r) => r.status === "approved");
    const yesReportable = approved.filter((r) => {
      const v = (r as any).arc?.reportable || "";
      return String(v).toLowerCase() === "yes";
    });
    const seen = new Set<string>();
    const rows = [] as {
      id: string;
      projectId?: string;
      control: string;
      process?: string;
      subprocess?: string;
      activity?: string;
      risk?: string;
    }[];
    for (const r of yesReportable) {
      const pid = r.projectId || "GLOBAL";
      const uid = `${pid}|${r.controlId}`;
      if (seen.has(uid)) continue;
      seen.add(uid);
      const a: any = (r as any).arc || {};
      let processName = "";
      let subprocessName = "";
      if (r.projectId) {
        const proj = projects.find((p) => p.id === r.projectId)?.raw;
        const tree = proj?.data?.selectedChecklistTree || {};
        const { proc, sub } = partsFromId(r.controlId);
        // resolve process
        for (const pName of Object.keys(tree || {})) {
          if (slug(pName) === proc) {
            processName = pName;
            const subs = tree[pName]?.subprocesses || {};
            for (const sName of Object.keys(subs)) {
              if (slug(sName) === sub) {
                subprocessName = sName;
                break;
              }
            }
            break;
          }
        }
      }
      if (!processName || !subprocessName) {
        const { proc, sub } = partsFromId(r.controlId);
        processName = processName || proc.replace(/-/g, " ");
        subprocessName = subprocessName || sub.replace(/-/g, " ");
      }
      const match = controls.find((c) => c.id === r.controlId);
      rows.push({
        id: r.controlId,
        projectId: r.projectId,
        control: a.control || match?.name || "",
        process: processName || match?.process || "",
        subprocess: subprocessName || match?.subprocess || "",
        activity: a.activity || match?.activity || "",
        risk: a.risk || match?.risk || "",
      });
    }
    return rows;
  }, [fwRecords, controls, projects]);

  const reportableProjectOptions = useMemo(() => {
    const ids = Array.from(
      new Set(reportableRows.map((r) => r.projectId).filter(Boolean)),
    ) as string[];
    return ids.map((id) => ({
      id,
      title: projects.find((p) => p.id === id)?.title || id,
    }));
  }, [reportableRows, projects]);

  // ATR Access data per project (not linked to controls)
  const [atrRows, setAtrRows] = useState<AuditTrackRow[]>([]);
  const atrKey = selectedProjectId ? `atr:project:${selectedProjectId}` : "";
  const makeEmptyAtrRow = (): AuditTrackRow => ({
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    auditObservation: "",
    actionPlan: "",
    responsibility: "",
    designation: "",
    department: "",
    dueDate: "",
    actualCompletionDate: "",
    previousDueDates: [],
    status: "",
  });
  const addAtrRow = () => {
    setAtrRows((prev) => [...prev, makeEmptyAtrRow()]);
  };
  const deleteAtrRow = (index: number) => {
    setAtrRows((prev) => {
      const arr = [...prev];
      if (arr.length === 0) return prev;
      arr.splice(index, 1);
      if (arr.length === 0) arr.push(makeEmptyAtrRow());
      return arr;
    });
  };
  useEffect(() => {
    (async () => {
      if (!selectedProjectId) {
        setAtrRows([]);
        return;
      }
      try {
        const res = await fetch(`/api/settings/${encodeURIComponent(atrKey)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setAtrRows((data as AuditTrackRow[]).map(r => ({ ...r, previousDueDates: sanitizePrevDates(r.previousDueDates) })));
          else if (data && typeof data === "object") {
            const flat = Object.values(data as any).flat() as AuditTrackRow[];
            setAtrRows(flat.map(r => ({ ...r, previousDueDates: sanitizePrevDates(r.previousDueDates) })));
          }
        }
      } catch {}
      setAtrRows((prev) => (prev.length ? prev : [makeEmptyAtrRow()]));
    })();
  }, [selectedProjectId, atrKey, reportableRows]);

  const updateAtrField = (
    index: number,
    field: keyof AuditTrackRow,
    value: string,
  ) => {
    setAtrRows((prev) => {
      const arr = [...prev];
      const row = arr[index] || makeEmptyAtrRow();
      const next: AuditTrackRow = { ...row } as any;
      if (field === "dueDate") {
        const prevDate = row.dueDate;
        if (prevDate && prevDate !== value && isValidISODate(prevDate))
          next.previousDueDates = [prevDate, ...(row.previousDueDates || [])];
        next.dueDate = value;
      } else {
        (next as any)[field] = value;
      }
      arr[index] = next;
      return arr;
    });
  };

  const saveAtr = async () => {
    if (!selectedProjectId) return;
    try {
      await fetch(`/api/settings/${encodeURIComponent(atrKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atrRows),
      });
    } catch {}
  };

  // Toolbar: filters, fields, export
  const atrAllFields = [
    "Audit Observation",
    "Action Plan",
    "Responsibility",
    "Designation",
    "Department",
    "Due date",
    "Actual Completion date",
    "Status",
  ] as const;
  const [atrSelectedFields, setAtrSelectedFields] = useState<string[]>([
    ...atrAllFields,
  ]);
  const [atrStatusFilter, setAtrStatusFilter] = useState<string>("all");
  const [atrDueFrom, setAtrDueFrom] = useState<string>("");
  const [atrDueTo, setAtrDueTo] = useState<string>("");
  const [atrSearch, setAtrSearch] = useState<string>("");
  const [atrRespFilter, setAtrRespFilter] = useState<string[]>([]);
  const [atrDeptFilter, setAtrDeptFilter] = useState<string[]>([]);
  const [atrGroupBy, setAtrGroupBy] = useState<
    "none" | "status" | "due" | "department" | "person"
  >("none");
  const [vizGroup, setVizGroup] = useState<"weekly" | "monthly">("monthly");

  const atrRowsForProject = useMemo(() => {
    const rows = reportableRows.filter((r) =>
      selectedProjectId ? r.projectId === selectedProjectId : true,
    );
    return rows;
  }, [reportableRows, selectedProjectId]);

  const uniq = (arr: (string | undefined | null)[]) =>
    Array.from(new Set(arr.filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b),
    );
  const atrRespOptions = useMemo(() => {
    const list = atrRows.map((a) => a.responsibility);
    return uniq(list);
  }, [atrRows]);
  const atrDeptOptions = useMemo(() => {
    const list = atrRows.map((a) => a.department);
    return uniq(list);
  }, [atrRows]);

  const atrRowsFiltered = useMemo(() => {
    const filtered = atrRows
      .map((a, idx) => ({ a, idx }))
      .filter(({ a }) => {
        if (atrStatusFilter !== "all" && (a.status || "") !== atrStatusFilter)
          return false;
        if (
          atrDueFrom &&
          (a.dueDate || "") &&
          new Date(a.dueDate) < new Date(atrDueFrom)
        )
          return false;
        if (
          atrDueTo &&
          (a.dueDate || "") &&
          new Date(a.dueDate) > new Date(atrDueTo)
        )
          return false;
        if (
          atrRespFilter.length &&
          !atrRespFilter.includes(a.responsibility || "")
        )
          return false;
        if (
          atrDeptFilter.length &&
          !atrDeptFilter.includes(a.department || "")
        )
          return false;
        const q = atrSearch.trim().toLowerCase();
        if (!q) return true;
        const hay = [
          a.auditObservation,
          a.actionPlan,
          a.responsibility,
          a.designation,
          a.department,
          a.status,
          a.dueDate,
          a.actualCompletionDate,
        ]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase());
        return hay.some((s) => s.includes(q));
      });
    return filtered;
  }, [
    atrRows,
    atrStatusFilter,
    atrDueFrom,
    atrDueTo,
    atrRespFilter,
    atrDeptFilter,
    atrSearch,
  ]);

  if (selectedClient || selectedControl) {
    // If a control is selected, show ATR editor for that control
    const client = selectedClient
      ? clients.find((c) => c.id === selectedClient)
      : undefined;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {selectedControl
                ? `ATR Editor - Control ${selectedControl}`
                : client?.name || "Client"}
            </h1>
            <p className="text-gray-600">
              {selectedControl
                ? `Control ID: ${selectedControl} �� ATR`
                : `Client ID: ${selectedClient} • ${client?.industry} • ATR`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedControl(null);
                setSelectedClient(null);
              }}
            >
              Back to ATR Reports
            </Button>
            <Badge className="bg-green-100 text-green-800">ATR Access</Badge>
          </div>
        </div>

        <Tabs defaultValue="access" className="mt-4">
          <TabsList>
            <TabsTrigger value="reportable">Reportable Controls</TabsTrigger>
            <TabsTrigger value="access">ATR Access</TabsTrigger>
            <TabsTrigger value="visualized">Visualized</TabsTrigger>
          </TabsList>
          <TabsContent value="reportable">
            <Card className="shadow-lg mt-4">
              <CardContent className="p-6">
                <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label>Project</Label>
                    <Select
                      value={selectedProjectId || reportableProjectFilter}
                      onValueChange={(v) => {
                        setReportableProjectFilter(v);
                        setSelectedProjectId(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportableProjectOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ maxHeight: 420, overflow: "auto" }}>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-3 w-40">Control ID</th>
                        <th className="text-left p-3">Control</th>
                        <th className="text-left p-3 w-40">Process</th>
                        <th className="text-left p-3 w-48">Subprocess</th>
                        <th className="text-left p-3 w-40">Activity</th>
                        <th className="text-left p-3 w-48">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportableRows
                        .filter((r) => {
                          if (
                            reportableProjectFilter &&
                            r.projectId !== reportableProjectFilter
                          )
                            return false;
                          const q = controlsSearch.trim().toLowerCase();
                          if (!q) return true;
                          return [
                            r.id,
                            r.control,
                            r.process,
                            r.subprocess,
                            r.activity,
                            r.risk,
                          ]
                            .filter(Boolean)
                            .map((s) => String(s).toLowerCase())
                            .some((s) => s.includes(q));
                        })
                        .map((r) => (
                          <tr
                            key={`${r.projectId || "GLOBAL"}|${r.id}`}
                            className="border-t hover:bg-slate-50"
                            
                          >
                            <td className="p-3 text-xs text-slate-600">
                              {r.id}
                            </td>
                            <td className="p-3">{r.control || "-"}</td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.process || "-"}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.subprocess || "-"}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.activity || "-"}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.risk || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="visualized">
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>Project</Label>
                  <Select value={selectedProjectId || ""} onValueChange={(v)=> setSelectedProjectId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {reportableProjectOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  <div>
                    <Label className="text-xs">Group By</Label>
                    <Select value={vizGroup} onValueChange={(v:any)=> setVizGroup(v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Grouping"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button size="sm" className="flex items-center gap-2" onClick={()=>{
                      const wb = XLSX.utils.book_new();
                      const rows = atrRowsFiltered.map(({a})=>({
                        "Audit Observation": a.auditObservation||"",
                        "Action Plan": a.actionPlan||"",
                        "Responsibility": a.responsibility||"",
                        "Designation": a.designation||"",
                        "Department": a.department||"",
                        "Due date": a.dueDate||"",
                        "Actual Completion date": a.actualCompletionDate||"",
                        "Status": a.status||"",
                      }));
                      const ws = XLSX.utils.json_to_sheet(rows);
                      XLSX.utils.book_append_sheet(wb, ws, "ATR");
                      XLSX.writeFile(wb, "atr_visualized.xlsx");
                    }}>
                      <Download className="h-4 w-4"/> Export XLSX
                    </Button>
                  </div>
                </div>
              </div>

              {(() => {
                const rows = atrRowsFiltered.map(r=>r.a);
                const today = new Date();
                const mapStatus = (s?: string) => s === 'Closed' ? 'Completed' : s === 'Open' ? 'Pending' : (s||'');
                const statusPalette: Record<string, string> = { Completed: '#10B981', "In Progress": '#F59E0B', Overdue: '#EF4444', Pending: '#64748B' };

                const statusCount: Record<string, number> = {};
                rows.forEach(a => { const k = mapStatus(a.status); statusCount[k] = (statusCount[k]||0)+1; });
                const statusData = Object.keys(statusPalette).map(k => ({ name: k, value: statusCount[k]||0, fill: statusPalette[k] }));

                const fmtMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                const getWeekKey = (d: Date) => {
                  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                  const day = dt.getUTCDay();
                  const diff = (day === 0 ? -6 : 1) - day;
                  const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate()+diff);
                  const year = monday.getUTCFullYear(); const month = monday.getUTCMonth()+1; const date = monday.getUTCDate();
                  return `${year}-W${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
                };
                const groupKey = (s?: string) => { if (!s) return 'Unknown'; const d = new Date(s); if (isNaN(d.getTime())) return 'Unknown'; return vizGroup === 'weekly' ? getWeekKey(d) : fmtMonth(d); };

                const dueGroups: Record<string, number> = {};
                rows.forEach(a => { if (a.dueDate) { const k = groupKey(a.dueDate); dueGroups[k] = (dueGroups[k]||0)+1; }});
                const dueData = Object.keys(dueGroups).sort().map(k => ({ period: k, count: dueGroups[k] }));

                const respGroups: Record<string, number> = {};
                rows.forEach(a => { const k = a.responsibility || 'Unassigned'; respGroups[k] = (respGroups[k]||0)+1; });
                const respData = Object.entries(respGroups).map(([name, count]) => ({ name, count }));

                const deptKeys = Array.from(new Set(rows.map(a => a.department || 'Unassigned')));
                const statusKeys = [ 'Pending', 'In Progress', 'Completed', 'Overdue' ];
                const deptAgg: Record<string, Record<string, number>> = {};
                rows.forEach(a => { const d = a.department || 'Unassigned'; const s = mapStatus(a.status); deptAgg[d] = deptAgg[d]||{}; deptAgg[d][s] = (deptAgg[d][s]||0)+1; });
                const deptData = deptKeys.map(d => ({ department: d, ...Object.fromEntries(statusKeys.map(s => [s, (deptAgg[d]||{})[s]||0])) }));

                const compGroups: Record<string, number> = {};
                rows.forEach(a => { if (a.actualCompletionDate) { const k = groupKey(a.actualCompletionDate); compGroups[k] = (compGroups[k]||0)+1; }});
                const completionData = Object.keys(compGroups).sort().map(k => ({ period: k, count: compGroups[k] }));

                const total = rows.length;
                const completed = rows.filter(a => mapStatus(a.status) === 'Completed' || !!a.actualCompletionDate).length;
                const overdue = rows.filter(a => mapStatus(a.status) === 'Overdue' || (!!a.dueDate && new Date(a.dueDate) < today && mapStatus(a.status) !== 'Completed')).length;
                const delays: number[] = rows.filter(a => a.actualCompletionDate && a.dueDate).map(a => Math.max(0, Math.ceil((new Date(a.actualCompletionDate!).getTime() - new Date(a.dueDate!).getTime()) / (1000*60*60*24))));
                const avgDelay = delays.length ? Math.round((delays.reduce((s,n)=>s+n,0)/delays.length)) : 0;

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Total Action Plans</div><div className="text-2xl font-semibold">{total}</div></CardContent></Card>
                      <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Completed</div><div className="text-2xl font-semibold text-emerald-600">{completed}</div></CardContent></Card>
                      <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Overdue</div><div className="text-2xl font-semibold text-red-600">{overdue}</div></CardContent></Card>
                      <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Average Delay (days)</div><div className="text-2xl font-semibold">{avgDelay}</div></CardContent></Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <ExpandableChartCard title="Status Overview">
                        {(innerClassName) => (
                          <ChartContainer
                            config={{
                              Pending: { label: "Open" },
                              "In Progress": { label: "In Progress" },
                              Completed: { label: "Closed" },
                              Overdue: { label: "Overdue" },
                            }}
                            className={innerClassName}
                          >
                            <PieChart>
                              <Pie
                                data={statusData}
                                dataKey="value"
                                nameKey="name"
                                outerRadius={100}
                                label
                              >
                                {statusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <ChartLegend
                                content={
                                  <ChartLegendContent className="flex flex-wrap justify-center gap-3 text-xs" />
                                }
                              />
                            </PieChart>
                          </ChartContainer>
                        )}
                      </ExpandableChartCard>

                      <ExpandableChartCard title={`Upcoming Deadlines (${vizGroup})`}>
                        {(innerClassName) => (
                          <ChartContainer config={{}} className={innerClassName}>
                            <BarChart data={dueData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="period"
                                angle={dueData.length > 6 ? -45 : 0}
                                textAnchor={dueData.length > 6 ? "end" : "middle"}
                                interval={dueData.length > 6 ? 0 : "preserveStartEnd"}
                                tickMargin={8}
                                height={dueData.length > 6 ? undefined : 20}
                              />
                              <YAxis allowDecimals={false} />
                              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </BarChart>
                          </ChartContainer>
                        )}
                      </ExpandableChartCard>

                      <ExpandableChartCard title="Responsibility Load">
                        {(innerClassName) => (
                          <ChartContainer config={{}} className={innerClassName}>
                            <BarChart data={respData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="name"
                                angle={respData.length > 6 ? -45 : 0}
                                textAnchor={respData.length > 6 ? "end" : "middle"}
                                interval={respData.length > 6 ? 0 : "preserveStartEnd"}
                                tickMargin={8}
                                height={respData.length > 6 ? undefined : 20}
                              />
                              <YAxis allowDecimals={false} />
                              <Bar dataKey="count" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </BarChart>
                          </ChartContainer>
                        )}
                      </ExpandableChartCard>

                      <ExpandableChartCard title="Department-wise Status">
                        {(innerClassName) => (
                          <ChartContainer
                            config={{
                              Pending: { label: "Open" },
                              "In Progress": { label: "In Progress" },
                              Completed: { label: "Closed" },
                              Overdue: { label: "Overdue" },
                            }}
                            className={innerClassName}
                          >
                            <BarChart data={deptData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="department"
                                angle={deptData.length > 6 ? -45 : 0}
                                textAnchor={deptData.length > 6 ? "end" : "middle"}
                                interval={deptData.length > 6 ? 0 : "preserveStartEnd"}
                                tickMargin={8}
                                height={deptData.length > 6 ? undefined : 20}
                              />
                              <YAxis allowDecimals={false} />
                              <Bar
                                dataKey="Pending"
                                stackId="a"
                                fill={statusPalette["Pending"]}
                              />
                              <Bar
                                dataKey="In Progress"
                                stackId="a"
                                fill={statusPalette["In Progress"]}
                              />
                              <Bar
                                dataKey="Completed"
                                stackId="a"
                                fill={statusPalette["Completed"]}
                              />
                              <Bar
                                dataKey="Overdue"
                                stackId="a"
                                fill={statusPalette["Overdue"]}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </BarChart>
                          </ChartContainer>
                        )}
                      </ExpandableChartCard>

                      <Card className="shadow-sm lg:col-span-2">
                        <CardHeader><CardTitle>Completion Trend</CardTitle></CardHeader>
                        <CardContent>
                          <ChartContainer config={{}} className="h-72">
                            <LineChart data={completionData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="period" />
                              <YAxis allowDecimals={false} />
                              <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </LineChart>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
            })()}
          </div>
        </TabsContent>
        <TabsContent value="access">
            <div className="space-y-4 mt-4">
              {/* Toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label>Project</Label>
                  <Select
                    value={selectedProjectId || ""}
                    onValueChange={(v) => setSelectedProjectId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {reportableProjectOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 md:col-span-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <FilterIcon className="h-4 w-4" /> Filter
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[720px] z-[60]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Status</Label>
                          <Select
                            value={atrStatusFilter}
                            onValueChange={setAtrStatusFilter}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              {statuses.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Due from</Label>
                            <Input
                              type="date"
                              value={atrDueFrom}
                              onChange={(e) => setAtrDueFrom(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Due to</Label>
                            <Input
                              type="date"
                              value={atrDueTo}
                              onChange={(e) => setAtrDueTo(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Person responsible</Label>
                          <MultiSelectSimple
                            options={atrRespOptions}
                            value={atrRespFilter}
                            onChange={setAtrRespFilter}
                            placeholder="All"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Department</Label>
                          <MultiSelectSimple
                            options={atrDeptOptions}
                            value={atrDeptFilter}
                            onChange={setAtrDeptFilter}
                            placeholder="All"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Search</Label>
                          <Input
                            value={atrSearch}
                            onChange={(e) => setAtrSearch(e.target.value)}
                            placeholder="Search..."
                            className="mt-1"
                          />
                        </div>
                        <div className="flex justify-end sm:col-span-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAtrStatusFilter("all");
                              setAtrDueFrom("");
                              setAtrDueTo("");
                              setAtrSearch("");
                              setAtrRespFilter([]);
                              setAtrDeptFilter([]);
                            }}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Rows3 className="h-4 w-4" /> Group
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <div className="grid gap-2">
                        {(
                          [
                            "none",
                            "status",
                            "due",
                            "department",
                            "person",
                          ] as const
                        ).map((opt) => (
                          <Button
                            key={opt}
                            variant={atrGroupBy === opt ? "default" : "outline"}
                            size="sm"
                            className="capitalize justify-start"
                            onClick={() => setAtrGroupBy(opt)}
                          >
                            {opt === "none"
                              ? "None"
                              : opt === "due"
                                ? "Due date"
                                : opt === "person"
                                  ? "Person responsible"
                                  : opt === "department"
                                    ? "Department"
                                    : "Implementation status"}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Columns2 className="h-4 w-4" /> Fields
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72">
                      <div className="grid gap-2">
                        {atrAllFields.map((f) => (
                          <label
                            key={f}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={atrSelectedFields.includes(f)}
                              onChange={(e) =>
                                setAtrSelectedFields((prev) =>
                                  e.target.checked
                                    ? [...prev, f]
                                    : prev.filter((x) => x !== f),
                                )
                              }
                            />
                            <span>{f}</span>
                          </label>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAtrSelectedFields([...atrAllFields])
                            }
                          >
                            All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAtrSelectedFields([
                                "Control ID",
                                "Control",
                                "Process",
                                "Subprocess",
                                "Activity",
                                "Risk",
                                "Audit Observation",
                                "Action Plan",
                                "Responsibility",
                                "Designation",
                                "Department",
                                "Due date",
                                "Actual Completion date",
                                "Status",
                              ])
                            }
                          >
                            Default
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAtrSelectedFields([])}
                          >
                            None
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => {
                      const wb = XLSX.utils.book_new();
                      const build = (it: any) => {
                        const { a } = it;
                        const row: Record<string, any> = {};
                        const add = (k: string, v: any) => {
                          row[k] = v;
                        };

                        add("Audit Observation", a.auditObservation || "");
                        add("Action Plan", a.actionPlan || "");
                        add("Responsibility", a.responsibility || "");
                        add("Designation", a.designation || "");
                        add("Department", a.department || "");
                        add("Due date", a.dueDate || "");
                        add("Actual Completion date", a.actualCompletionDate || "");
                        add("Status", a.status || "");
                        return row;
                      };
                      let rows: any[] = [];
                      if (atrGroupBy === "none")
                        rows = atrRowsFiltered.map(build);
                      else {
                        const groups: Record<string, any[]> = {};
                        const keyOf = (it: any) => {
                          const { a } = it;
                          if (atrGroupBy === "status") return a.status || "";
                          if (atrGroupBy === "due") return a.dueDate || "";
                          if (atrGroupBy === "department")
                            return a.department || "";
                          return a.responsibility || "";
                        };
                        atrRowsFiltered.forEach((it) => {
                          const k = keyOf(it);
                          if (!groups[k]) groups[k] = [];
                          groups[k].push(build(it));
                        });
                        const keys = Object.keys(groups).sort();
                        for (const k of keys) {
                          rows.push({ Group: k });
                          rows.push(...groups[k]);
                          rows.push({});
                        }
                      }
                      const ws = XLSX.utils.json_to_sheet(rows);
                      XLSX.utils.book_append_sheet(wb, ws, "ATR");
                      XLSX.writeFile(wb, "atr.xlsx");
                    }}
                  >
                    <Download className="h-4 w-4" /> Export XLSX
                  </Button>
                  <Button size="sm" onClick={saveAtr}>
                    Save
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 w-48">Audit Observation</th>
                      <th className="text-left p-3 w-48">Action Plan</th>
                      <th className="text-left p-3 w-40">Responsibility</th>
                      <th className="text-left p-3 w-40">Designation</th>
                      <th className="text-left p-3 w-40">Department</th>
                      <th className="text-left p-3 w-40">Due date</th>
                      <th className="text-left p-3 w-44">Actual Completion date</th>
                      <th className="text-left p-3 w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atrRowsFiltered.map(({ a, idx }) => {
                      const isLast = atrRows.length - 1 === idx;
                      return (
                        <tr
                          key={`${selectedProjectId || "ALL"}|${a.id}`}
                          className="border-t"
                        >
                          <td className="p-3 border-l">
                            <Input
                              value={a.auditObservation}
                              onChange={(e) =>
                                updateAtrField(
                                  idx,
                                  "auditObservation",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={a.actionPlan}
                              onChange={(e) =>
                                updateAtrField(
                                  idx,
                                  "actionPlan",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={a.responsibility}
                              onChange={(e) =>
                                updateAtrField(
                                  idx,
                                  "responsibility",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={a.designation}
                              onChange={(e) =>
                                updateAtrField(
                                  idx,
                                  "designation",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={a.department || ""}
                              onChange={(e) =>
                                updateAtrField(idx, "department", e.target.value)
                              }
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              type="date"
                              value={a.dueDate}
                              onChange={(e) =>
                                updateAtrField(idx, "dueDate", e.target.value)
                              }
                            />
                            {a.previousDueDates &&
                              a.previousDueDates.length > 0 && (
                                <div className="mt-1 text-xs text-gray-500">
                                  Prev: {sanitizePrevDates(a.previousDueDates).join(", ")}
                                </div>
                              )}
                          </td>
                          <td className="p-3">
                            <Input
                              type="date"
                              value={a.actualCompletionDate || ""}
                              onChange={(e) =>
                                updateAtrField(idx, "actualCompletionDate", e.target.value)
                              }
                            />
                          </td>
                          <td className="p-3 flex items-center gap-2">
                            <Select
                              value={a.status}
                              onValueChange={(v) =>
                                updateAtrField(idx, "status", v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statuses.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isLast && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addAtrRow()}
                              >
                                Add Row
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteAtrRow(idx)}
                              title="Delete row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">ATR</h1>
        <Badge className="bg-green-100 text-green-800">ATR Access</Badge>
      </div>

      <Tabs defaultValue="access">
        <TabsList>
            <TabsTrigger value="reportable">Reportable Controls</TabsTrigger>
            <TabsTrigger value="access">ATR Access</TabsTrigger>
            <TabsTrigger value="visualized">Visualized</TabsTrigger>
          </TabsList>
        <TabsContent value="reportable">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Search Controls</Label>
              <div className="relative">
                <Input
                  className="pl-9"
                  placeholder="Search controls, process, risk..."
                  value={controlsSearch}
                  onChange={(e) => setControlsSearch(e.target.value)}
                />
              </div>
            </div>
            <div />
            <div className="flex items-center justify-end">
              <Badge className="bg-blue-50 text-blue-800">
                Approved & Reportable
              </Badge>
            </div>
          </div>

          <div className="mt-4">
            <Card className="h-[420px] overflow-hidden">
              <CardHeader>
                <CardTitle>Reportable Controls</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 h-full">
                <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label>Project</Label>
                    <Select
                      value={selectedProjectId || reportableProjectFilter}
                      onValueChange={(v) => {
                        setReportableProjectFilter(v);
                        setSelectedProjectId(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportableProjectOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ maxHeight: 420, overflow: "auto" }}>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-3 w-40">Control ID</th>
                        <th className="text-left p-3">Control</th>
                        <th className="text-left p-3 w-40">Process</th>
                        <th className="text-left p-3 w-48">Subprocess</th>
                        <th className="text-left p-3 w-40">Activity</th>
                        <th className="text-left p-3 w-48">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportableRows
                        .filter((r) => {
                          if (
                            reportableProjectFilter &&
                            r.projectId !== reportableProjectFilter
                          )
                            return false;
                          const q = controlsSearch.trim().toLowerCase();
                          if (!q) return true;
                          return [
                            r.id,
                            r.control,
                            r.process,
                            r.subprocess,
                            r.activity,
                            r.risk,
                          ]
                            .filter(Boolean)
                            .map((s) => String(s).toLowerCase())
                            .some((s) => s.includes(q));
                        })
                        .map((r) => (
                          <tr
                            key={`${r.projectId || "GLOBAL"}|${r.id}`}
                            className="border-t hover:bg-slate-50"
                            
                          >
                            <td className="p-3 text-xs text-slate-600">
                              {r.id}
                            </td>
                            <td className="p-3">{r.control || "-"}</td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.process || "-"}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.subprocess || "-"}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.activity || "-"}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {r.risk || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="visualized">
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label>Project</Label>
                <Select value={selectedProjectId || ""} onValueChange={(v)=> setSelectedProjectId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportableProjectOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                <div>
                  <Label className="text-xs">Group By</Label>
                  <Select value={vizGroup} onValueChange={(v:any)=> setVizGroup(v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Grouping"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-end">
                  <Button size="sm" className="flex items-center gap-2" onClick={()=>{
                    const wb = XLSX.utils.book_new();
                    const rows = atrRowsFiltered.map(({a})=>({
                      "Audit Observation": a.auditObservation||"",
                      "Action Plan": a.actionPlan||"",
                      "Responsibility": a.responsibility||"",
                      "Designation": a.designation||"",
                      "Department": a.department||"",
                      "Due date": a.dueDate||"",
                      "Actual Completion date": a.actualCompletionDate||"",
                      "Status": a.status||"",
                    }));
                    const ws = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, ws, "ATR");
                    XLSX.writeFile(wb, "atr_visualized.xlsx");
                  }}>
                    <Download className="h-4 w-4"/> Export XLSX
                  </Button>
                </div>
              </div>
            </div>

            {(() => {
              const rows = atrRowsFiltered.map(r=>r.a);
              const today = new Date();
              const mapStatus = (s?: string) => s === 'Closed' ? 'Completed' : s === 'Open' ? 'Pending' : (s||'');
              const statusPalette: Record<string, string> = { Completed: '#10B981', "In Progress": '#F59E0B', Overdue: '#EF4444', Pending: '#64748B' };

              const statusCount: Record<string, number> = {};
              rows.forEach(a => { const k = mapStatus(a.status); statusCount[k] = (statusCount[k]||0)+1; });
              const statusData = Object.keys(statusPalette).map(k => ({ name: k, value: statusCount[k]||0, fill: statusPalette[k] }));

              const fmtMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
              const getWeekKey = (d: Date) => {
                const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                const day = dt.getUTCDay();
                const diff = (day === 0 ? -6 : 1) - day;
                const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate()+diff);
                const year = monday.getUTCFullYear(); const month = monday.getUTCMonth()+1; const date = monday.getUTCDate();
                return `${year}-W${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
              };
              const groupKey = (s?: string) => { if (!s) return 'Unknown'; const d = new Date(s); if (isNaN(d.getTime())) return 'Unknown'; return vizGroup === 'weekly' ? getWeekKey(d) : fmtMonth(d); };

              const dueGroups: Record<string, number> = {};
              rows.forEach(a => { if (a.dueDate) { const k = groupKey(a.dueDate); dueGroups[k] = (dueGroups[k]||0)+1; }});
              const dueData = Object.keys(dueGroups).sort().map(k => ({ period: k, count: dueGroups[k] }));

              const respGroups: Record<string, number> = {};
              rows.forEach(a => { const k = a.responsibility || 'Unassigned'; respGroups[k] = (respGroups[k]||0)+1; });
              const respData = Object.entries(respGroups).map(([name, count]) => ({ name, count }));

              const deptKeys = Array.from(new Set(rows.map(a => a.department || 'Unassigned')));
              const statusKeys = [ 'Pending', 'In Progress', 'Completed', 'Overdue' ];
              const deptAgg: Record<string, Record<string, number>> = {};
              rows.forEach(a => { const d = a.department || 'Unassigned'; const s = mapStatus(a.status); deptAgg[d] = deptAgg[d]||{}; deptAgg[d][s] = (deptAgg[d][s]||0)+1; });
              const deptData = deptKeys.map(d => ({ department: d, ...Object.fromEntries(statusKeys.map(s => [s, (deptAgg[d]||{})[s]||0])) }));

              const compGroups: Record<string, number> = {};
              rows.forEach(a => { if (a.actualCompletionDate) { const k = groupKey(a.actualCompletionDate); compGroups[k] = (compGroups[k]||0)+1; }});
              const completionData = Object.keys(compGroups).sort().map(k => ({ period: k, count: compGroups[k] }));

              const total = rows.length;
              const completed = rows.filter(a => mapStatus(a.status) === 'Completed' || !!a.actualCompletionDate).length;
              const overdue = rows.filter(a => mapStatus(a.status) === 'Overdue' || (!!a.dueDate && new Date(a.dueDate) < today && mapStatus(a.status) !== 'Completed')).length;
              const delays: number[] = rows.filter(a => a.actualCompletionDate && a.dueDate).map(a => Math.max(0, Math.ceil((new Date(a.actualCompletionDate!).getTime() - new Date(a.dueDate!).getTime()) / (1000*60*60*24))));
              const avgDelay = delays.length ? Math.round((delays.reduce((s,n)=>s+n,0)/delays.length)) : 0;

              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Total Action Plans</div><div className="text-2xl font-semibold">{total}</div></CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Completed</div><div className="text-2xl font-semibold text-emerald-600">{completed}</div></CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Overdue</div><div className="text-2xl font-semibold text-red-600">{overdue}</div></CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4"><div className="text-xs text-slate-500">Average Delay (days)</div><div className="text-2xl font-semibold">{avgDelay}</div></CardContent></Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ExpandableChartCard title="Status Overview">
                      {(innerClassName) => (
                        <ChartContainer
                          config={{
                            Pending: { label: "Open" },
                            "In Progress": { label: "In Progress" },
                            Completed: { label: "Closed" },
                            Overdue: { label: "Overdue" },
                          }}
                          className={innerClassName}
                        >
                          <PieChart>
                            <Pie
                              data={statusData}
                              dataKey="value"
                              nameKey="name"
                              outerRadius={100}
                              label
                            >
                              {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend
                              content={
                                <ChartLegendContent className="flex flex-wrap justify-center gap-3 text-xs" />
                              }
                            />
                          </PieChart>
                        </ChartContainer>
                      )}
                    </ExpandableChartCard>

                    <ExpandableChartCard title={`Upcoming Deadlines (${vizGroup})`}>
                      {(innerClassName) => (
                        <ChartContainer config={{}} className={innerClassName}>
                          <BarChart data={dueData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="period"
                              angle={dueData.length > 6 ? -45 : 0}
                              textAnchor={dueData.length > 6 ? "end" : "middle"}
                              interval={dueData.length > 6 ? 0 : "preserveStartEnd"}
                              tickMargin={8}
                              height={dueData.length > 6 ? undefined : 20}
                            />
                            <YAxis allowDecimals={false} />
                            <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </ExpandableChartCard>

                    <ExpandableChartCard title="Responsibility Load">
                      {(innerClassName) => (
                        <ChartContainer config={{}} className={innerClassName}>
                          <BarChart data={respData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="name"
                              angle={respData.length > 6 ? -45 : 0}
                              textAnchor={respData.length > 6 ? "end" : "middle"}
                              interval={respData.length > 6 ? 0 : "preserveStartEnd"}
                              tickMargin={8}
                              height={respData.length > 6 ? undefined : 20}
                            />
                            <YAxis allowDecimals={false} />
                            <Bar dataKey="count" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </ExpandableChartCard>

                    <ExpandableChartCard title="Department-wise Status">
                      {(innerClassName) => (
                        <ChartContainer
                          config={{
                            Pending: { label: "Open" },
                            "In Progress": { label: "In Progress" },
                            Completed: { label: "Closed" },
                            Overdue: { label: "Overdue" },
                          }}
                          className={innerClassName}
                        >
                          <BarChart data={deptData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="department"
                              angle={deptData.length > 6 ? -45 : 0}
                              textAnchor={deptData.length > 6 ? "end" : "middle"}
                              interval={deptData.length > 6 ? 0 : "preserveStartEnd"}
                              tickMargin={8}
                              height={deptData.length > 6 ? undefined : 20}
                            />
                            <YAxis allowDecimals={false} />
                            <Bar
                              dataKey="Pending"
                              stackId="a"
                              fill={statusPalette["Pending"]}
                            />
                            <Bar
                              dataKey="In Progress"
                              stackId="a"
                              fill={statusPalette["In Progress"]}
                            />
                            <Bar
                              dataKey="Completed"
                              stackId="a"
                              fill={statusPalette["Completed"]}
                            />
                            <Bar
                              dataKey="Overdue"
                              stackId="a"
                              fill={statusPalette["Overdue"]}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </ExpandableChartCard>

                    <ExpandableChartCard
                      title="Completion Trend"
                      cardClassName="lg:col-span-2"
                    >
                      {(innerClassName) => (
                        <ChartContainer config={{}} className={innerClassName}>
                          <LineChart data={completionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis allowDecimals={false} />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#10B981"
                              strokeWidth={2}
                              dot={false}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </LineChart>
                        </ChartContainer>
                      )}
                    </ExpandableChartCard>
                  </div>
                </>
              );
            })()}
          </div>
        </TabsContent>
        <TabsContent value="access">
          <div className="space-y-4 mt-4">
            {/* Toolbar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label>Project</Label>
                <Select
                  value={selectedProjectId || ""}
                  onValueChange={(v) => setSelectedProjectId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportableProjectOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <FilterIcon className="h-4 w-4" /> Filter
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[720px] z-[60]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Status</Label>
                        <Select
                          value={atrStatusFilter}
                          onValueChange={setAtrStatusFilter}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {statuses.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Due from</Label>
                          <Input
                            type="date"
                            value={atrDueFrom}
                            onChange={(e) => setAtrDueFrom(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Due to</Label>
                          <Input
                            type="date"
                            value={atrDueTo}
                            onChange={(e) => setAtrDueTo(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Person responsible</Label>
                        <MultiSelectSimple
                          options={atrRespOptions}
                          value={atrRespFilter}
                          onChange={setAtrRespFilter}
                          placeholder="All"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Department</Label>
                        <MultiSelectSimple
                          options={atrDeptOptions}
                          value={atrDeptFilter}
                          onChange={setAtrDeptFilter}
                          placeholder="All"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Search</Label>
                        <Input
                          value={atrSearch}
                          onChange={(e) => setAtrSearch(e.target.value)}
                          placeholder="Search..."
                          className="mt-1"
                        />
                      </div>
                      <div className="flex justify-end sm:col-span-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAtrStatusFilter("all");
                            setAtrDueFrom("");
                            setAtrDueTo("");
                            setAtrSearch("");
                            setAtrRespFilter([]);
                            setAtrDeptFilter([]);
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Rows3 className="h-4 w-4" /> Group
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="grid gap-2">
                      {(
                        [
                          "none",
                          "status",
                          "due",
                          "department",
                          "person",
                        ] as const
                      ).map((opt) => (
                        <Button
                          key={opt}
                          variant={atrGroupBy === opt ? "default" : "outline"}
                          size="sm"
                          className="capitalize justify-start"
                          onClick={() => setAtrGroupBy(opt)}
                        >
                          {opt === "none"
                            ? "None"
                            : opt === "due"
                              ? "Due date"
                              : opt === "person"
                                ? "Person responsible"
                                : opt === "department"
                                  ? "Department"
                                  : "Implementation status"}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Columns2 className="h-4 w-4" /> Fields
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="grid gap-2">
                      {atrAllFields.map((f) => (
                        <label
                          key={f}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={atrSelectedFields.includes(f)}
                            onChange={(e) =>
                              setAtrSelectedFields((prev) =>
                                e.target.checked
                                  ? [...prev, f]
                                  : prev.filter((x) => x !== f),
                              )
                            }
                          />
                          <span>{f}</span>
                        </label>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAtrSelectedFields([...atrAllFields])
                          }
                        >
                          All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAtrSelectedFields([
                              "Control ID",
                              "Control",
                              "Process",
                              "Subprocess",
                              "Activity",
                              "Risk",
                              "Audit Observation",
                              "Action Plan",
                              "Responsibility",
                              "Designation",
                              "Department",
                              "Due date",
                              "Actual Completion date",
                              "Status",
                            ])
                          }
                        >
                          Default
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAtrSelectedFields([])}
                        >
                          None
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const build = (it: any) => {
                      const { a } = it;
                      const row: Record<string, any> = {};
                      const add = (k: string, v: any) => {
                        row[k] = v;
                      };

                      add("Audit Observation", a.auditObservation || "");
                      add("Action Plan", a.actionPlan || "");
                      add("Responsibility", a.responsibility || "");
                      add("Designation", a.designation || "");
                      add("Department", a.department || "");
                      add("Due date", a.dueDate || "");
                      add("Actual Completion date", a.actualCompletionDate || "");
                      add("Status", a.status || "");
                      return row;
                    };
                    let rows: any[] = [];
                    if (atrGroupBy === "none")
                      rows = atrRowsFiltered.map(build);
                    else {
                      const groups: Record<string, any[]> = {};
                      const keyOf = (it: any) => {
                        const { a } = it;
                        if (atrGroupBy === "status") return a.status || "";
                        if (atrGroupBy === "due") return a.dueDate || "";
                        if (atrGroupBy === "department")
                          return a.department || "";
                        return a.responsibility || "";
                      };
                      atrRowsFiltered.forEach((it) => {
                        const k = keyOf(it);
                        if (!groups[k]) groups[k] = [];
                        groups[k].push(build(it));
                      });
                      const keys = Object.keys(groups).sort();
                      for (const k of keys) {
                        rows.push({ Group: k });
                        rows.push(...groups[k]);
                        rows.push({});
                      }
                    }
                    const ws = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, ws, "ATR");
                    XLSX.writeFile(wb, "atr.xlsx");
                  }}
                >
                  <Download className="h-4 w-4" /> Export XLSX
                </Button>
                <Button size="sm" onClick={saveAtr}>
                  Save
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 w-48">Audit Observation</th>
                    <th className="text-left p-3 w-48">Action Plan</th>
                    <th className="text-left p-3 w-40">Responsibility</th>
                    <th className="text-left p-3 w-40">Designation</th>
                    <th className="text-left p-3 w-40">Department</th>
                    <th className="text-left p-3 w-40">Due date</th>
                    <th className="text-left p-3 w-44">Actual Completion date</th>
                    <th className="text-left p-3 w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {atrRowsFiltered.map(({ a, idx }) => {
                    const isLast = atrRows.length - 1 === idx;
                    return (
                      <tr
                        key={`${selectedProjectId || "ALL"}|${a.id}`}
                        className="border-t"
                      >
                        <td className="p-3 border-l">
                          <Input
                            value={a.auditObservation}
                            onChange={(e) =>
                              updateAtrField(
                                idx,
                                "auditObservation",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={a.actionPlan}
                            onChange={(e) =>
                              updateAtrField(idx, "actionPlan", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={a.responsibility}
                            onChange={(e) =>
                              updateAtrField(
                                idx,
                                "responsibility",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={a.designation}
                            onChange={(e) =>
                              updateAtrField(idx, "designation", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={a.department || ""}
                            onChange={(e) =>
                              updateAtrField(idx, "department", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="date"
                            value={a.dueDate}
                            onChange={(e) =>
                              updateAtrField(idx, "dueDate", e.target.value)
                            }
                          />
                          {a.previousDueDates &&
                            a.previousDueDates.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500">
                                Prev: {sanitizePrevDates(a.previousDueDates).join(", ")}
                              </div>
                            )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="date"
                            value={a.actualCompletionDate || ""}
                            onChange={(e) =>
                              updateAtrField(idx, "actualCompletionDate", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-3 flex items-center gap-2">
                          <Select
                            value={a.status}
                            onValueChange={(v) =>
                              updateAtrField(idx, "status", v)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statuses.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isLast && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addAtrRow()}
                            >
                              Add Row
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAtrRow(idx)}
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
