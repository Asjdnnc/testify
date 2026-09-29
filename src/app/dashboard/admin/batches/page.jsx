"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import {
  GraduationCap, Plus, ArrowLeft, Calendar, Layers,
  Pencil, Trash2, Loader2, AlertCircle, Check, X,
  RefreshCw, Info, ChevronRight, Hash, Clock
} from "lucide-react";

function ConfirmModal({ message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-card border rounded-2xl p-8 shadow-2xl w-full max-w-sm space-y-6 animate-in zoom-in duration-200">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <Trash2 className="w-6 h-6 text-destructive" />
        </div>
        <div className="text-center space-y-2">
            <h3 className="text-base font-bold text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground text-[13px] leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-accent transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const branchId = searchParams.get("branchId");

  const [branches, setBranches] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({ name: "", graduationYear: new Date().getFullYear() + 4 });
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const initRef = useRef(false);

  useEffect(() => { 
    if (user?.collegeId && !initRef.current) {
        loadBranches();
        runMaintenance(); // Trigger annual check on page visit
        initRef.current = true;
    }
  }, [user?.collegeId]); // Stable dependency

  useEffect(() => { 
    if (branchId) loadBatches(); 
    else { setBatches([]); setLoading(false); } 
  }, [branchId]);

  async function loadBranches() {
    const data = await orgClient.branches.list(user.collegeId);
    if (data.success) setBranches(data.branches);
  }

  async function runMaintenance() {
    setMaintenanceRunning(true);
    try {
        const res = await orgClient.batches.performMaintenance(user.collegeId);
        if (res.success && res.created.length > 0) {
            setSuccess(`Annual Check: ${res.created.length} new batches automatically initialized for all branches.`);
            if (branchId) loadBatches();
        }
    } catch (e) { console.error("Maintenance Error", e); }
    setMaintenanceRunning(false);
  }

  async function loadBatches() {
    setLoading(true);
    const data = await orgClient.batches.list(branchId);
    if (data.success) setBatches(data.batches);
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!formData.name || !branchId) return;
    setCreating(true);
    setError("");
    const res = await orgClient.batches.create({ ...formData, branchId });
    if (res.success) { 
        setFormData({ name: "", graduationYear: new Date().getFullYear() + 4 }); 
        showSuccess(`Batch "${formData.name}" added successfully.`);
        loadBatches(); 
    } else setError(res.message || "Failed to create batch");
    setCreating(false);
  }

  async function handleSaveEdit(id) {
    setSaving(true);
    setError("");
    const data = await orgClient.batches.update(id, editData);
    if (data.success) { setEditingId(null); loadBatches(); }
    else setError(data.message || "Failed to update");
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const data = await orgClient.batches.delete(deleteTarget.id);
    if (data.success) { setDeleteTarget(null); loadBatches(); }
    else setError(data.message || "Failed to delete");
    setDeleting(false);
  }

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }

  const selectedBranch = branches.find((b) => b.id === branchId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 pb-20">
      {deleteTarget && (
        <ConfirmModal
          message={`Delete batch "${deleteTarget.name}"? Enrollment data for students within this batch will be cleared.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
             <button onClick={() => router.push("/dashboard/admin/branches")}
                className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground hover:text-primary transition-colors group">
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back to branches
            </button>
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Batches</h1>
              <p className="text-muted-foreground text-sm">
                {selectedBranch ? `Batches in ${selectedBranch.name}` : "Pick a branch to see and manage its graduating batches."}
              </p>
            </div>
          </div>
        </div>
        
        {/* Maintenance Indicator */}
        {maintenanceRunning && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 px-4 py-2 rounded-2xl animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-xs font-bold text-primary ">Automated Sync in Progress...</span>
            </div>
        )}
      </div>

      {/* Alerts */}
      <div className="h-4">
        {error && (
            <div className="flex items-center gap-3 text-destructive bg-destructive/5 border border-destructive/10 rounded-2xl p-4 text-xs animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto underline font-bold tracking-tight text-xs">Dismiss</button>
            </div>
        )}
        {success && (
            <div className="flex items-center gap-3 text-success-foreground bg-emerald-500/5 border border-success/40 rounded-2xl p-4 text-xs animate-in slide-in-from-top-2">
            <Check className="w-4 h-4 shrink-0" /> {success}
            </div>
        )}
      </div>

      {/* Branch Context Switching */}
      <div className="bg-card border rounded-2xl p-2 flex items-center shadow-inner group">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors">
            <Layers className="w-5 h-5" />
        </div>
        <select
          className="flex-1 h-12 px-2 text-sm rounded-2xl bg-transparent text-foreground focus:outline-none font-bold cursor-pointer"
          value={branchId || ""}
          onChange={(e) => router.push(`/dashboard/admin/batches?branchId=${e.target.value}`)}
        >
          <option value="" disabled>Choose a branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div className="pr-6">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {!branchId ? (
        <div className="bg-card border border-dashed rounded-2xl py-32 text-center space-y-4 opacity-50">
          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
            <GraduationCap className="w-10 h-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">No branch selected</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">Please choose an academic department above to view and manage its student batches.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12 animate-in fade-in duration-500">
          {/* Create Workspace */}
          <div className="lg:col-span-4">
            <div className="bg-card border rounded-2xl p-8 space-y-6 h-fit sticky top-24 shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-sm font-bold text-foreground tracking-wide flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> New Cohort
                    </h2>
                    <p className="text-[11px] text-muted-foreground font-medium">Add a unique academic intake cycle.</p>
                </div>
                
                <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">Name</label>
                    <input
                    placeholder="e.g. Class of 2028"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full h-11 px-4 rounded-2xl border border-border bg-background focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-sm font-medium"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">Graduation Year</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="number"
                            placeholder="2028"
                            value={formData.graduationYear}
                            onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                            required
                            className="w-full h-11 pl-11 pr-4 rounded-2xl border border-border bg-background focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-sm font-mono"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={creating || !formData.name.trim()}
                    className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Initialize Batch
                </button>
                </form>
            </div>
          </div>

          {/* Directory Workspace */}
          <div className="lg:col-span-8">
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[500px]">
                <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/10">
                    <div className="space-y-0.5">
                        <h2 className="text-sm font-bold text-foreground">Batches</h2>
                        <p className="text-xs text-muted-foreground font-bold tracking-wider">{batches.length} Batches listed in {selectedBranch?.name}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-visible">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <p className="text-xs font-semibold text-muted-foreground tracking-[5px]">Refreshing</p>
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center py-32 space-y-4 opacity-50">
                        <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                        <p className="text-xs text-muted-foreground font-medium ">No batches defined for this department.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                    {batches.sort((a,b) => b.graduationYear - a.graduationYear).map((batch) => (
                        <div key={batch.id} className="p-6 flex items-center gap-5 group hover:bg-accent/5 transition-all duration-300">
                            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                                <Hash className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                            </div>

                            {editingId === batch.id ? (
                            <div className="flex-1 flex items-center gap-3 animate-in fade-in duration-200">
                                <input
                                value={editData.name || ""}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                className="flex-1 h-10 px-4 text-sm rounded-xl border border-primary bg-background focus:outline-none shadow-sm shadow-primary/10"
                                />
                                <input
                                type="number"
                                value={editData.graduationYear || ""}
                                onChange={(e) => setEditData({ ...editData, graduationYear: e.target.value })}
                                className="w-24 h-10 px-4 text-sm rounded-xl border border-border bg-background focus:outline-none"
                                />
                                <button onClick={() => handleSaveEdit(batch.id)} disabled={saving}
                                className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg ">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setEditingId(null)}
                                className="p-2.5 rounded-xl bg-muted text-muted-foreground hover:bg-accent transition-all">
                                <X className="w-4 h-4" />
                                </button>
                            </div>
                            ) : (
                            <div className="flex-1 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="font-bold text-foreground text-[14px] leading-none">{batch.name}</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
                                            <Clock className="w-3.5 h-3.5" /> Est. Graduation {batch.graduationYear}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button
                                    onClick={() => { setEditingId(batch.id); setEditData({ name: batch.name, graduationYear: batch.graduationYear }); }}
                                    className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(batch)}
                                    className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                </div>
                            </div>
                            )}
                        </div>
                    ))}
                    </div>
                )}
                </div>
                
                {/* Legend */}
                <div className="p-6 bg-muted/20 border-t border-border/40 text-xs font-bold text-muted-foreground/60 tracking-wide flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><Info className="w-3 h-3" /> Manual override supported.</div>
                    <div className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> Every July 1st, a new intake is automatically added.</div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
      <BatchesContent />
    </Suspense>
  );
}
