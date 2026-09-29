"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import {
  GraduationCap, UserPlus, Search, Mail, Layers, BookOpen,
  Trash2, Loader2, AlertCircle, CheckCircle2, Calendar,
  FileUp, Download, Info, Filter, ArrowRight
} from "lucide-react";

function ConfirmModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-card border rounded-2xl p-6 shadow-xl w-full max-w-sm space-y-4 animate-in fade-in zoom-in duration-200">
        <p className="text-foreground text-sm leading-relaxed">
          Remove <strong className="text-primary">{name}</strong>? They will lose access to the platform and all enrolled exams immediately.
        </p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-destructive/10">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageStudentsPage() {
  const { user: currentUser } = useAuth();

  const [branches, setBranches] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState("single"); // "single" | "batch"
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Batch states
  const fileInputRef = useRef(null);
  const [batchFile, setBatchFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => { if (currentUser?.collegeId) loadBranches(); }, [currentUser]);
  
  // When branch changes, clear batch and load new batches
  useEffect(() => {
    if (selectedBranchId) {
      loadBatches(selectedBranchId);
      setSelectedBatchId("");
      setStudents([]);
    } else {
      setBatches([]);
      setSelectedBatchId("");
      setStudents([]);
    }
  }, [selectedBranchId]);

  // When batch changes, load students
  useEffect(() => {
    if (selectedBatchId) loadStudents(selectedBatchId);
    else setStudents([]);
  }, [selectedBatchId]);

  async function loadBranches() {
    const data = await orgClient.branches.list(currentUser.collegeId);
    if (data.success) setBranches(data.branches);
    setLoading(false);
  }

  async function loadBatches(branchId) {
    const data = await orgClient.batches.list(branchId);
    if (data.success) setBatches(data.batches);
  }

  async function loadStudents(batchId) {
    setLoading(true);
    const data = await orgClient.users.list("STUDENT", batchId);
    if (data.success) setStudents(data.users);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedBatchId) {
      setError("Please select a Branch and Batch first.");
      return;
    }
    setCreating(true);
    setError("");
    setSuccess("");
    const res = await orgClient.users.create({
      ...formData,
      role: "STUDENT",
      batchId: selectedBatchId,
      branchId: selectedBranchId,
    });
    if (res.success) {
      setFormData({ name: "", email: "" });
      showSuccess(`${formData.name} added to the batch.`);
      loadStudents(selectedBatchId);
    } else setError(res.message || "Failed to enroll student");
    setCreating(false);
  }

  async function handleBatchUpload(e) {
    e.preventDefault();
    if (!batchFile) return;
    
    setUploading(true);
    setError("");
    setBatchResult(null);
    
    try {
      const res = await orgClient.users.batchUpload(batchFile, "STUDENT");
      if (res.success) {
        setBatchResult(res.data);
        showSuccess(res.message);
        if (selectedBatchId) loadStudents(selectedBatchId);
        setBatchFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setError(res.message || "Batch upload failed");
      }
    } catch (err) {
      setError("Failed to upload file. Ensure columns match: Name, Email, Branch, Batch");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await orgClient.users.delete(deleteTarget.id);
    if (res.success) { 
      setDeleteTarget(null); 
      showSuccess("Student removed."); 
      loadStudents(selectedBatchId); 
    } else setError(res.message || "Failed to remove student");
    setDeleting(false);
  }

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }

  const filtered = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {deleteTarget && (
        <ConfirmModal name={deleteTarget.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            Students
          </h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Students belong to a batch within a branch. Add them one at a time or import a spreadsheet.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-muted p-1 rounded-xl w-fit border border-border/50">
          <button
            onClick={() => setActiveTab("single")}
            className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "single" ? "bg-card text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:text-foreground"}`}
          >
            Single Entry
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === "batch" ? "bg-card text-foreground shadow-sm ring-1 ring-border/10" : "text-muted-foreground hover:text-foreground"}`}
          >
            Batch Upload
          </button>
        </div>
      </div>

      {/* Message Area */}
      {error && (
        <div className="flex items-center gap-3 text-destructive bg-destructive/5 border border-destructive/10 rounded-2xl p-4 text-sm animate-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-4 h-4 shrink-0" /> 
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="hover:opacity-70 font-semibold text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 text-success-foreground bg-emerald-500/5 border border-success/40 rounded-2xl p-4 text-sm animate-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> 
          <span>{success}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Control Panel: Form and Filters */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Context Filter (Persistent) */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-xs font-bold text-muted-foreground tracking-wide flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" /> Branch & batch
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground pl-1">BRANCH</label>
                <select
                  className="w-full h-11 px-4 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                >
                  <option value="">Select Branch</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className={`space-y-1.5 transition-opacity ${!selectedBranchId && "opacity-40"}`}>
                <label className="text-xs font-bold text-muted-foreground pl-1">BATCH (GRADUATION YEAR)</label>
                <select
                  className="w-full h-11 px-4 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer disabled:cursor-not-allowed"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  disabled={!selectedBranchId}
                >
                  <option value="">Select Batch</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.graduationYear})</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Registration Mode Content */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              {activeTab === "single" ? (
                <>
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary" /> Add a student
                    </h2>
                    <p className="text-[11px] text-muted-foreground">Add one student to the selected batch.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground pl-1 ">Full Name</label>
                      <input
                        placeholder="e.g. Rahul Verma"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full h-10 px-4 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground pl-1 ">Email Address</label>
                      <input
                        type="email"
                        placeholder="rahul.v@college.edu"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="w-full h-10 px-4 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={creating || !selectedBatchId}
                      className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10 group mt-2"
                    >
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                      Add student
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <FileUp className="w-4 h-4 text-primary" /> Bulk Onboarding
                      </h2>
                      <p className="text-[11px] text-muted-foreground">Import entire cohorts instantly.</p>
                    </div>
                    <button 
                      onClick={() => alert("Columns required: 'Name', 'Email', 'Branch', 'Batch'. Format: .xlsx, .csv")}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${batchFile ? "border-primary bg-primary/5 shadow-inner" : "border-border hover:border-primary/50 hover:bg-accent/5"}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".csv"))) setBatchFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${batchFile ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"}`}>
                        {batchFile ? <CheckCircle2 className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
                      </div>
                      <div className="space-y-1 px-2">
                        <p className="text-xs font-bold text-foreground truncate max-w-[150px] mx-auto">
                          {batchFile ? batchFile.name : "Click or drag file"}
                        </p>
                        <p className="text-xs text-muted-foreground tracking-wider font-semibold">XLSX, CSV</p>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx,.csv"
                        onChange={(e) => setBatchFile(e.target.files[0])}
                      />
                    </div>
                  </div>

                  <button
                    disabled={!batchFile || uploading}
                    onClick={handleBatchUpload}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10 group"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
                    Launch Import
                  </button>

                  {batchResult && (
                    <div className="p-4 bg-muted/30 rounded-2xl border border-border/50 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-emerald-500/5 border border-success/40 rounded-xl p-2.5">
                          <p className="text-xs font-bold text-muted-foreground ">Success</p>
                          <p className="text-lg font-bold text-success-foreground">{batchResult.success}</p>
                        </div>
                        <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-2.5">
                          <p className="text-xs font-bold text-muted-foreground ">Failed</p>
                          <p className="text-lg font-bold text-destructive">{batchResult.failed}</p>
                        </div>
                      </div>
                      {batchResult.errors.length > 0 && (
                        <div className="mt-4 max-h-32 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                          {batchResult.errors.map((err, i) => (
                            <div key={i} className="flex gap-2 items-start text-[11px] text-muted-foreground leading-relaxed p-1.5 bg-background border border-border/50 rounded-lg">
                              <span className="text-destructive font-bold shrink-0">ER</span>
                              <span><strong className="text-foreground">{err.email}</strong>: {err.error}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              
              <div className="pt-2 border-t border-border/40 flex gap-4 items-start">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground leading-none">Auto-Invites</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All new students will receive an official invitation with temporary credentials and secure setup instructions.
                    </p>
                  </div>
              </div>
            </div>
            {/* Decoration blur */}
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl -z-1" />
          </div>
        </div>

        {/* Right Panel: Student list */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[500px]">
            {/* Search and Metadata Header */}
            <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 shrink-0">
                <h2 className="text-sm font-bold text-foreground">Students in batch</h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {filtered.length} Student{filtered.length !== 1 && "s"} listed
                  </p>
                </div>
              </div>

              <div className="relative w-full max-w-sm group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  placeholder="Search by name or institutional email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 text-sm rounded-2xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-visible">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-xs font-bold text-muted-foreground animate-pulse">Syncing directory…</p>
                </div>
              ) : !selectedBatchId ? (
                <div className="flex flex-col items-center justify-center py-32 text-center px-6">
                  <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
                    <Layers className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Choose a branch and batch</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-2 leading-relaxed">
                    Pick a branch and batch on the left to see its students or add new ones.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center px-6 grayscale">
                  <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-6 border border-dashed border-border">
                    <UserPlus className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-base font-bold text-muted-foreground">Directory is empty</h3>
                  <p className="text-[13px] text-muted-foreground/80 max-w-xs mx-auto mt-2">
                    {searchQuery ? "No members match your search criteria." : "There are no students registered in this batch yet."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((s) => (
                    <div key={s.id} className="p-5 flex items-center gap-4 group hover:bg-accent/5 transition-all duration-200">
                      <div className="relative group/avatar">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-transparent transition-all duration-300">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Status Dots */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background shadow-sm ${s.requirePasswordChange ? "bg-warning" : "bg-success"}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground text-[14px] truncate leading-none">{s.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold  tracking-wider ${s.requirePasswordChange ? "bg-warning/15 text-warning-foreground dark:bg-amber-400/10 dark:text-warning-foreground" : "bg-success/12 text-success-foreground dark:bg-emerald-400/10 dark:text-success-foreground"}`}>
                            {s.requirePasswordChange ? "Invited" : "Active"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 opacity-80">
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <Mail className="w-3 h-3" />
                            {s.email}
                          </div>
                          <div className="w-1 h-1 rounded-full bg-border" />
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                            <Calendar className="w-3 h-3" />
                            {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
                          title="Remove from batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Simple Legend */}
            {selectedBatchId && filtered.length > 0 && (
              <div className="px-6 py-4 bg-muted/20 border-t border-border/50 flex items-center gap-6">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-success" /> ACTIVE (Setup Complete)
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-warning" /> INVITED (Pending Setup)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
