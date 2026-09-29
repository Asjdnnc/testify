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
    const toastId = toast.loading("Reading the image…");
    
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
        toast.success("Question filled in from the image — please review it", { id: toastId });
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border-none rounded-2xl flex flex-col bg-card transition-colors">
        
        {/* Header Section */}
        <div className="p-8 pb-6 border-b border-border bg-muted/30 flex flex-col gap-6 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="bg-primary p-2.5 rounded-2xl shadow-lg">
                  <PlusCircle className="w-6 h-6 text-white" />
               </div>
               <div>
                  <h2 className="text-2xl font-semibold text-foreground">Add questions</h2>
                  <p className="text-muted-foreground font-bold text-xs tracking-wide">Write a question, or import a whole paper with AI</p>
               </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-10 h-10 hover:bg-muted dark:hover:bg-muted">
               <X className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Subject Selection (Mandatory) */}
            <div className="flex-1 space-y-2">
               <Label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">Subject</Label>
               <select 
                 className="w-full h-12 rounded-xl border border-border bg-card px-4 text-sm font-bold focus:ring-4 focus:ring-ring dark:focus:ring-ring transition-all outline-none"
                 value={subjectId}
                 onChange={(e) => setSubjectId(e.target.value)}
                 required
               >
                 <option value="">Select a subject</option>
                 {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>

            {/* Tabs */}
            {!initialData && (
              <div className="flex-1 space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">Method</Label>
                <div className="flex p-1 bg-muted rounded-xl">
                  <button 
                    disabled={step === 'REVIEW'}
                    onClick={() => setActiveTab("SINGLE")}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold  transition-all ${activeTab === "SINGLE" ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'}`}
                  >
                    Write one
                  </button>
                  <button 
                    disabled={step === 'REVIEW'}
                    onClick={() => setActiveTab("BATCH")}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-semibold  transition-all flex items-center justify-center gap-2 ${activeTab === "BATCH" ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground'}`}
                  >
                    Import with AI
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {!subjectId && !initialData? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 grayscale">
               <Layers className="w-16 h-16" />
               <h3 className="text-xl font-bold">Choose a subject to get started</h3>
               <p className="text-sm max-w-xs">Questions are organised by subject so teachers can find and reuse them.</p>
            </div>
          ) : activeTab === "SINGLE" ? (
            <div className="grid lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-300">
               {/* Manual Form Left */}
               <div className="space-y-6">
                  <div className="space-y-2">
                     <Label className="font-bold flex items-center gap-2 text-foreground">
                        <HelpCircle className="w-4 h-4 text-primary" /> Question Type
                     </Label>
                     <div className="grid grid-cols-3 gap-2">
                        {["MCQ_SINGLE", "MCQ_MULTIPLE", "SUBJECTIVE"].map(type => (
                           <button
                              key={type}
                              type="button"
                              onClick={() => setSingleFormData({...singleFormData, type})}
                              className={`px-2 py-3 rounded-xl text-[11px] font-semibold  transition-all border-2 ${
                                 singleFormData.type === type 
                                 ? "bg-primary text-white border-primary shadow-md" 
                                 : "bg-muted/50 border-border text-muted-foreground hover:bg-muted dark:hover:bg-muted"
                              }`}
                           >
                              {{ MCQ_SINGLE: "Single choice", MCQ_MULTIPLE: "Multiple choice", SUBJECTIVE: "Written" }[type]}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label className="font-bold text-foreground">Marks</Label>
                     <Input 
                        type="number" 
                        className="h-12 rounded-xl border-border bg-card" 
                        value={singleFormData.defaultMarks}
                        onChange={(e) => setSingleFormData({...singleFormData, defaultMarks: e.target.value})}
                     />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <Label className="font-bold text-foreground">Question</Label>
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
                             className="h-8 rounded-lg text-xs font-semibold tracking-wide text-primary bg-primary/10 hover:bg-primary/10 dark:hover:bg-indigo-900/50 flex items-center gap-2"
                          >
                             {isScanningSingle ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                             ) : (
                                <Scan className="w-3 h-3" />
                             )}
                             Scan from image
                          </Button>
                       </div>
                    </div>
                    <textarea 
                      className="w-full h-40 rounded-2xl border border-border bg-card px-4 py-4 text-sm focus:ring-4 focus:ring-ring dark:focus:ring-ring transition-all outline-none"
                      placeholder="Type the question students will see…"
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
                          <Label className="font-bold text-foreground">Options</Label>
                          <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="rounded-full h-8 text-xs font-semibold tracking-wide border-primary/30 text-primary">
                             <Plus className="w-3 h-3 mr-1" /> Add option
                          </Button>
                       </div>
                       <div className="grid gap-3">
                         {singleFormData.options.map((opt, i) => (
                           <div key={i} className="flex items-center gap-3 animate-in slide-in-from-right-2">
                             <button 
                               type="button"
                               onClick={() => handleOptionChange(i, 'isCorrect', !opt.isCorrect)}
                               className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${
                                 opt.isCorrect ? "bg-emerald-600 border-success/40 text-white shadow-lg" : "bg-muted/50 border-border text-muted-foreground"
                               }`}
                             >
                                {opt.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-semibold">{opt.label}</span>}
                             </button>
                             <Input 
                               placeholder={`Option text...`}
                               className="h-11 rounded-xl border-border bg-card"
                               value={opt.text}
                               onChange={(e) => handleOptionChange(i, 'text', e.target.value)}
                             />
                             {singleFormData.options.length > 2 && (
                               <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(i)} className="text-muted-foreground hover:text-destructive rounded-full h-8 w-8">
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             )}
                           </div>
                         ))}
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="font-bold text-foreground">Model answer (teachers only)</Label>
                      <textarea 
                        className="w-full h-64 rounded-2xl border border-border bg-card px-4 py-4 text-sm focus:ring-4 focus:ring-ring dark:focus:ring-ring transition-all outline-none"
                        placeholder="Key points a full-marks answer should cover…"
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
                        className={`w-full aspect-square rounded-2xl border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group hover:bg-primary/10 dark:hover:bg-indigo-950/20 hover:border-primary/30 ${
                           file ? 'border-success/40 bg-success/12 dark:bg-emerald-950/20' : 'border-border bg-muted/50'
                        }`}
                     >
                        <input type="file" className="hidden" ref={fileInputRef} accept=".pdf,image/*" onChange={e => setFile(e.target.files[0])} />
                        {file ? (
                           <div className="space-y-3">
                              <CheckCircle2 className="w-16 h-16 text-success-foreground mx-auto" />
                              <h4 className="font-semibold text-foreground">{file.name}</h4>
                              <p className="text-xs font-bold text-muted-foreground">{(file.size/1024/1024).toFixed(2)} MB • Ready to Scan</p>
                           </div>
                        ) : (
                           <div className="space-y-3">
                              <UploadCloud className="w-16 h-16 text-muted-foreground group-hover:text-primary transition-colors mx-auto" />
                              <h4 className="font-semibold text-foreground">Click to upload a question paper</h4>
                              <p className="text-xs font-bold text-muted-foreground tracking-wide">PDF, PNG or JPG · up to 10 MB</p>
                           </div>
                        )}
                     </div>

                     <Button 
                       onClick={handleOcrUpload}
                       disabled={!file || isProcessing}
                       className="w-full h-16 rounded-xl bg-foreground border-border hover:bg-foreground/90 text-background font-semibold text-lg shadow-2xl transition-all active:scale-95 active:border-b-0"
                     >
                        {isProcessing ? <><Loader2 className="w-6 h-6 mr-2 animate-spin text-primary" /> Reading document…</> : "Import Questions with AI"}
                     </Button>
                  </div>
               ) : (
                  <div className="grid gap-4">
                     {parsedQuestions.map((q, idx) => (
                       <div key={idx} className="relative p-6 rounded-xl bg-muted/50 border border-border shadow-sm group">
                          <Button size="icon" variant="ghost" onClick={() => {
                             const updated = [...parsedQuestions];
                             updated.splice(idx, 1);
                             setParsedQuestions(updated);
                          }} className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></Button>
                          
                          <div className="flex items-center gap-3 mb-4">
                             <Badge variant="outline" className="bg-card border-border text-[11px] font-semibold text-primary py-1">{q.type.replace('_', ' ')}</Badge>
                             <div className="flex items-center bg-card rounded-lg border border-border overflow-hidden">
                                <button disabled={q.defaultMarks <= 1} onClick={()=>{const u=[...parsedQuestions]; u[idx].defaultMarks--; setParsedQuestions(u)}} className="px-2 py-1 text-muted-foreground hover:text-foreground dark:hover:text-white disabled:opacity-30">-</button>
                                <span className="text-xs font-semibold px-2 min-w-[50px] text-center">{q.defaultMarks} Marks</span>
                                <button onClick={()=>{const u=[...parsedQuestions]; u[idx].defaultMarks++; setParsedQuestions(u)}} className="px-2 py-1 text-muted-foreground hover:text-foreground dark:hover:text-white">+</button>
                             </div>
                          </div>

                          <textarea 
                             className="w-full text-lg font-bold text-foreground border-none bg-transparent resize-none p-0 focus:ring-0 outline-none leading-tight" 
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
                                   <div key={oIdx} className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-3 border ${opt.isCorrect ? 'bg-success/12 dark:bg-emerald-950/20 border-success/40 dark:border-success/40 text-success-foreground dark:text-success-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                                      <div className="w-5 h-5 rounded flex items-center justify-center bg-muted text-[11px] cursor-pointer" onClick={() => {
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
        <div className="p-6 border-t border-border bg-muted/50 shrink-0 flex items-center justify-between">
           {step === "REVIEW" ? (
              <Button variant="ghost" className="h-12 rounded-xl font-bold text-xs tracking-wide text-muted-foreground" onClick={() => {setStep("UPLOAD"); setParsedQuestions([]); setFile(null);}}>
                 Discard Scan
              </Button>
           ) : (
              <div />
           )}
           <Button 
             onClick={handleFinalize} 
             disabled={!subjectId || (activeTab === "SINGLE" && !singleFormData.text) || (activeTab === "BATCH" && parsedQuestions.length === 0)}
             className="h-12 px-10 rounded-xl bg-primary hover:bg-primary text-white font-semibold tracking-wide text-[11px] shadow-xl transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
           >
              {initialData ? "Save changes" : activeTab === "BATCH" ? `Save ${parsedQuestions.length} AI Extractions` : "Save question"}
           </Button>
        </div>
      </Card>
    </div>
  );
}
