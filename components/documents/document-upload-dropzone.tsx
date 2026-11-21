"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Loader2, Sparkles } from "lucide-react";

interface DocumentUploadDropzoneProps {
  onIncomeExtracted?: (income: number, employer?: string) => void;
  onParsed?: (data: { monthlyIncome: number; confidence: number; rawText: string; documentName: string }) => void;
  className?: string;
  label?: string;
}

export function DocumentUploadDropzone({
  onIncomeExtracted,
  onParsed,
  className = "",
  label = "Upload Payslip or Tax Return (Amazon Textract OCR)",
}: DocumentUploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // File validation
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a PDF, PNG, or JPEG file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB size limit.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/documents/parse-income", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to process document");
      }

      setResult(json.data);
      if (json.data?.monthlyIncome && onIncomeExtracted) {
        onIncomeExtracted(json.data.monthlyIncome, json.data.employerName);
      }
      if (json.data && onParsed) {
        onParsed({
          monthlyIncome: json.data.monthlyIncome || 0,
          confidence: json.data.confidence || 0.9,
          rawText: json.data.rawText || '',
          documentName: file.name,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Amazon Textract extraction error");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-primary" />
        {label}
      </span>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
        } ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium">
              Extracting financial data via Amazon Textract...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UploadCloud className="size-4" />
            </div>
            <p className="text-xs font-medium text-foreground">
              Click to upload or drag & drop payslip / W-2
            </p>
            <p className="text-[10px] text-muted-foreground">
              PDF, PNG, JPEG up to 5MB (Auto-verifies declared income)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              OCR Verified Income
            </span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold">
              {Math.round(result.confidenceScore * 100)}% Confidence
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-base font-bold">
              ${result.monthlyIncome ? Number(result.monthlyIncome).toLocaleString() : "Undetected"}
            </span>
            <span className="text-[11px] text-muted-foreground">/ month verified</span>
          </div>

          {result.rawTextSnippets?.length > 0 && (
            <p className="mt-1 line-clamp-1 font-mono text-[10px] text-muted-foreground">
              Text: {result.rawTextSnippets.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
