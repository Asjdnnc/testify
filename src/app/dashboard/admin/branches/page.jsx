"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import {
  Network, Plus, GraduationCap, Pencil, Trash2,
  Loader2, AlertCircle, Check, X, ChevronRight,
  Calendar, Layers, CheckSquare, Square, Info
} from "lucide-react";
import Link from "next/link";

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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [batchYears, setBatchYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [newName, setNewName] = useState("");
  const [selectedYears, setSelectedYears] = useState([]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const initRef = useRef(false);

  useEffect(() => { 
    if (user?.collegeId && !initRef.current) {
        loadBranches(); 
        loadBatchYears();
        initRef.current = true;
    }
  }, [user?.collegeId]); // Stable dependency

  async function loadBranches() {
    const data = await orgClient.branches.list(user.collegeId);
    if (data.success) setBranches(data.branches);
    setLoading(false);
  }

  async function loadBatchYears() {
    const res = await orgClient.batches.getYears(user.collegeId);
    if (res.success) setBatchYears(res.years);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    const res = await orgClient.branches.create({ 
      name: newName.trim(), 
      collegeId: user.collegeId,
      batchYears: selectedYears 
    });
    if (res.success) { 
      setNewName(""); 
      setSelectedYears([]);
      showSuccess(`Branch "${newName}" created with ${selectedYears.length} initial batches.`);
      loadBranches(); 
    } else setError(res.message || "Failed to create branch");
    setCreating(false);
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    const data = await orgClient.branches.update(id, { name: editName.trim() });
    if (data.success) { setEditingId(null); loadBranches(); }
    else setError(data.message || "Failed to update branch");
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const data = await orgClient.branches.delete(deleteTarget.id);
    if (data.success) { setDeleteTarget(null); loadBranches(); }
    else setError(data.message || "Failed to delete branch");
    setDeleting(false);
  }

  function toggleYear(year) {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year));
    } else {
      setSelectedYears([...selectedYears, year]);
    }
  }

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 pb-20">
      {deleteTarget && (
        <ConfirmModal
          message={`Delete branch "${deleteTarget.name}"? All associated batches and students will also be removed.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Branches</h1>
              <p className="text-muted-foreground text-sm">Departments in your college, like Computer Science or Electronics. Create batches for each graduation year.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="h-4">
        {error && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/5 border border-destructive/10 rounded-2xl p-4 text-xs animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto underline font-bold tracking-tight text-xs">Dismiss</button>
            </div>
        )}
        {success && (
            <div className="flex items-center gap-2 text-success-foreground bg-emerald-500/5 border border-success/40 rounded-2xl p-4 text-xs animate-in slide-in-from-top-2">
            <Check className="w-4 h-4 shrink-0" /> {success}
            </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Create Workspace */}
        <div className="lg:col-span-5">
           <div className="bg-card border rounded-2xl p-8 shadow-sm space-y-6 h-fit sticky top-24">
                <div className="space-y-1">
                    <h2 className="text-sm font-bold text-foreground tracking-wide flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary" /> New branch
                    </h2>
                    <p className="text-[11px] text-muted-foreground font-medium">Add a branch and initialize academic years.</p>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">Branch Name</label>
                        <input
                            placeholder="e.g. Mechanical Engineering"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                            className="w-full h-12 px-4 rounded-2xl border border-border bg-background focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all text-sm font-medium"
                        />
                    </div>

                    {/* Batch Linkage Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pl-1">
                            <label className="text-xs font-semibold text-muted-foreground tracking-wide ">Batches to create</label>
                            <span className="text-xs font-bold text-primary">{selectedYears.length} Selected</span>
                        </div>
                        
                        <div className="bg-muted/30 rounded-xl p-5 border border-border/50 max-h-48 overflow-y-auto custom-scrollbar">
                            {batchYears.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4 font-medium ">No existing batches found. You can add them later.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {batchYears.map((by) => (
                                        <button
                                            key={by.graduationYear}
                                            type="button"
                                            onClick={() => toggleYear(by.graduationYear)}
                                            className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${selectedYears.includes(by.graduationYear) ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
                                        >
                                            {selectedYears.includes(by.graduationYear) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                            <span className="text-[11px] font-bold">{by.graduationYear}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground px-2 leading-relaxed">A batch is created for each year you select.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={creating || !newName.trim()}
                        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Create branch
                    </button>
                </form>
           </div>
        </div>

        {/* Directory List */}
        <div className="lg:col-span-7">
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/10">
                <div className="space-y-0.5">
                    <h2 className="text-sm font-bold text-foreground">All branches</h2>
                    <p className="text-xs text-muted-foreground font-bold tracking-wider">{branches.length} branches</p>
                </div>
            </div>

            <div className="flex-1 overflow-visible">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-xs font-semibold text-muted-foreground tracking-[5px]">Syncing</p>
                </div>
              ) : branches.length === 0 ? (
                <div className="text-center py-32 space-y-4 opacity-50">
                  <Network className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-xs text-muted-foreground font-medium ">No departments have been established yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {branches.map((branch) => (
                    <div key={branch.id} className="p-6 flex items-center gap-5 group hover:bg-accent/5 transition-all duration-300">
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                        <Network className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                      </div>

                      {editingId === branch.id ? (
                        <div className="flex-1 flex items-center gap-3 animate-in fade-in duration-200">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(branch.id); if (e.key === "Escape") setEditingId(null); }}
                            autoFocus
                            className="flex-1 h-10 px-4 text-sm rounded-xl border border-primary bg-background focus:outline-none shadow-sm shadow-primary/10"
                          />
                          <button onClick={() => handleSaveEdit(branch.id)} disabled={saving}
                            className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg ">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-2.5 rounded-xl bg-muted text-muted-foreground hover:bg-accent transition-all">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-foreground text-[14px]">{branch.name}</span>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold tracking-tight">
                                    <Layers className="w-2.5 h-2.5" /> Branch
                                </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button
                                onClick={() => { setEditingId(branch.id); setEditName(branch.name); }}
                                className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setDeleteTarget(branch)}
                                className="p-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <Link
                                href={`/dashboard/admin/batches?branchId=${branch.id}`}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted/50 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                            >
                                Batches <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Legend */}
            <div className="p-6 bg-muted/20 border-t border-border/40 text-xs font-bold text-muted-foreground/60 tracking-wide flex items-center gap-2">
                <Info className="w-3 h-3" /> Deleting a branch removes all academic data associated with it.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
