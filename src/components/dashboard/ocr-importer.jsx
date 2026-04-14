"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, FileImage, X, Edit3, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function OCRImporterModal({ isOpen, onClose, onImportFinalize }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("UPLOAD"); // UPLOAD -> REVIEW
  const [subjectId, setSubjectId] = useState("");

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function fileToGenerativePart(fileToRead) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Output looks like "data:image/png;base64,iVBORw0KGgo..."
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileToRead);
    });
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      const maxFileSize = 20 * 1024 * 1024; // 20 MB max
      if (file.size > maxFileSize) {
        throw new Error("File exceeds 20MB limit.");
      }

      const fileBase64 = await fileToGenerativePart(file);

      const response = await fetch("/api/ai/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBuffer: fileBase64,
          mimeType: file.type
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Failed to process document");
      }

      if (data.questions && data.questions.length > 0) {
        setParsedQuestions(data.questions);
        setStep("REVIEW");
        toast.success(`Successfully Extracted ${data.questions.length} questions!`);
      } else {
        throw new Error("AI could not detect any questions in this document.");
      }

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type.includes("image") || droppedFile.type.includes("pdf"))) {
      setFile(droppedFile);
    } else {
      toast.error("Format not supported. Pls use PDF, PNG, or JPG.");
    }
  };

  const removeParsedQuestion = (index) => {
    const updated = [...parsedQuestions];
    updated.splice(index, 1);
    setParsedQuestions(updated);
  };

  const handleFinalize = () => {
    if (parsedQuestions.length === 0) {
       toast.error("No questions to import.");
       return;
    }
    // Hand them back to the parent to do the actual saving
    onImportFinalize(parsedQuestions);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl border-none rounded-[32px] flex flex-col bg-white">
        
        {/* Header */}
        <div className="p-8 pb-6 border-b border-muted/10 bg-gradient-to-br from-indigo-50/50 to-white flex items-center justify-between shrink-0">
          <div>
             <h2 className="text-2xl font-black text-slate-800">
                {step === "UPLOAD" ? "Import Questions with AI" : "Review Extracted Questions"}
             </h2>
             <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">
                {step === "UPLOAD" ? "Drag or upload exam documents" : "Verify AI Pipeline Structure"}
             </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isProcessing} className="rounded-full w-10 h-10 hover:bg-slate-100">
             <X className="w-5 h-5 text-slate-500" />
          </Button>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p>{error}</p>
            </div>
          )}

          {step === "UPLOAD" && (
            <div className="flex flex-col items-center justify-center space-y-6 max-w-lg mx-auto py-8">
               
               <div 
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full aspect-video rounded-[32px] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group hover:bg-indigo-50/50 hover:border-indigo-200 ${
                     file ? 'border-indigo-400 bg-indigo-50' : 'border-muted/30 bg-slate-50'
                  }`}
               >
                  <input 
                     type="file" 
                     className="hidden" 
                     ref={fileInputRef} 
                     accept="application/pdf,image/png,image/jpeg,image/jpg" 
                     onChange={(e) => {
                        if (e.target.files[0]) setFile(e.target.files[0]);
                     }} 
                  />
                  
                  {file ? (
                     <div className="flex flex-col items-center gap-3 text-indigo-700 animate-in zoom-in">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                        <span className="font-bold">{file.name}</span>
                        <span className="text-[10px] uppercase font-black opacity-50">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <UploadCloud className="w-16 h-16 opacity-50" />
                        <h3 className="text-lg font-black tracking-tight">Drop Document Here</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Supports PDF, PNG, JPG (Max 20MB)</p>
                     </div>
                  )}
               </div>

               <Button 
                 disabled={!file || isProcessing} 
                 onClick={handleUpload}
                 className="w-full h-16 rounded-[24px] bg-slate-900 border-b-4 border-slate-700 hover:bg-slate-800 text-white font-black text-lg transition-all active:scale-95 active:border-b-0 shadow-2xl"
               >
                 {isProcessing ? (
                    <><Loader2 className="w-6 h-6 mr-2 animate-spin text-indigo-400" /> Extracting...</>
                 ) : (
                    <><Layers className="w-6 h-6 mr-2 text-indigo-400" /> Extract Questions</>
                 )}
               </Button>
            </div>
          )}

          {step === "REVIEW" && (
            <div className="space-y-6">
               <div className="p-5 rounded-[24px] bg-indigo-50 border border-indigo-100 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                     <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="font-black text-indigo-900 text-lg">AI Import Complete</h3>
                     <p className="text-sm font-medium text-indigo-700 opacity-80 leading-relaxed">
                        We identified <strong className="font-black">{parsedQuestions.length} valid questions</strong>. 
                        Review the generated structures below. You can drop specific failed extractions before saving to your question bank.
                     </p>
                  </div>
               </div>

               <div className="grid gap-4">
                  {parsedQuestions.map((q, idx) => (
                    <div key={idx} className="relative p-6 rounded-[24px] bg-white border border-muted/20 shadow-sm group">
                       <Button size="icon" variant="ghost" onClick={() => removeParsedQuestion(idx)} className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></Button>
                       
                       <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest">{q.type.replace('_', ' ')}</span>
                          <div className="flex items-center bg-emerald-50 rounded-lg overflow-hidden border border-emerald-100">
                             <button
                               disabled={q.defaultMarks <= 1}
                               onClick={() => {
                                  const updated = [...parsedQuestions];
                                  updated[idx].defaultMarks -= 1;
                                  setParsedQuestions(updated);
                               }}
                               className="px-2 py-1 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                             >
                               -
                             </button>
                             <span className="text-[10px] font-black text-emerald-700 uppercase px-1 min-w-[50px] text-center">
                               {q.defaultMarks} Marks
                             </span>
                             <button
                               onClick={() => {
                                  const updated = [...parsedQuestions];
                                  updated[idx].defaultMarks += 1;
                                  setParsedQuestions(updated);
                               }}
                               className="px-2 py-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                             >
                               +
                             </button>
                          </div>
                       </div>
                       
                       <textarea 
                          className="w-full text-lg font-bold text-slate-800 border-none bg-transparent resize-none p-0 focus:ring-0 outline-none leading-tight" 
                          value={q.text} 
                          onChange={(e) => {
                             const updated = [...parsedQuestions];
                             updated[idx].text = e.target.value;
                             setParsedQuestions(updated);
                          }}
                          rows={2}
                       />

                       {q.type.includes("MCQ") && q.options && q.options.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                             {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-3 border ${opt.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-transparent text-slate-600'}`}>
                                   <div className="w-5 h-5 rounded flex items-center justify-center bg-white shadow-sm border border-black/5 text-[9px] cursor-pointer" onClick={() => {
                                      const updated = [...parsedQuestions];
                                      if (q.type === 'MCQ_SINGLE') {
                                         updated[idx].options.forEach(o => o.isCorrect = false);
                                      }
                                      updated[idx].options[oIdx].isCorrect = !updated[idx].options[oIdx].isCorrect;
                                      setParsedQuestions(updated);
                                   }}>{opt.label}</div>
                                   <input className="bg-transparent border-none w-full p-0 focus:ring-0 outline-none" value={opt.text} onChange={(e) => {
                                      const updated = [...parsedQuestions];
                                      updated[idx].options[oIdx].text = e.target.value;
                                      setParsedQuestions(updated);
                                   }} />
                                </div>
                             ))}
                          </div>
                       )}

                       {q.type === "SUBJECTIVE" && (
                          <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
                             <div className="text-[9px] font-black uppercase text-amber-700/50 tracking-widest mb-1">Extracted Reference Block</div>
                             <textarea 
                                className="w-full text-sm font-medium text-amber-900 border-none bg-transparent resize-none p-0 focus:ring-0 outline-none placeholder:text-amber-300" 
                                value={q.modelAnswer || ""} 
                                placeholder="Edit subject reference..."
                                onChange={(e) => {
                                   const updated = [...parsedQuestions];
                                   updated[idx].modelAnswer = e.target.value;
                                   setParsedQuestions(updated);
                                }}
                                rows={2}
                             />
                          </div>
                       )}
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "REVIEW" && (
           <div className="p-6 border-t border-muted/10 bg-slate-50 shrink-0 flex items-center justify-between">
              <Button variant="ghost" className="h-12 rounded-xl font-bold uppercase text-[11px] tracking-widest text-slate-500" onClick={() => {setStep("UPLOAD"); setParsedQuestions([]); setFile(null);}}>
                 Discard & Restart
              </Button>
              <Button onClick={handleFinalize} className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] shadow-xl transition-transform active:scale-95 flex items-center gap-2">
                 Save {parsedQuestions.length} Questions <Edit3 className="w-4 h-4" />
              </Button>
           </div>
        )}
      </Card>
    </div>
  );
}
