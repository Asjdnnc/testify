"use client";

import { useState, useRef, useEffect } from "react";
import { 
  X, 
  Plus, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Layers, 
  HelpCircle,
  PlusCircle,
  Trash2,
  Edit3,
  Search,
  BookOpen,
  Wand2,
  Scan,
  Camera
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function QuestionContributionModal({ isOpen, onClose, subjects, onFinalize, initialData = null }) {
  const [activeTab, setActiveTab] = useState("SINGLE"); // SINGLE or BATCH
  const [subjectId, setSubjectId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Single Question Logic State
  const [singleFormData, setSingleFormData] = useState({
    text: "",
    type: "MCQ_SINGLE",
    defaultMarks: 2,
    modelAnswer: "",
    options: [
      { text: "", label: "A", isCorrect: true, order: 0 },
      { text: "", label: "B", isCorrect: false, order: 1 }
    ]
  });

  // Batch OCR Logic State
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("UPLOAD"); // UPLOAD -> REVIEW
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const fileInputRef = useRef(null);
  const singleScanInputRef = useRef(null);
  const [isScanningSingle, setIsScanningSingle] = useState(false);

  useEffect(() => {
    if (initialData) {
      setSingleFormData({
        text: initialData.text,
        type: initialData.type,
        defaultMarks: initialData.defaultMarks,
        modelAnswer: initialData.modelAnswer || "",
        options: initialData.options && initialData.options.length > 0
          ? initialData.options.map(o => ({ text: o.text, label: o.label, isCorrect: o.isCorrect, order: o.order }))
          : [{ text: "", label: "A", isCorrect: true, order: 0 }, { text: "", label: "B", isCorrect: false, order: 1 }]
      });
      setSubjectId(initialData.subjectId || "");
      setActiveTab("SINGLE");
    } else {
       // reset
       setSingleFormData({
         text: "", type: "MCQ_SINGLE", defaultMarks: 2, modelAnswer: "",
         options: [{ text: "", label: "A", isCorrect: true, order: 0 }, { text: "", label: "B", isCorrect: false, order: 1 }]
       });
       setSubjectId("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Manual Form Helpers
  const handleAddOption = () => {
    const nextLabel = String.fromCharCode(65 + singleFormData.options.length); 
    setSingleFormData(prev => ({
      ...prev,
      options: [...prev.options, { text: "", label: nextLabel, isCorrect: false, order: prev.options.length }]
    }));
  };

  const handleRemoveOption = (index) => {
    const newOptions = singleFormData.options.filter((_, i) => i !== index).map((opt, i) => ({
      ...opt, label: String.fromCharCode(65 + i), order: i
    }));
    setSingleFormData(prev => ({ ...prev, options: newOptions }));
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...singleFormData.options];
    if (field === 'isCorrect' && singleFormData.type === 'MCQ_SINGLE') {
      newOptions.forEach((opt, i) => opt.isCorrect = i === index);
    } else {
      newOptions[index][field] = value;
    }
    setSingleFormData(prev => ({ ...prev, options: newOptions }));
  };

  // OCR Helpers
  function fileToGenerativePart(fileToRead) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(fileToRead);
    });
  }

  async function handleOcrUpload() {
    if (!file) return;
    if (!subjectId) return toast.error("Select a subject first.");
    setError(null);
    setIsProcessing(true);
    try {
      const fileBase64 = await fileToGenerativePart(file);
      const response = await fetch("/api/ai/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBuffer: fileBase64, mimeType: file.type })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      setParsedQuestions(data.questions);
      setStep("REVIEW");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSingleScan(e) {
    const scanFile = e.target.files?.[0];
    if (!scanFile) return;

    setIsScanningSingle(true);
    const toastId = toast.loading("Magic at work: Scanning snippet...");
    
    try {
      const fileBase64 = await fileToGenerativePart(scanFile);
      const response = await fetch("/api/ai/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBuffer: fileBase64, mimeType: scanFile.type })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      
      if (data.questions && data.questions.length > 0) {
        const q = data.questions[0];
        setSingleFormData({
          text: q.text,
          type: q.type || "MCQ_SINGLE",
          defaultMarks: q.defaultMarks || 2,
          modelAnswer: q.modelAnswer || "",
          options: q.options && q.options.length > 0 
            ? q.options.map(o => ({ text: o.text, label: o.label, isCorrect: o.isCorrect, order: o.order }))
            : [{ text: "", label: "A", isCorrect: true, order: 0 }, { text: "", label: "B", isCorrect: false, order: 1 }]
        });
        toast.success("AI extraction complete!", { id: toastId });
      } else {
        toast.error("AI couldn't find a question in that snippet.", { id: toastId });
      }
    } catch (err) {
      toast.error("Scan failed: " + err.message, { id: toastId });
    } finally {
      setIsScanningSingle(false);
      e.target.value = ''; // Reset input
    }
  }

  const handleFinalize = () => {
    if (!subjectId) {
      toast.error("Subject is required.");
      return;
    }

    if (activeTab === "SINGLE") {
      onFinalize([{ ...singleFormData, subjectId }]);
    } else {
      onFinalize(parsedQuestions.map(q => ({ ...q, subjectId })));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border-none rounded-[32px] flex flex-col bg-white dark:bg-slate-900 transition-colors">
        
        {/* Header Section */}
        <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-6 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg">
                  <PlusCircle className="w-6 h-6 text-white" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">Add New Question</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest">Unified Contribution Hub</p>
               </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-10 h-10 hover:bg-slate-200 dark:hover:bg-slate-800">
               <X className="w-5 h-5 text-slate-500" />
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Subject Selection (Mandatory) */}
            <div className="flex-1 space-y-2">
               <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-1">Target Subject</Label>
               <select 
                 className="w-full h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 text-sm font-bold focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 transition-all dark:text-white outline-none"
                 value={subjectId}
                 onChange={(e) => setSubjectId(e.target.value)}
                 required
               >
                 <option value="">-- Choose Subject --</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>

            {/* Tabs */}
            {!initialData && (
              <div className="flex-1 space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-1">Contribution Type</Label>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button 
                    disabled={step === 'REVIEW'}
                    onClick={() => setActiveTab("SINGLE")}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${activeTab === "SINGLE" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Single Question
                  </button>
                  <button 
                    disabled={step === 'REVIEW'}
                    onClick={() => setActiveTab("BATCH")}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === "BATCH" ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Batch (AI Import)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar dark:text-slate-300">
          {!subjectId && !initialData? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 grayscale">
               <Layers className="w-16 h-16" />
               <h3 className="text-xl font-bold">Select a subject to unlock contribution tools</h3>
               <p className="text-sm max-w-xs">Each question must be mapped to an academic discipline for proper categorization.</p>
            </div>
          ) : activeTab === "SINGLE" ? (
            <div className="grid lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-300">
               {/* Manual Form Left */}
               <div className="space-y-6">
                  <div className="space-y-2">
                     <Label className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <HelpCircle className="w-4 h-4 text-indigo-600" /> Question Type
                     </Label>
                     <div className="grid grid-cols-3 gap-2">
                        {["MCQ_SINGLE", "MCQ_MULTIPLE", "SUBJECTIVE"].map(type => (
                           <button
                              key={type}
                              type="button"
                              onClick={() => setSingleFormData({...singleFormData, type})}
                              className={`px-2 py-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${
                                 singleFormData.type === type 
                                 ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
                                 : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                           >
                              {type.replace('_', ' ')}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="font-bold text-slate-800 dark:text-slate-200">Default Marks</Label>
                     <Input 
                        type="number" 
                        className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 dark:text-white" 
                        value={singleFormData.defaultMarks}
                        onChange={(e) => setSingleFormData({...singleFormData, defaultMarks: e.target.value})}
                     />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <Label className="font-bold text-slate-800 dark:text-slate-200">Question Content</Label>
                       <div className="flex items-center gap-2">
                          <input 
                             type="file" 
                             className="hidden" 
                             ref={singleScanInputRef} 
                             accept="image/*,.pdf" 
                             onChange={handleSingleScan} 
                          />
                          <Button 
                             type="button" 
                             variant="ghost" 
                             size="sm" 
                             onClick={() => singleScanInputRef.current?.click()}
                             disabled={isScanningSingle}
                             className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-2"
                          >
                             {isScanningSingle ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                             ) : (
                                <Scan className="w-3 h-3" />
                             )}
                             AI Scan Snippet
                          </Button>
                       </div>
                    </div>
                    <textarea 
                      className="w-full h-40 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 text-sm focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 transition-all outline-none dark:text-white"
                      placeholder="Type your question statement here..."
                      value={singleFormData.text}
                      onChange={(e) => setSingleFormData({...singleFormData, text: e.target.value})}
                    />
                  </div>
               </div>

               {/* Manual Form Right (Options or Model Answer) */}
               <div className="space-y-4">
                  {singleFormData.type !== "SUBJECTIVE" ? (
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <Label className="font-bold text-slate-800 dark:text-slate-200">Options</Label>
                          <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="rounded-full h-8 text-[10px] uppercase font-black tracking-widest border-indigo-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400">
                             <Plus className="w-3 h-3 mr-1" /> Add Choice
                          </Button>
                       </div>
                       <div className="grid gap-3">
                         {singleFormData.options.map((opt, i) => (
                           <div key={i} className="flex items-center gap-3 animate-in slide-in-from-right-2">
                             <button 
                               type="button"
                               onClick={() => handleOptionChange(i, 'isCorrect', !opt.isCorrect)}
                               className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${
                                 opt.isCorrect ? "bg-emerald-600 border-emerald-600 text-white shadow-lg" : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400"
                               }`}
                             >
                                {opt.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-black">{opt.label}</span>}
                             </button>
                             <Input 
                               placeholder={`Option text...`}
                               className="h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 dark:text-white"
                               value={opt.text}
                               onChange={(e) => handleOptionChange(i, 'text', e.target.value)}
                             />
                             {singleFormData.options.length > 2 && (
                               <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(i)} className="text-slate-400 hover:text-rose-600 rounded-full h-8 w-8">
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             )}
                           </div>
                         ))}
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="font-bold text-slate-800 dark:text-slate-200">Model Answer (Reference)</Label>
                      <textarea 
                        className="w-full h-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 text-sm focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 transition-all outline-none dark:text-white"
                        placeholder="Gold-standard answer for grading..."
                        value={singleFormData.modelAnswer}
                        onChange={(e) => setSingleFormData({...singleFormData, modelAnswer: e.target.value})}
                      />
                    </div>
                  )}
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
               {step === "UPLOAD" ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-8 max-w-lg mx-auto text-center">
                     <div 
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                           e.preventDefault();
                           if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full aspect-square rounded-[40px] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-400 ${
                           file ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50'
                        }`}
                     >
                        <input type="file" className="hidden" ref={fileInputRef} accept=".pdf,image/*" onChange={e => setFile(e.target.files[0])} />
                        {file ? (
                           <div className="space-y-3">
                              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                              <h4 className="font-black text-slate-800 dark:text-white">{file.name}</h4>
                              <p className="text-[10px] font-bold uppercase text-slate-400">{(file.size/1024/1024).toFixed(2)} MB • Ready to Scan</p>
                           </div>
                        ) : (
                           <div className="space-y-3">
                              <UploadCloud className="w-16 h-16 text-slate-300 group-hover:text-indigo-500 transition-colors mx-auto" />
                              <h4 className="font-black text-slate-800 dark:text-white">Click to Upload Document</h4>
                              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Supports PDFs & Images</p>
                           </div>
                        )}
                     </div>

                     <Button 
                       onClick={handleOcrUpload}
                       disabled={!file || isProcessing}
                       className="w-full h-16 rounded-[24px] bg-slate-900 border-b-4 border-slate-700 hover:bg-slate-800 text-white font-black text-lg shadow-2xl transition-all active:scale-95 active:border-b-0"
                     >
                        {isProcessing ? <><Loader2 className="w-6 h-6 mr-2 animate-spin text-indigo-400" /> Neural Scanning...</> : "Import Questions with AI"}
                     </Button>
                  </div>
               ) : (
                  <div className="grid gap-4">
                     {parsedQuestions.map((q, idx) => (
                       <div key={idx} className="relative p-6 rounded-[24px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm group">
                          <Button size="icon" variant="ghost" onClick={() => {
                             const updated = [...parsedQuestions];
                             updated.splice(idx, 1);
                             setParsedQuestions(updated);
                          }} className="absolute top-4 right-4 h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></Button>
                          
                          <div className="flex items-center gap-3 mb-4">
                             <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 py-1">{q.type.replace('_', ' ')}</Badge>
                             <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <button disabled={q.defaultMarks <= 1} onClick={()=>{const u=[...parsedQuestions]; u[idx].defaultMarks--; setParsedQuestions(u)}} className="px-2 py-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30">-</button>
                                <span className="text-[10px] font-black px-2 min-w-[50px] text-center dark:text-white">{q.defaultMarks} Marks</span>
                                <button onClick={()=>{const u=[...parsedQuestions]; u[idx].defaultMarks++; setParsedQuestions(u)}} className="px-2 py-1 text-slate-400 hover:text-slate-800 dark:hover:text-white">+</button>
                             </div>
                          </div>

                          <textarea 
                             className="w-full text-lg font-bold text-slate-800 dark:text-white border-none bg-transparent resize-none p-0 focus:ring-0 outline-none leading-tight" 
                             value={q.text} 
                             onChange={(e) => {
                                const updated = [...parsedQuestions];
                                updated[idx].text = e.target.value;
                                setParsedQuestions(updated);
                             }}
                             rows={2}
                          />

                          {q.type.includes("MCQ") && q.options && (
                             <div className="mt-4 grid grid-cols-2 gap-2">
                                {q.options.map((opt, oIdx) => (
                                   <div key={oIdx} className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-3 border ${opt.isCorrect ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                                      <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-[9px] cursor-pointer" onClick={() => {
                                         const u = [...parsedQuestions];
                                         if(q.type === 'MCQ_SINGLE') u[idx].options.forEach(o => o.isCorrect = false);
                                         u[idx].options[oIdx].isCorrect = !u[idx].options[oIdx].isCorrect;
                                         setParsedQuestions(u);
                                      }}>{opt.label}</div>
                                      <input className="bg-transparent border-none w-full p-0 focus:ring-0 outline-none" value={opt.text} onChange={e => {
                                         const u = [...parsedQuestions];
                                         u[idx].options[oIdx].text = e.target.value;
                                         setParsedQuestions(u);
                                      }} />
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>
                     ))}
                  </div>
               )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0 flex items-center justify-between">
           {step === "REVIEW" ? (
              <Button variant="ghost" className="h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-500" onClick={() => {setStep("UPLOAD"); setParsedQuestions([]); setFile(null);}}>
                 Discard Scan
              </Button>
           ) : (
              <div />
           )}
           <Button 
             onClick={handleFinalize} 
             disabled={!subjectId || (activeTab === "SINGLE" && !singleFormData.text) || (activeTab === "BATCH" && parsedQuestions.length === 0)}
             className="h-12 px-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] shadow-xl transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
           >
              {initialData ? "Save Changes" : activeTab === "BATCH" ? `Save ${parsedQuestions.length} AI Extractions` : "Save Individual Question"}
           </Button>
        </div>
      </Card>
    </div>
  );
}
