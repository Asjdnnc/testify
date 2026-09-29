"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import {
  Users, UserPlus, Mail, Search, Trash2, Loader2,
  AlertCircle, CheckCircle2, Calendar, FileUp, Download, Info
} from "lucide-react";

function ConfirmModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl p-6 shadow-xl w-full max-w-sm space-y-4">
        <p className="text-foreground text-sm">
          Remove <strong>{name}</strong> from faculty? They will lose access to the platform.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-accent transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 flex items-center justify-center gap-1 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManageTeachersPage() {
  const { user: currentUser } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState("single"); // "single" | "batch"
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [creating, setCreating] = useState(false);

  // Batch states
  const fileInputRef = useRef(null);
  const [batchFile, setBatchFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => { loadTeachers(); }, []);

  async function loadTeachers() {
    const data = await orgClient.users.list("TEACHER");
    if (data.success) setTeachers(data.users);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");
    const res = await orgClient.users.create({ ...formData, role: "TEACHER" });
    if (res.success) {
      setFormData({ name: "", email: "" });
      showSuccess(`${formData.name} added to faculty.`);
      loadTeachers();
    } else setError(res.message || "Failed to add teacher");
    setCreating(false);
  }

  async function handleBatchUpload(e) {
    e.preventDefault();
    if (!batchFile) return;
    
    setUploading(true);
    setError("");
    setBatchResult(null);
    
    try {
      const res = await orgClient.users.batchUpload(batchFile);
      if (res.success) {
        setBatchResult(res.data);
        showSuccess(res.message);
        loadTeachers();
        setBatchFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setError(res.message || "Batch upload failed");
      }
    } catch (err) {
      setError("Failed to upload file. Ensure the format is valid.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await orgClient.users.delete(deleteTarget.id);
    if (res.success) { setDeleteTarget(null); showSuccess("Teacher removed."); loadTeachers(); }
    else setError(res.message || "Failed to remove teacher");
    setDeleting(false);
  }

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {deleteTarget && (
        <ConfirmModal name={deleteTarget.name} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Teachers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {teachers.length} teacher{teachers.length !== 1 ? "s" : ""} on faculty
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-muted p-1 rounded-xl w-fit border border-border">
          <button
            onClick={() => setActiveTab("single")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "single" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Single Entry
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === "batch" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Batch Upload
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError("")} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-success-foreground dark:text-success-foreground bg-emerald-500/10 border border-success/40 rounded-xl p-3 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Column: Form Section */}
        <div className="space-y-5">
          {activeTab === "single" ? (
            <div className="bg-card border rounded-2xl p-5 space-y-4 h-fit">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Add Teacher
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                  <input
                    placeholder="e.g. Dr. Ramesh Gupta"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <input
                    type="email"
                    placeholder="faculty@college.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Invite teacher
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-card border rounded-2xl p-5 space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-primary" /> Batch Upload
                </h2>
                <button 
                  onClick={() => alert("Columns required: 'Name', 'Email'. Files: .xlsx, .csv")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${batchFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".csv"))) setBatchFile(file);
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${batchFile ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {batchFile ? <CheckCircle2 className="w-6 h-6" /> : <FileUp className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      {batchFile ? batchFile.name : "Drop file here or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground">Supports .xlsx and .csv</p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx,.csv"
                    onChange={(e) => setBatchFile(e.target.files[0])}
                  />
                  {!batchFile && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 px-3 py-1.5 text-[11px] font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-all"
                    >
                      Select File
                    </button>
                  )}
                </div>
              </div>

              <button
                disabled={!batchFile || uploading}
                onClick={handleBatchUpload}
                className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Import Teachers
              </button>

              {batchResult && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2">
                  <p className="text-[11px] font-bold text-foreground">Import Results:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-success-foreground">✓ Success: {batchResult.success}</div>
                    <div className="text-destructive">✗ Failed: {batchResult.failed}</div>
                  </div>
                  {batchResult.errors.length > 0 && (
                    <div className="mt-2 max-h-24 overflow-y-auto text-[11px] text-muted-foreground space-y-1">
                      {batchResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i} className="flex gap-1">
                          <span className="font-bold shrink-0">[{err.email}]:</span>
                          <span>{err.error}</span>
                        </div>
                      ))}
                      {batchResult.errors.length > 5 && <div className="">+ {batchResult.errors.length - 5} more errors</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl relative overflow-hidden group">
            <div className="relative z-10 flex gap-3">
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Auto-Email Invitation</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Registered teachers will receive an email with temporary credentials and a link to set their secure password.
                </p>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
          </div>
        </div>

        {/* Right Column: Faculty list */}
        <div className="lg:col-span-2 bg-card border rounded-2xl overflow-hidden flex flex-col h-fit">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">All teachers</h2>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                placeholder="Search name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground text-sm">
                {searchQuery ? "No teachers match your search." : "No teachers added yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto custom-scrollbar">
              {filtered.map((t) => (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 group hover:bg-accent/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{t.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="w-3 h-3" /> {t.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
