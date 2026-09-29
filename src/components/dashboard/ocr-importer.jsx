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
      const maxFileSize = 10 * 1024 * 1024; // matches the server limit in /api/ai/ocr
      if (file.size > maxFileSize) {
        throw new Error("That file is larger than 10 MB. Try a smaller PDF or a photo.");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl border-none rounded-2xl flex flex-col bg-card text-foreground">
        
        {/* Header */}
        <div className="p-8 pb-6 border-b border-border bg-gradient-to-br from-indigo-50/50 to-white flex items-center justify-between shrink-0">
          <div>
             <h2 className="text-2xl font-semibold text-foreground">
                {step === "UPLOAD" ? "Import Questions with AI" : "Review Extracted Questions"}
             </h2>
             <p className="text-muted-foreground font-bold text-xs tracking-wide mt-1">
                {step === "UPLOAD" ? "Drag or upload exam documents" : "Verify AI Pipeline Structure"}
             </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isProcessing} className="rounded-full w-10 h-10 hover:bg-muted">
             <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Dynamic Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {error && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-destructive/10 border border-destructive/40 text-destructive text-sm font-medium">
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
                  className={`w-full aspect-video rounded-2xl border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group hover:bg-primary/10 hover:border-primary/30 ${
                     file ? 'border-primary/30 bg-primary/10' : 'border-border bg-muted/50'
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
                     <div className="flex flex-col items-center gap-3 text-primary animate-in zoom-in">
                        <CheckCircle2 className="w-12 h-12 text-success-foreground" />
                        <span className="font-bold">{file.name}</span>
                        <span className="text-xs font-semibold opacity-50">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
                        <UploadCloud className="w-16 h-16 opacity-50" />
                        <h3 className="text-lg font-semibold tracking-tight">Drop a question paper here</h3>
                        <p className="text-xs font-bold tracking-wide opacity-60">PDF, PNG or JPG · up to 10 MB</p>
                     </div>
                  )}
               </div>

               <Button 
                 disabled={!file || isProcessing} 
                 onClick={handleUpload}
                 className="w-full h-16 rounded-xl bg-foreground border-border hover:bg-foreground/90 text-background font-semibold text-lg transition-all active:scale-95 active:border-b-0 shadow-2xl"
               >
                 {isProcessing ? (
                    <><Loader2 className="w-6 h-6 mr-2 animate-spin text-primary" /> Reading document…</>
                 ) : (
                    <><Layers className="w-6 h-6 mr-2 text-primary" /> Find questions</>
                 )}
               </Button>
            </div>
          )}

          {step === "REVIEW" && (
            <div className="space-y-6">
               <div className="p-5 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shrink-0 shadow-lg">
                     <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="font-semibold text-primary text-lg">Review imported questions</h3>
                     <p className="text-sm font-medium text-primary opacity-80 leading-relaxed">
                        We identified <strong className="font-semibold">{parsedQuestions.length} valid questions</strong>. 
                        Review the generated structures below. You can drop specific failed extractions before saving to your question bank.
                     </p>
                  </div>
               </div>

               <div className="grid gap-4">
                  {parsedQuestions.map((q, idx) => (
                    <div key={idx} className="relative p-6 rounded-xl bg-card text-foreground border border-border shadow-sm group">
                       <Button size="icon" variant="ghost" onClick={() => removeParsedQuestion(idx)} className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></Button>
                       
                       <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 bg-muted rounded-lg text-[11px] font-semibold tracking-wide">{q.type.replace('_', ' ')}</span>
                          <div className="flex items-center bg-success/12 rounded-lg overflow-hidden border border-success/40">
                             <button
                               disabled={q.defaultMarks <= 1}
                               onClick={() => {
                                  const updated = [...parsedQuestions];
                                  updated[idx].defaultMarks -= 1;
                                  setParsedQuestions(updated);
                               }}
                               className="px-2 py-1 text-success-foreground hover:bg-success/12 transition-colors disabled:opacity-50"
                             >
                               -
                             </button>
                             <span className="text-xs font-semibold text-success-foreground px-1 min-w-[50px] text-center">
                               {q.defaultMarks} Marks
                             </span>
                             <button
                               onClick={() => {
                                  const updated = [...parsedQuestions];
                                  updated[idx].defaultMarks += 1;
                                  setParsedQuestions(updated);
                               }}
                               className="px-2 py-1 text-success-foreground hover:bg-success/12 transition-colors"
                             >
                               +
                             </button>
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

                       {q.type.includes("MCQ") && q.options && q.options.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                             {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-3 border ${opt.isCorrect ? 'bg-success/12 border-success/40 text-success-foreground' : 'bg-muted/50 border-transparent text-muted-foreground'}`}>
                                   <div className="w-5 h-5 rounded flex items-center justify-center bg-card shadow-sm border border-black/5 text-[11px] cursor-pointer" onClick={() => {
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
                          <div className="mt-4 p-4 rounded-2xl bg-warning/15 border border-warning/40">
                             <div className="text-[11px] font-semibold text-amber-700/50 tracking-wide mb-1">Model answer</div>
                             <textarea 
                                className="w-full text-sm font-medium text-warning-foreground border-none bg-transparent resize-none p-0 focus:ring-0 outline-none placeholder:text-warning-foreground" 
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
           <div className="p-6 border-t border-border bg-muted/50 shrink-0 flex items-center justify-between">
              <Button variant="ghost" className="h-12 rounded-xl font-bold text-[11px] tracking-wide text-muted-foreground" onClick={() => {setStep("UPLOAD"); setParsedQuestions([]); setFile(null);}}>
                 Discard & Restart
              </Button>
              <Button onClick={handleFinalize} className="h-12 px-8 rounded-xl bg-primary hover:bg-primary text-white font-semibold tracking-wide text-[11px] shadow-xl transition-transform active:scale-95 flex items-center gap-2">
                 Save {parsedQuestions.length} Questions <Edit3 className="w-4 h-4" />
              </Button>
           </div>
        )}
      </Card>
    </div>
  );
}
