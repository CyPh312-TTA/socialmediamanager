import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Download,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import {
  uploadBulkCSV,
  confirmBulkSchedule,
  downloadTemplate,
} from '../api/bulk';
import type { BulkPreviewEntry, BulkPreviewResponse } from '../api/bulk';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Step = 'upload' | 'preview' | 'results';

interface BulkResults {
  created: number;
  failed: number;
  errors: string[];
}

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'preview', label: 'Preview & Validate' },
  { key: 'results', label: 'Results' },
];

/* ------------------------------------------------------------------ */
/*  Platform badge colours                                             */
/* ------------------------------------------------------------------ */

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  tiktok: 'bg-purple-100 text-purple-700',
  linkedin: 'bg-indigo-100 text-indigo-700',
};

function platformBadgeClass(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-gray-100 text-gray-700';
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function formatScheduleTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BulkSchedule() {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [results, setResults] = useState<BulkResults | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /* ---- mutations ---- */

  const uploadMutation = useMutation({
    mutationFn: uploadBulkCSV,
    onSuccess: (data) => {
      setPreview(data);
      setUploadError(null);
      setStep('preview');
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please check your file and try again.';
      setUploadError(message);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (entries: BulkPreviewEntry[]) => {
      const payload = entries
        .filter((e) => e.is_valid)
        .map((e) => ({
          row_number: e.row_number,
          caption: e.caption,
          platforms: e.platforms,
          schedule_time: e.schedule_time,
        }));
      return confirmBulkSchedule(payload);
    },
    onSuccess: (data) => {
      setResults(data);
      setStep('results');
    },
  });

  /* ---- drag/drop handlers ---- */

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        setUploadError(null);
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setUploadError(null);
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation],
  );

  /* ---- template download ---- */

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'bulk_schedule_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Silently ignore download errors
    }
  }, []);

  /* ---- restart ---- */

  const restart = useCallback(() => {
    setStep('upload');
    setPreview(null);
    setResults(null);
    setUploadError(null);
  }, []);

  /* ---- derived ---- */

  const validCount = preview?.valid_count ?? 0;
  const errorCount = preview?.error_count ?? 0;
  const totalCount = preview?.total_rows ?? 0;

  const hasValidRows = validCount > 0;

  /* ================================================================ */
  /*  Step 1 -- Upload                                                 */
  /* ================================================================ */

  const renderUpload = () => (
    <div className="max-w-2xl mx-auto">
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          id="csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={48} className="text-blue-500 animate-spin" />
            <p className="text-gray-600 font-medium">Uploading and validating...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <Upload size={32} className="text-blue-500" />
            </div>
            <div>
              <p className="text-gray-700 font-medium text-lg">
                Drag & drop your CSV file here
              </p>
              <p className="text-gray-500 text-sm mt-1">or click to browse files</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {uploadError && (
        <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{uploadError}</p>
        </div>
      )}

      {/* Info + template */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Supported format</p>
            <p className="text-sm text-gray-500 mt-1">
              CSV file with columns: <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">caption</code>,{' '}
              <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">platforms</code>{' '}
              (comma-separated),{' '}
              <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">schedule_time</code>{' '}
              (ISO 8601 or YYYY-MM-DD HH:MM).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={16} />
          Download Template
        </button>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Step 2 -- Preview & Validate                                     */
  /* ================================================================ */

  const renderPreview = () => {
    const entries = preview?.entries ?? [];

    return (
      <div>
        {/* Summary stats */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
            <Check size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">
              {validCount} valid
            </span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <X size={16} className="text-red-600" />
              <span className="text-sm font-medium text-red-700">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <span className="text-sm text-gray-500">out of {totalCount} total rows</span>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">Row</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Caption</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Platforms</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Schedule Time</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.row_number}
                    className={`border-b border-gray-100 last:border-b-0 ${
                      !entry.is_valid ? 'bg-red-50' : 'hover:bg-gray-50'
                    }`}
                    title={entry.error ?? undefined}
                  >
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {entry.row_number}
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs">
                      <span title={entry.caption}>{truncate(entry.caption, 60)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {entry.platforms.map((p) => (
                          <span
                            key={p}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${platformBadgeClass(p)}`}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatScheduleTime(entry.schedule_time)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.is_valid ? (
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
                          <Check size={14} className="text-green-600" />
                        </div>
                      ) : (
                        <div
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 cursor-help"
                          title={entry.error ?? 'Validation error'}
                        >
                          <X size={14} className="text-red-600" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Error details */}
        {errorCount > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Row errors</span>
            </div>
            <ul className="space-y-1">
              {entries
                .filter((e) => !e.is_valid)
                .map((e) => (
                  <li key={e.row_number} className="text-sm text-amber-800">
                    <span className="font-medium">Row {e.row_number}:</span>{' '}
                    {e.error ?? 'Unknown error'}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <button
            type="button"
            onClick={() => preview && confirmMutation.mutate(preview.entries)}
            disabled={!hasValidRows || confirmMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                Confirm Schedule
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /*  Step 3 -- Results                                                */
  /* ================================================================ */

  const renderResults = () => {
    if (!results) return null;

    const allSucceeded = results.failed === 0;

    return (
      <div className="max-w-xl mx-auto text-center">
        {/* Success / partial icon */}
        <div
          className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
            allSucceeded ? 'bg-green-100' : 'bg-amber-100'
          }`}
        >
          {allSucceeded ? (
            <Check size={40} className="text-green-600" />
          ) : (
            <AlertTriangle size={40} className="text-amber-600" />
          )}
        </div>

        <h2 className="mt-5 text-xl font-bold text-gray-900">
          {allSucceeded ? 'All Posts Scheduled!' : 'Scheduling Complete'}
        </h2>

        <p className="mt-2 text-gray-600">
          Created <span className="font-semibold text-gray-900">{results.created}</span> post
          {results.created !== 1 ? 's' : ''}
          {results.failed > 0 && (
            <>
              , <span className="font-semibold text-red-600">{results.failed}</span> failed
            </>
          )}
        </p>

        {/* Error list */}
        {results.errors.length > 0 && (
          <div className="mt-6 text-left bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-700">Errors</span>
            </div>
            <ul className="space-y-1">
              {results.errors.map((err, i) => (
                <li key={i} className="text-sm text-red-700">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload size={16} />
            Schedule More
          </button>
          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Calendar size={16} />
            View Calendar
          </Link>
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /*  Step indicator                                                   */
  /* ================================================================ */

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  const renderStepIndicator = useMemo(
    () => (
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${
                    isComplete ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    isComplete
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                      ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isComplete ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:inline ${
                    isCurrent ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    ),
    [currentIndex],
  );

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Schedule</h1>
        <p className="text-gray-500 mt-1">
          Upload a CSV file to schedule multiple posts at once.
        </p>
      </div>

      {/* Step indicator */}
      {renderStepIndicator}

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {step === 'upload' && renderUpload()}
        {step === 'preview' && renderPreview()}
        {step === 'results' && renderResults()}
      </div>
    </div>
  );
}
