import { useState } from "react";
import { predict, type PredictionResult } from "@/lib/ml-api";
import { Loader2 } from "lucide-react";

interface Props {
  onResult: (result: PredictionResult) => void;
}

export default function PredictionPanel({ onResult }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetModel, setTargetModel] = useState<'auto' | 'model_a' | 'model_b'>('auto');
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await predict({
        input: input.trim(),
        model: targetModel === 'auto' ? undefined : targetModel,
      });
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-md p-4 space-y-4">
      <h3 className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
        Inference Input
      </h3>

      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
          Input Data
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text or numerical data for prediction..."
          className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
          Model Routing
        </label>
        <div className="flex gap-2">
          {(['auto', 'model_a', 'model_b'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTargetModel(m)}
              className={`px-3 py-1.5 rounded-md font-mono text-[11px] border transition-colors ${
                targetModel === m
                  ? m === 'model_a'
                    ? 'border-model-a text-model-a bg-model-a/10'
                    : m === 'model_b'
                    ? 'border-model-b text-model-b bg-model-b/10'
                    : 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {m === 'auto' ? 'A/B Auto' : m === 'model_a' ? 'Model A' : 'Model B'}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handlePredict}
        disabled={loading || !input.trim()}
        className="w-full py-2.5 rounded-md font-mono text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Running Inference...
          </>
        ) : (
          "Run Prediction"
        )}
      </button>

      {error && (
        <p className="font-mono text-[10px] text-destructive">{error}</p>
      )}
    </div>
  );
}
