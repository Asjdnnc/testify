"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import {
  BookOpen, Plus, Search, Edit3, Trash2, X,
  Loader2, AlertCircle, CheckCircle2, Layers,
  FileUp, Download, Info, Hash, Minus, ChevronRight,
  Database, Keyboard, Settings2, Calendar
} from "lucide-react";

/**
 * Inline Credit Controller Component
 */
function CreditControls({ initialValue, onUpdate, loading }) {
  const [val, setVal] = useState(initialValue);
  
  const handleUpdate = (delta) => {
    const newVal = Math.max(1, Math.min(10, val + delta));
    if (newVal === val) return;
    setVal(newVal);
    onUpdate(newVal);
  };

  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
      <button 
        disabled={loading || val <= 1}
        onClick={() => handleUpdate(-1)}
        className="p-1 rounded-lg hover:bg-card text-muted-foreground disabled:opacity-30 transition-all"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-6 text-center text-xs font-bold text-foreground">
        {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : val}
      </span>
      <button 
        disabled={loading || val >= 10}
        onClick={() => handleUpdate(1)}
        className="p-1 rounded-lg hover:bg-card text-muted-foreground disabled:opacity-30 transition-all"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function SubjectsPage() {
  const { user } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState("single"); // "single" | "bulk" | "file"
  const [isEditing, setIsEditing] = useState(null);
  const [formData, setFormData] = useState({ name: "", code: "", credits: 3 });
  const [processing, setProcessing] = useState(false);
  const [updatingCredits, setUpdatingCredits] = useState(null); // stores ID being updated

  // Bulk / File states
  const [bulkText, setBulkText] = useState("");
  const fileInputRef = useRef(null);
  const [batchFile, setBatchFile] = useState(null);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => { if (user?.collegeId) loadSubjects(); }, [user]);

  async function loadSubjects() {
    setLoading(true);
    try {
      const res = await orgClient.subjects.list(user.collegeId);
      if (res.success) setSubjects(res.subjects);
    } catch { setError("Failed to load subjects"); }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name || !user?.collegeId) return;
    setProcessing(true);
    setError("");
    try {
      let res;
      if (isEditing) {
        res = await orgClient.subjects.update(isEditing.id, formData);
      } else {
        res = await orgClient.subjects.create({ ...formData, collegeId: user.collegeId });
      }
      if (res.success) {
        setFormData({ name: "", code: "", credits: 3 });
        setIsEditing(null);
        showSuccess(isEditing ? "Subject details updated." : "Subject created successfully.");
        loadSubjects();
        if (!isEditing) setActiveTab("list");
      } else setError(res.message || "Operation failed");
    } catch { setError("A network error occurred"); }
    setProcessing(false);
  }

  async function handleBulkAdd(e) {
    e.preventDefault();
    if (!bulkText.trim()) return;
    
    setProcessing(true);
    setError("");
    
    // Parse format: Name(Code), Name(Code)
    // Regex matches text followed by optional (code)
    const items = bulkText.split(",").map(item => {
      const match = item.trim().match(/^([^()]+?)\s*(?:\(([^()]+)\))?$/);
      if (match) {
        return {
          name: match[1].trim(),
          code: match[2]?.trim() || null,
          credits: 3
        };
      }
      return { name: item.trim(), code: null, credits: 3 };
    }).filter(i => i.name);

    if (items.length === 0) {
      setError("No valid subject entries found.");
      setProcessing(false);
      return;
    }

    try {
      const res = await orgClient.subjects.batchCreate(items);
      if (res.success) {
        setBulkText("");
        setBatchResult(res.result);
        showSuccess("Bulk processing complete.");
        loadSubjects();
      } else setError(res.message);
    } catch { setError("Failed to process batch"); }
    setProcessing(false);
  }

  async function handleFileUpload() {
    if (!batchFile) return;
    setProcessing(true);
    setError("");
    try {
      const res = await orgClient.subjects.batchUpload(batchFile);
      if (res.success) {
        setBatchFile(null);
        setBatchResult(res.result);
        showSuccess("File import complete.");
        loadSubjects();
      } else setError(res.message);
    } catch { setError("File processing failed"); }
    setProcessing(false);
  }

  async function handleInlineCreditUpdate(id, newVal) {
    setUpdatingCredits(id);
    try {
      const res = await orgClient.subjects.update(id, { credits: newVal });
      if (!res.success) {
        setError("Failed to update credits");
        loadSubjects(); // Revert local state
      }
    } catch { 
      setError("Sync error"); 
      loadSubjects();
    }
    setUpdatingCredits(null);
  }

  async function handleDelete(id, name) {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    const res = await orgClient.subjects.delete(id);
    if (res.success) { showSuccess("Subject archived."); loadSubjects(); }
    else setError(res.message || "Deletion failed");
  }

  function startEdit(s) {
    setIsEditing(s);
    setFormData({ name: s.name, code: s.code || "", credits: s.credits });
    setActiveTab("single"); // switch to single entry for specialized editing
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }

  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.code || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 pb-12">
      {/* Header with Glassmorphism */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subjects</h1>
              <p className="text-muted-foreground text-sm font-medium">Courses taught at your college. Credits are used to calculate GPA.</p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-muted/50 p-1.5 rounded-2xl border border-border/40 backdrop-blur-sm self-start">
          <button
            onClick={() => { setActiveTab("single"); setBatchResult(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === "single" ? "bg-card text-foreground shadow-sm shadow-primary/5 ring-1 ring-border/10" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Plus className="w-3.5 h-3.5" /> {isEditing ? "Edit" : "Add one"}
          </button>
          <button
            onClick={() => { setActiveTab("bulk"); setBatchResult(null); setIsEditing(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === "bulk" ? "bg-card text-foreground shadow-sm shadow-primary/5 ring-1 ring-border/10" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Paste list
          </button>
          <button
            onClick={() => { setActiveTab("file"); setBatchResult(null); setIsEditing(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${activeTab === "file" ? "bg-card text-foreground shadow-sm shadow-primary/5 ring-1 ring-border/10" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FileUp className="w-3.5 h-3.5" /> Import
          </button>
        </div>
      </div>

      {/* Message System */}
      <div className="h-6">
        {error && (
            <div className="flex items-center gap-3 text-destructive bg-destructive/5 border border-destructive/10 rounded-2xl p-4 text-[13px] animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto hover:underline font-bold text-[11px]">DISMISS</button>
            </div>
        )}
        {success && (
            <div className="flex items-center gap-3 text-success-foreground bg-emerald-500/5 border border-success/40 rounded-2xl p-4 text-[13px] animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
            </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Workspaces */}
        <div className="lg:col-span-5">
          <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-8 h-full min-h-[400px]">
            
            {activeTab === "single" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-lg font-bold text-foreground">{isEditing ? "Edit subject" : "Add a subject"}</h2>
                            <p className="text-xs text-muted-foreground font-medium">Name, optional course code and credits.</p>
                        </div>
                        {isEditing && (
                            <button onClick={() => { setIsEditing(null); setActiveTab("list"); }} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                           <label className="text-[11px] font-bold text-muted-foreground tracking-wide pl-1">Name</label>
                           <input
                             placeholder="e.g. Applied Mathematics II"
                             value={formData.name}
                             onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                             required
                             className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[11px] font-bold text-muted-foreground tracking-wide pl-1">Course code (optional)</label>
                           <input
                             placeholder="e.g. AMATH201"
                             value={formData.code}
                             onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                             className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-mono text-sm"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[11px] font-bold text-muted-foreground tracking-wide pl-1">Credits</label>
                           <div className="flex items-center gap-4">
                                <input
                                    type="range" min="1" max="10"
                                    value={formData.credits}
                                    onChange={(e) => setFormData({ ...formData, credits: e.target.value })}
                                    className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                                />
                                <span className="w-10 text-center font-bold text-primary">{formData.credits}</span>
                           </div>
                        </div>

                        <button
                          type="submit"
                          disabled={processing}
                          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                        >
                          {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : isEditing ? <Edit3 className="w-5 h-5 transition-transform group-hover:scale-110" /> : <Plus className="w-5 h-5" />}
                          {isEditing ? "Sync Changes" : "Add subject"}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === "bulk" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-1">
                        <h2 className="text-lg font-bold text-foreground">Add several at once</h2>
                        <p className="text-xs text-muted-foreground font-medium">Add multiple subjects using natural text formatting.</p>
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3 text-[11px] leading-relaxed">
                        <Info className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">
                            Format: <strong className="text-foreground">SubjectName(Code)</strong>, separated by commas.<br/>
                            Example: <code className="text-primary ">Math(MAT101), Physics(PHY102), Chemistry</code>
                        </span>
                    </div>

                    <form onSubmit={handleBulkAdd} className="space-y-5">
                       <textarea
                         placeholder="Enter subjects here..."
                         value={bulkText}
                         onChange={(e) => setBulkText(e.target.value)}
                         className="w-full h-40 p-5 rounded-2xl border border-border bg-background/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium text-sm resize-none custom-scrollbar"
                       />
                       
                        <button
                          type="submit"
                          disabled={processing || !bulkText.trim()}
                          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                          {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Keyboard className="w-5 h-5" />}
                          Batch Process Entries
                        </button>
                    </form>
                </div>
            )}

            {activeTab === "file" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="space-y-1">
                        <h2 className="text-lg font-bold text-foreground">Import from spreadsheet</h2>
                        <p className="text-xs text-muted-foreground font-medium">Upload institutional CSV/XLSX spreadsheets.</p>
                    </div>

                    <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            setBatchFile(e.dataTransfer.files[0]);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group ${batchFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/5 focus:bg-accent/10"}`}
                    >
                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${batchFile ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-110" : "bg-muted text-muted-foreground group-hover:scale-105"}`}>
                                {batchFile ? <CheckCircle2 className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-foreground px-4 truncate max-w-[200px]">
                                    {batchFile ? batchFile.name : "Drop Curriculum File"}
                                </p>
                                <p className="text-xs text-muted-foreground tracking-wide font-semibold opacity-60">XLSX OR CSV ONLY</p>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={(e) => setBatchFile(e.target.files[0])} />
                        </div>
                    </div>

                    <div className="bg-muted/30 rounded-2xl p-4 flex gap-4">
                         <Download className="w-5 h-5 text-muted-foreground mt-0.5" />
                         <div className="space-y-1">
                             <p className="text-[11px] font-bold text-foreground">File Requirements</p>
                             <p className="text-xs text-muted-foreground leading-relaxed ">Column headers must include: <strong className="text-primary">'Name'</strong>, <strong className="text-primary">'Code'</strong>, and <strong className="text-primary">'Credits'</strong>.</p>
                         </div>
                    </div>

                    <button
                      onClick={handleFileUpload}
                      disabled={processing || !batchFile}
                      className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                      Sync with File
                    </button>
                </div>
            )}

            {/* Performance Snapshot */}
            {batchResult && (
                <div className="p-5 bg-muted/40 rounded-2xl border border-border/50 animate-in zoom-in-95">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[11px] font-semibold text-muted-foreground tracking-wide">Import summary</h3>
                        <CheckCircle2 className="w-3.5 h-3.5 text-success-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-500/5 rounded-2xl p-3 border border-success/40">
                            <span className="block text-xs font-bold text-muted-foreground mb-1">Created</span>
                            <span className="text-xl font-semibold text-success-foreground">{batchResult.success}</span>
                        </div>
                        <div className="bg-destructive/5 rounded-2xl p-3 border border-destructive/10">
                            <span className="block text-xs font-bold text-muted-foreground mb-1">Exceptions</span>
                            <span className="text-xl font-semibold text-destructive">{batchResult.failed}</span>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Right Column: Directory Table */}
        <div className="lg:col-span-12 xl:col-span-7">
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[600px] transition-all">
            
            {/* Context Header */}
            <div className="p-8 border-b border-border/40 flex flex-col sm:flex-row items-center justify-between gap-6 bg-muted/10">
              <div className="space-y-1 self-start">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/40 animate-pulse" />
                    <h2 className="text-base font-bold text-foreground">All subjects</h2>
                </div>
                <p className="text-xs text-muted-foreground font-medium pl-4">{filtered.length} Subjects active in Curriculum</p>
              </div>

              <div className="relative w-full max-w-sm group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                <input
                  placeholder="Filter by name or code…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-11 pr-4 text-sm rounded-2xl border border-border bg-background/50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-visible">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-6">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-[3px] border-primary/10 border-t-primary animate-spin" />
                    <div className="absolute w-8 h-8 rounded-full bg-primary/5 animate-pulse" />
                  </div>
                  <p className="text-[11px] font-semibold text-muted-foreground tracking-[5px]">Refreshing</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-32 space-y-4 max-w-sm mx-auto opacity-50">
                  <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center mx-auto border border-dashed border-border/60">
                    <BookOpen className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                  <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground tracking-wider">No subjects yet</h3>
                      <p className="text-xs text-muted-foreground font-medium ">
                        {searchQuery ? "Refine your search parameters." : "Curriculum directory is currently empty."}
                      </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filtered.map((s) => (
                    <div key={s.id} className="p-6 flex flex-col sm:flex-row sm:items-center gap-6 group hover:bg-accent/5 transition-all duration-300">
                      
                      <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-primary/20 transition-all duration-300">
                        <Layers className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center flex-wrap gap-2">
                            <span className="font-bold text-foreground text-sm truncate">{s.name}</span>
                            {s.code && (
                                <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-bold font-mono border border-primary/20 tracking-tight">
                                    {s.code}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                             <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                Added {new Date(s.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                             </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-10">
                        {/* Inline Controls */}
                        <div className="space-y-1 text-center sm:text-right">
                           <span className="text-xs font-bold text-muted-foreground tracking-wide block mb-1">Credits</span>
                           <CreditControls 
                             initialValue={s.credits} 
                             onUpdate={(nv) => handleInlineCreditUpdate(s.id, nv)}
                             loading={updatingCredits === s.id}
                           />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                           <button
                             onClick={() => startEdit(s)}
                             className="p-2.5 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                             title="Full Edit"
                           >
                             <Edit3 className="w-4 h-4" />
                           </button>
                           <button
                             onClick={() => handleDelete(s.id, s.name)}
                             className="p-2.5 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                             title="Archive"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Actions / Legend */}
            <div className="p-6 bg-muted/20 border-t border-border/40 flex flex-wrap gap-6 items-center">
                 <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/70 ">
                    <Settings2 className="w-3 h-3" /> Quick Scale: Use tabs on the left to batch register.
                 </div>
                 <div className="ml-auto flex items-center gap-2 text-xs font-bold text-muted-foreground/70 ">
                    <Hash className="w-3 h-3" /> Inline updates are synced automatically.
                 </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
