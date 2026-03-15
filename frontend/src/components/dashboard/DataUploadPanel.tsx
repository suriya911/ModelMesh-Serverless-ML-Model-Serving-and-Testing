import { useState, useRef } from "react";
import { Upload, FileText, Table2, Loader2 } from "lucide-react";
import type { ComparisonOptions } from "@/lib/ml-api";

interface Props {
  onCompare: (options: ComparisonOptions, file?: File | null) => void;
  loading: boolean;
}

const DATA_FORMATS = [
  { value: "csv", label: "CSV", desc: "Comma-separated values" },
  { value: "json", label: "JSON", desc: "Structured JSON array" },
  { value: "parquet", label: "Parquet", desc: "Columnar binary format" },
  { value: "tsv", label: "TSV", desc: "Tab-separated values" },
];

const MODEL_OPTIONS = [
  { value: "logistic_regression", label: "Linear / Logistic Regression" },
  { value: "decision_tree", label: "Decision Tree" },
  { value: "random_forest", label: "Random Forest" },
  { value: "gradient_boosting", label: "Gradient Boosting" },
  { value: "svm", label: "Support Vector Machine" },
  { value: "knn", label: "K-Nearest Neighbors" },
  { value: "mlp_neural_net", label: "MLP Neural Net" },
];

export default function DataUploadPanel({ onCompare, loading }: Props) {
  const [format, setFormat] = useState("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [kaggleUrl, setKaggleUrl] = useState("");
  const [metadataMode, setMetadataMode] = useState<"auto" | "manual">("auto");
  const [samples, setSamples] = useState(1000);
  const [features, setFeatures] = useState(8);
  const [classes, setClasses] = useState("0,1");
  const [trainSplit, setTrainSplit] = useState(0.8);
  const [modelAType, setModelAType] = useState("logistic_regression");
  const [modelBType, setModelBType] = useState("random_forest");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      // Detect format from extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && DATA_FORMATS.some(f => f.value === ext)) {
        setFormat(ext);
      }
    }
  };

  const parsedClasses = classes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Upload size={14} className="text-primary" />
        Upload &amp; Configure Data
      </h3>

      {/* File upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        className="group cursor-pointer rounded-md border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary/50 sm:p-6"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.parquet,.tsv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        {fileName ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={18} className="text-primary" />
            <span className="font-mono text-sm text-foreground">{fileName}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Table2 size={24} className="mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
            <p className="font-mono text-xs text-muted-foreground">
              Drop file or click to upload
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/60">
              CSV, JSON, Parquet, TSV
            </p>
          </div>
        )}
      </div>

      {/* Data format */}
      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-2">
          Data Format
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DATA_FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={`px-3 py-2 rounded-md font-mono text-[11px] border text-left transition-colors ${
                format === f.value
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              <div className="font-semibold">{f.label}</div>
              <div className="text-[9px] opacity-70 mt-0.5">{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
            Model A
          </label>
          <select
            value={modelAType}
            onChange={(e) => setModelAType(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
            Model B
          </label>
          <select
            value={modelBType}
            onChange={(e) => setModelBType(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Dataset Metadata Mode
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["auto", "manual"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMetadataMode(mode)}
              className={`rounded-md border px-3 py-2 font-mono text-[11px] transition-colors ${
                metadataMode === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "auto" ? "Auto Detect" : "Use Manual Values"}
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          Auto uses the uploaded file or Kaggle dataset. Manual keeps your entered samples, features, and classes in the comparison output.
        </p>
      </div>

      {/* Dataset params */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
            Samples
          </label>
          <input
            type="number"
            value={samples}
            onChange={(e) => setSamples(Math.max(100, parseInt(e.target.value) || 100))}
            disabled={metadataMode === "auto" && !!(selectedFile || kaggleUrl.trim())}
            className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
            Features
          </label>
          <input
            type="number"
            value={features}
            onChange={(e) => setFeatures(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={metadataMode === "auto" && !!(selectedFile || kaggleUrl.trim())}
            className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
          Classes
        </label>
        <input
          type="text"
          value={classes}
          onChange={(e) => setClasses(e.target.value)}
          disabled={metadataMode === "auto" && !!(selectedFile || kaggleUrl.trim())}
          placeholder="0,1 or cat,dog,bird"
          className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
          Kaggle Dataset / Competition URL
        </label>
        <input
          type="url"
          value={kaggleUrl}
          onChange={(e) => setKaggleUrl(e.target.value)}
          placeholder="https://www.kaggle.com/datasets/... or /competitions/..."
          className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          If provided, backend downloads the dataset from Kaggle and infers samples/features automatically.
        </p>
      </div>

      <div className="rounded-md border border-border bg-background/60 p-3">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Sample CSV Files
        </div>
        <div className="flex flex-col gap-1 break-all font-mono text-[11px]">
          <a className="text-primary hover:underline" href="/samples/customer_churn_small.csv" target="_blank" rel="noreferrer">
            customer_churn_small.csv
          </a>
          <a className="text-primary hover:underline" href="/samples/credit_risk_small.csv" target="_blank" rel="noreferrer">
            credit_risk_small.csv
          </a>
        </div>
      </div>

      {/* Train/test split info */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${trainSplit * 100}%` }} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
          {Math.round(trainSplit * 100)}/{Math.round((1 - trainSplit) * 100)} split
        </span>
      </div>
      <input
        type="range"
        min={0.6}
        max={0.9}
        step={0.05}
        value={trainSplit}
        onChange={(e) => setTrainSplit(parseFloat(e.target.value))}
        className="w-full accent-[hsl(187,80%,53%)]"
      />

      {/* Compare button */}
      <button
        onClick={() =>
          onCompare(
            {
              dataSize: samples,
              features,
              format,
              datasetName: fileName,
              kaggleUrl: kaggleUrl.trim() || null,
              modelAType,
              modelBType,
              trainSplit,
              metadataMode,
              manualClasses: parsedClasses,
            },
            selectedFile,
          )
        }
        disabled={loading}
        className="w-full py-3 rounded-md font-mono text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Queueing &amp; Evaluating...
          </>
        ) : (
          "Compare Models"
        )}
      </button>
    </div>
  );
}
