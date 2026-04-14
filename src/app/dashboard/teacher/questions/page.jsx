"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { orgClient } from "@/lib/api-client/org.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  BookOpen, 
  Trash2, 
  Edit3,
  HelpCircle, 
  CheckCircle2, 
  Link2,
  Loader2,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react";
import { QuestionContributionModal } from "@/components/dashboard/question-contribution-modal";

export default function QuestionsPage() {
  const { user } = useAuth();
  
  const [subjects, setSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ subjects: [], creators: [], marks: [] });
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  
  // Modal states
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [globalProcessing, setGlobalProcessing] = useState(false);

  useEffect(() => {
    if (user?.collegeId) {
      loadInitialData();
    }
  }, [user]);

  async function loadInitialData() {
    setLoading(true);
    try {
        const subRes = await orgClient.subjects.list(user.collegeId);
        if (subRes.success) setSubjects(subRes.subjects);

        const qRes = await orgClient.questions.list();
        if (qRes.success) setQuestions(qRes.questions);
    } catch (e) { 
        console.error("Load failed", e); 
        toast.error("Failed to load question bank data.");
    }
    setLoading(false);
  }

  const toggleFilter = (key, value) => {
    setFilters(prev => {
      const current = prev[key];
      const next = current.includes(value) 
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const clearFilters = () => setFilters({ subjects: [], creators: [], marks: [] });
  
  const toggleExpanded = (id) => {
    setExpandedQuestions(prev => {
       const newSet = new Set(prev);
       if (newSet.has(id)) newSet.delete(id);
       else newSet.add(id);
       return newSet;
    });
  };

  async function handleContributionFinalize(questionDataArray) {
    setIsContributionModalOpen(false);
    setGlobalProcessing(true);
    
    let successCount = 0;
    try {
      for (const q of questionDataArray) {
        let res;
        if (editingQuestion) {
          res = await orgClient.questions.update(editingQuestion.id, q);
        } else {
          res = await orgClient.questions.create(q);
        }
        if (res.success) successCount++;
      }
      
      if (successCount > 0) {
        toast.success(editingQuestion ? "Question updated successfully" : `Successfully added ${successCount} question(s)`);
        loadInitialData();
      }
    } catch (e) {
      toast.error("An error occurred while saving questions.");
    } finally {
      setGlobalProcessing(false);
      setEditingQuestion(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
        const res = await orgClient.questions.delete(id);
        if (res.success) {
          toast.success("Question deleted");
          loadInitialData();
        }
    } catch (e) { 
      toast.error(e.message || "Deletion failed"); 
    }
  }

  const filteredQuestions = (questions || []).filter(q => {
    const matchesSearch = (q.text || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = filters.subjects.length === 0 || filters.subjects.includes(q.subjectId);
    const matchesCreator = filters.creators.length === 0 || filters.creators.includes(q.creator?.name);
    const matchesMarks = filters.marks.length === 0 || filters.marks.includes(q.defaultMarks.toString());
    return matchesSearch && matchesSubject && matchesCreator && matchesMarks;
  });

  const uniqueCreators = [...new Set(questions.filter(q => q.creator?.name).map(q => q.creator.name))];
  const uniqueMarks = [...new Set(questions.map(q => q.defaultMarks))].sort((a,b)=>a-b);
  const isAnyFilterActive = filters.subjects.length > 0 || filters.creators.length > 0 || filters.marks.length > 0 || searchQuery.length > 0;

  return (
    <div className="space-y-8 container mx-auto pb-12 relative animate-in fade-in duration-500">
      
      {/* Processing Overlay */}
      {globalProcessing && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex items-center gap-4 border border-slate-100 dark:border-slate-800">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="flex flex-col">
                 <span className="font-black text-slate-900 dark:text-white text-lg">Synchronizing Bank...</span>
                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Updating repository indexes</span>
              </div>
           </div>
        </div>
      )}

      {/* Unified Contribution Modal */}
      <QuestionContributionModal 
        isOpen={isContributionModalOpen}
        onClose={() => {
          setIsContributionModalOpen(false);
          setEditingQuestion(null);
        }}
        subjects={subjects}
        onFinalize={handleContributionFinalize}
        initialData={editingQuestion}
      />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <div className="bg-indigo-600 p-3.5 rounded-[20px] shadow-lg shadow-indigo-500/20">
              <BookOpen className="w-8 h-8 text-white" />
           </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Question Bank</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Your central repository for all academic assessment content.</p>
           </div>
        </div>
        
        <Button 
          onClick={() => {
            setEditingQuestion(null);
            setIsContributionModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-black h-14 px-8 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-3 text-lg"
        >
          <Plus className="w-6 h-6" /> Add Question
        </Button>
      </header>

      {/* Advanced Multi-Select Filters */}
      <div className="space-y-6">
         <div className="flex flex-col gap-6 bg-white dark:bg-slate-900/50 p-6 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input 
                     placeholder="Search questions by keyword or content..." 
                     className="pl-12 h-14 text-md rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/10 transition-all bg-slate-50 dark:bg-slate-950/50 dark:text-white"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               {isAnyFilterActive && (
                 <Button 
                   variant="ghost" 
                   onClick={clearFilters}
                   className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0 h-10 px-4 rounded-xl"
                 >
                   Clear all filters
                 </Button>
               )}
            </div>
            
            <div className="space-y-4">
               {/* Subject Filter */}
               <div className="flex items-start gap-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest min-w-[80px] pt-3 shrink-0">Subject</span>
                  <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                     <button 
                       onClick={() => setFilters({...filters, subjects: []})} 
                       className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${filters.subjects.length === 0 ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
                     >
                       All Subjects
                     </button>
                     {subjects.map(s => (
                       <button 
                         key={s.id} 
                         onClick={() => toggleFilter('subjects', s.id)} 
                         className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${filters.subjects.includes(s.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
                       >
                         {s.name}
                         {filters.subjects.includes(s.id) && <X className="w-3.5 h-3.5" />}
                       </button>
                     ))}
                  </div>
               </div>

               {/* Teacher Filter */}
               {uniqueCreators.length > 0 && (
               <div className="flex items-start gap-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest min-w-[80px] pt-3 shrink-0">Teacher</span>
                  <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                     <button 
                       onClick={() => setFilters({...filters, creators: []})} 
                       className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${filters.creators.length === 0 ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700 shadow-md' : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
                     >
                       All Teachers
                     </button>
                     {uniqueCreators.map(c => (
                       <button 
                         key={c} 
                         onClick={() => toggleFilter('creators', c)} 
                         className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${filters.creators.includes(c) ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700 shadow-md' : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}
                       >
                         {c}
                         {filters.creators.includes(c) && <X className="w-3.5 h-3.5" />}
                       </button>
                     ))}
                  </div>
               </div>
               )}

               {/* Marks Filter */}
               {uniqueMarks.length > 0 && (
               <div className="flex items-start gap-4">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest min-w-[70px] pt-3 shrink-0">Weight</span>
                  <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                     <button 
                       onClick={() => setFilters({...filters, marks: []})} 
                       className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all ${filters.marks.length === 0 ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-800 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-500'}`}
                     >
                       Any
                     </button>
                     {uniqueMarks.map(m => (
                       <button 
                         key={m} 
                         onClick={() => toggleFilter('marks', m.toString())} 
                         className={`px-5 py-2.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${filters.marks.includes(m.toString()) ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-800 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-500'}`}
                       >
                         {m} Marks
                         {filters.marks.includes(m.toString()) && <X className="w-3.5 h-3.5" />}
                       </button>
                     ))}
                  </div>
               </div>
               )}
            </div>
         </div>

         {/* Question Feed */}
         <div className="grid gap-6">
            {loading ? (
               <div className="p-20 text-center flex flex-col items-center gap-4 text-slate-400 dark:text-slate-600 animate-pulse">
                  <Loader2 className="w-12 h-12 animate-spin" />
                  <span className="font-black uppercase text-xs tracking-widest">Decrypting Bank Data...</span>
               </div>
            ) : filteredQuestions.length === 0 ? (
               <div className="p-24 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[40px] bg-slate-50/50 dark:bg-slate-900/20 flex flex-col items-center">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl mb-6">
                    <HelpCircle className="w-12 h-12 text-slate-200 dark:text-slate-800" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">No questions found</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm font-medium italic">We couldn't find any questions matching your active filters. Try clearing some selections or adding a new component.</p>
                  <Button onClick={clearFilters} variant="outline" className="mt-8 rounded-xl border-slate-300 dark:border-slate-700 dark:text-white">Reset Search</Button>
               </div>
            ) : filteredQuestions.map((q) => (
               <Card key={q.id} className="group overflow-hidden shadow-sm hover:shadow-2xl transition-all border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:scale-[1.005]">
                  <CardHeader className="flex flex-row items-start justify-between pb-6 cursor-pointer" onClick={() => toggleExpanded(q.id)}>
                     <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                           <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black border-indigo-100 dark:border-indigo-800/50 rounded-lg py-1 text-[10px]">
                              {q.type.replace('_', ' ')}
                           </Badge>
                           <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-tight bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                             {q.subject?.name || "Uncategorized"}
                           </span>
                           <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{q.defaultMarks} Marks</span>
                           {q.creator?.name && (
                             <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-auto border border-slate-100 dark:border-slate-800 px-4 py-1 rounded-full bg-slate-50 dark:bg-slate-950">
                               by {q.creatorId === user?.id ? "You" : q.creator.name}
                             </span>
                           )}
                        </div>
                        <h2 className={`text-2xl font-black leading-tight text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${!expandedQuestions.has(q.id) ? 'line-clamp-2' : ''}`}>
                           {q.text}
                        </h2>
                     </div>
                     <div className="flex items-center gap-2 ml-6" onClick={(e) => e.stopPropagation()}>
                         {q.creatorId === user?.id && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditingQuestion(q);
                                setIsContributionModalOpen(true);
                              }} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors rounded-xl h-10 w-10">
                                 <Edit3 className="w-5 h-5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors rounded-xl h-10 w-10">
                                 <Trash2 className="w-5 h-5" />
                              </Button>
                            </>
                         )}
                         <Button variant="ghost" size="icon" className="text-slate-300 dark:text-slate-700 h-10 w-10 ml-2 pointer-events-none">
                            {expandedQuestions.has(q.id) ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                         </Button>
                     </div>
                  </CardHeader>

                  {expandedQuestions.has(q.id) && (
                    <div className="animate-in slide-in-from-top-4 duration-300">
                      {q.options?.length > 0 && (
                         <div className="px-6 pb-8 grid md:grid-cols-2 gap-3">
                            {q.options.map((opt) => (
                               <div key={opt.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                                 opt.isCorrect 
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold shadow-sm" 
                                  : "bg-slate-50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                               }`}>
                                  <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-slate-900 border border-inherit text-xs font-black shadow-sm">{opt.label}</span>
                                  <span className="text-sm flex-1">{opt.text}</span>
                                  {opt.isCorrect && <CheckCircle2 className="w-5 h-5 ml-auto text-emerald-600 dark:text-emerald-400" />}
                               </div>
                            ))}
                         </div>
                      )}
                      
                      {q.type === "SUBJECTIVE" && q.modelAnswer && (
                         <div className="px-6 pb-8">
                            <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-3xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                               <div className="absolute top-0 right-0 p-4 opacity-5">
                                  <FileText className="w-20 h-20" />
                               </div>
                               <span className="font-black text-[10px] uppercase text-indigo-600 dark:text-indigo-400 block mb-3 tracking-[0.2em]">Model Reference Architecture</span>
                               <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                  "{q.modelAnswer}"
                               </p>
                            </div>
                         </div>
                      )}

                      {q.exams && q.exams.length > 0 && (
                        <div className="mx-6 mb-6 px-6 py-4 flex items-center justify-end gap-3 flex-wrap border-t border-slate-100 dark:border-slate-800/50 pt-6">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 flex items-center gap-2 mr-2">
                            <Link2 className="w-3.5 h-3.5" /> Assessment Links
                          </span>
                          {q.exams.map((eq) => (
                            <span
                              key={eq.exam?.title}
                              className="text-[10px] font-black px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {eq.exam?.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
               </Card>
            ))}
         </div>
      </div>
    </div>
  );
}
