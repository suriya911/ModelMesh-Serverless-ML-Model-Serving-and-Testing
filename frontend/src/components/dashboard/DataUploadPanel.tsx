import { useState, useRef } from "react";
import { Upload, FileText, Table2, Loader2 } from "lucide-react";

interface Props {
  onCompare: (dataSize: number, features: number, format: string, datasetName?: string | null) => void;
  loading: boolean;
}

const DATA_FORMATS = [
  { value: "csv", label: "CSV", desc: "Comma-separated values" },
  { value: "json", label: "JSON", desc: "Structured JSON array" },
  { value: "parquet", label: "Parquet", desc: "Columnar binary format" },
  { value: "tsv", label: "TSV", desc: "Tab-separated values" },
];

export default function DataUploadPanel({ onCompare, loading }: Props) {
  const [format, setFormat] = useState("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [samples, setSamples] = useState(1000);
  const [features, setFeatures] = useState(8);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      // Detect format from extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && DATA_FORMATS.some(f => f.value === ext)) {
        setFormat(ext);
      }
    }
  };

  return (
    <div className="bg-card border border-border rounded-md p-5 space-y-5">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Upload size={14} className="text-primary" />
        Upload &amp; Configure Data
      </h3>

      {/* File upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors group"
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
        <div className="grid grid-cols-2 gap-2">
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

      {/* Dataset params */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
            Samples
          </label>
          <input
            type="number"
            value={samples}
            onChange={(e) => setSamples(Math.max(100, parseInt(e.target.value) || 100))}
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
            className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Train/test split info */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: '80%' }} />
        </div>
        <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
          80/20 split
        </span>
      </div>

      {/* Compare button */}
      <button
        onClick={() => onCompare(samples, features, format, fileName)}
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
