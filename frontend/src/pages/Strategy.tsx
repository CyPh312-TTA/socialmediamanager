import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Calendar,
  Hash,
  TrendingUp,
  Lightbulb,
  Loader2,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  generateStrategy,
  type StrategyQuestionnaire,
  type StrategyResponse,
  type ContentPillar,
  type WeeklySlot,
} from '../api/strategy';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOAL_OPTIONS = [
  'Brand Awareness',
  'Lead Generation',
  'Sales',
  'Community Building',
  'Thought Leadership',
  'Traffic',
] as const;

const PLATFORM_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'instagram', label: 'Instagram', color: '#e4405f' },
  { key: 'facebook', label: 'Facebook', color: '#1877f2' },
  { key: 'twitter', label: 'Twitter', color: '#1da1f2' },
  { key: 'tiktok', label: 'TikTok', color: '#000000' },
];

const TONE_OPTIONS = ['Professional', 'Casual', 'Funny', 'Inspirational', 'Educational'] as const;

const FREQUENCY_OPTIONS = ['Daily', '3-5x/week', 'Weekly', 'Multiple daily'] as const;

const PILLAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
];

const STEP_LABELS = ['Business Info', 'Platforms & Tone', 'Content Pillars', 'Your Strategy'];
const TOTAL_STEPS = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  business_type: string;
  target_audience: string;
  goals: string[];
  platforms: string[];
  tone: string;
  posting_frequency: string;
  content_pillars: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStep1Valid(form: FormData): boolean {
  return form.business_type.trim().length > 0 && form.target_audience.trim().length > 0 && form.goals.length > 0;
}

function isStep2Valid(form: FormData): boolean {
  return form.platforms.length > 0 && form.tone.length > 0 && form.posting_frequency.length > 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({ step }: { step: number }) {
  const pct = ((step) / (TOTAL_STEPS - 1)) * 100;
  return (
    <div className="mb-8">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step
                  ? 'bg-blue-600 text-white'
                  : i === step
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                i <= step ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
      {/* Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ChipMultiSelect({
  options,
  selected,
  onChange,
  renderOption,
}: {
  options: readonly string[] | string[];
  selected: string[];
  onChange: (next: string[]) => void;
  renderOption?: (option: string, isSelected: boolean) => React.ReactNode;
}) {
  const toggle = (option: string) => {
    onChange(
      selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        if (renderOption) {
          return (
            <button key={option} type="button" onClick={() => toggle(option)}>
              {renderOption(option, isSelected)}
            </button>
          );
        }
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function PlatformChipSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(
      selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORM_OPTIONS.map((p) => {
        const isSelected = selected.includes(p.key);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => toggle(p.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              isSelected
                ? 'text-white border-transparent'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
            style={isSelected ? { backgroundColor: p.color, borderColor: p.color } : undefined}
          >
            <span
              className={`w-3 h-3 rounded-full ${isSelected ? 'bg-white/40' : ''}`}
              style={!isSelected ? { backgroundColor: p.color } : undefined}
            />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function Step1BusinessInfo({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Business / Niche Type <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. E-commerce fashion brand, SaaS startup, Fitness coach..."
          value={form.business_type}
          onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Target Audience <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Women aged 25-40 interested in sustainable fashion..."
          value={form.target_audience}
          onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Goals <span className="text-red-500">*</span>
        </label>
        <ChipMultiSelect
          options={GOAL_OPTIONS}
          selected={form.goals}
          onChange={(goals) => setForm((f) => ({ ...f, goals }))}
        />
        {form.goals.length === 0 && (
          <p className="mt-1.5 text-xs text-gray-400">Select at least one goal.</p>
        )}
      </div>
    </div>
  );
}

function Step2PlatformsTone({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Platforms <span className="text-red-500">*</span>
        </label>
        <PlatformChipSelect
          selected={form.platforms}
          onChange={(platforms) => setForm((f) => ({ ...f, platforms }))}
        />
        {form.platforms.length === 0 && (
          <p className="mt-1.5 text-xs text-gray-400">Select at least one platform.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Tone / Voice <span className="text-red-500">*</span>
        </label>
        <SelectDropdown
          options={TONE_OPTIONS}
          value={form.tone}
          onChange={(tone) => setForm((f) => ({ ...f, tone }))}
          placeholder="Choose a tone..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Posting Frequency <span className="text-red-500">*</span>
        </label>
        <SelectDropdown
          options={FREQUENCY_OPTIONS}
          value={form.posting_frequency}
          onChange={(posting_frequency) => setForm((f) => ({ ...f, posting_frequency }))}
          placeholder="How often do you post?"
        />
      </div>
    </div>
  );
}

function Step3ContentPillars({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const [newPillar, setNewPillar] = useState('');

  const addPillar = () => {
    const trimmed = newPillar.trim();
    if (!trimmed || form.content_pillars.includes(trimmed)) return;
    setForm((f) => ({ ...f, content_pillars: [...f.content_pillars, trimmed] }));
    setNewPillar('');
  };

  const removePillar = (pillar: string) => {
    setForm((f) => ({
      ...f,
      content_pillars: f.content_pillars.filter((p) => p !== pillar),
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Content Pillars</label>
        <p className="text-xs text-gray-400 mb-3">
          Add your own content pillars or leave blank to let AI suggest them for you.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="e.g. Behind the scenes, Tips & tricks, Customer stories..."
            value={newPillar}
            onChange={(e) => setNewPillar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPillar();
              }
            }}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addPillar}
            disabled={!newPillar.trim()}
            className="px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {form.content_pillars.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {form.content_pillars.map((pillar, i) => (
              <span
                key={pillar}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white ${PILLAR_COLORS[i % PILLAR_COLORS.length]}`}
              >
                {pillar}
                <button
                  type="button"
                  onClick={() => removePillar(pillar)}
                  className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
            <Sparkles size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">
              No pillars added. AI will generate optimal content pillars for your business.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results components
// ---------------------------------------------------------------------------

function PillarBar({ pillars }: { pillars: ContentPillar[] }) {
  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-4">
        {pillars.map((p, i) => (
          <div
            key={p.name}
            className={`${PILLAR_COLORS[i % PILLAR_COLORS.length]} transition-all`}
            style={{ width: `${p.percentage}%` }}
            title={`${p.name}: ${p.percentage}%`}
          />
        ))}
      </div>

      {/* Legend + details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pillars.map((p, i) => (
          <div key={p.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <span
              className={`w-3 h-3 mt-0.5 rounded-full flex-shrink-0 ${PILLAR_COLORS[i % PILLAR_COLORS.length]}`}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-400">{p.percentage}%</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
              {p.sample_topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.sample_topics.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function WeeklyScheduleGrid({ schedule }: { schedule: WeeklySlot[] }) {
  const grouped = DAY_ORDER.reduce<Record<string, WeeklySlot[]>>((acc, day) => {
    acc[day] = schedule.filter((s) => s.day_of_week === day);
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {DAY_ORDER.map((day) => (
          <div key={day}>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">
              {day.slice(0, 3)}
            </div>
            <div className="space-y-1.5">
              {grouped[day].length > 0 ? (
                grouped[day].map((slot, i) => (
                  <div
                    key={`${day}-${i}`}
                    className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center"
                  >
                    <p className="text-[10px] text-blue-500 font-medium">{slot.time}</p>
                    <p className="text-xs font-semibold text-gray-800 mt-0.5 truncate">
                      {slot.pillar}
                    </p>
                    <p className="text-[10px] text-gray-500">{slot.post_type}</p>
                  </div>
                ))
              ) : (
                <div className="h-16 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                  <span className="text-[10px] text-gray-300">Rest</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostIdeasSection({ ideas }: { ideas: Record<string, unknown>[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {ideas.map((idea, idx) => {
        const title = (idea.title as string) || (idea.caption as string) || `Idea ${idx + 1}`;
        const isOpen = expandedIdx === idx;
        return (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedIdx(isOpen ? null : idx)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Lightbulb size={16} className="text-yellow-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
              </div>
              {isOpen ? (
                <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-3 border-t border-gray-100">
                <dl className="mt-2 space-y-1.5 text-sm">
                  {Object.entries(idea).map(([key, val]) => {
                    if (key === 'title') return null;
                    const display =
                      Array.isArray(val) ? (val as string[]).join(', ') : String(val ?? '');
                    return (
                      <div key={key} className="flex gap-2">
                        <dt className="text-gray-400 capitalize flex-shrink-0 w-24">{key.replace(/_/g, ' ')}:</dt>
                        <dd className="text-gray-700">{display}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HashtagSection({ hashtags }: { hashtags: Record<string, string[]> }) {
  return (
    <div className="space-y-4">
      {Object.entries(hashtags).map(([platform, tags]) => {
        const platformMeta = PLATFORM_OPTIONS.find((p) => p.key === platform);
        return (
          <div key={platform}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: platformMeta?.color ?? '#6b7280' }}
              />
              <span className="text-sm font-semibold text-gray-900 capitalize">{platform}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                >
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GrowthTacticsList({ tactics }: { tactics: string[] }) {
  return (
    <ul className="space-y-2">
      {tactics.map((tactic, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
          <TrendingUp size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
          <span>{tactic}</span>
        </li>
      ))}
    </ul>
  );
}

function Step4Results({ strategy }: { strategy: StrategyResponse }) {
  return (
    <div className="space-y-8">
      {/* Pillars */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Content Pillars</h2>
        </div>
        <PillarBar pillars={strategy.pillars} />
      </section>

      {/* Weekly schedule */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
        </div>
        <WeeklyScheduleGrid schedule={strategy.weekly_schedule} />
      </section>

      {/* Post ideas */}
      {strategy.post_ideas.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={20} className="text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900">Post Ideas</h2>
          </div>
          <PostIdeasSection ideas={strategy.post_ideas} />
        </section>
      )}

      {/* Hashtag strategy */}
      {Object.keys(strategy.hashtag_strategy).length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Hash size={20} className="text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900">Hashtag Strategy</h2>
          </div>
          <HashtagSection hashtags={strategy.hashtag_strategy} />
        </section>
      )}

      {/* Growth tactics */}
      {strategy.growth_tactics.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">Growth Tactics</h2>
          </div>
          <GrowthTacticsList tactics={strategy.growth_tactics} />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------

function GeneratingOverlay() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="relative mb-6">
        <Loader2 size={48} className="text-blue-600 animate-spin" />
        <Sparkles size={20} className="text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Generating your strategy</h3>
      <p className="text-sm text-gray-500 max-w-sm text-center">
        Our AI is analyzing your inputs and crafting a personalized content strategy. This may take a
        moment...
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Strategy() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    business_type: '',
    target_audience: '',
    goals: [],
    platforms: [],
    tone: '',
    posting_frequency: '',
    content_pillars: [],
  });
  const [result, setResult] = useState<StrategyResponse | null>(null);

  const strategyMutation = useMutation({
    mutationFn: generateStrategy,
    onSuccess: (data) => {
      setResult(data);
      setStep(3);
    },
  });

  const canGoNext = (): boolean => {
    if (step === 0) return isStep1Valid(form);
    if (step === 1) return isStep2Valid(form);
    if (step === 2) return true; // pillars are optional
    return false;
  };

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => s + 1);
    } else if (step === 2) {
      // Submit to AI
      const questionnaire: StrategyQuestionnaire = {
        business_type: form.business_type,
        target_audience: form.target_audience,
        goals: form.goals,
        platforms: form.platforms,
        tone: form.tone,
        posting_frequency: form.posting_frequency,
        ...(form.content_pillars.length > 0 && { content_pillars: form.content_pillars }),
      };
      strategyMutation.mutate(questionnaire);
    }
  };

  const handleBack = () => {
    if (step > 0 && step < 3) setStep((s) => s - 1);
  };

  const handleStartOver = () => {
    setStep(0);
    setForm({
      business_type: '',
      target_audience: '',
      goals: [],
      platforms: [],
      tone: '',
      posting_frequency: '',
      content_pillars: [],
    });
    setResult(null);
    strategyMutation.reset();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={24} className="text-blue-600" />
            AI Strategy Copilot
          </h1>
          <p className="text-gray-500 mt-1">
            {step < 3
              ? 'Answer a few questions and get a personalized content strategy powered by AI.'
              : 'Your personalized content strategy is ready.'}
          </p>
        </div>
        {step === 3 && result && (
          <button
            type="button"
            onClick={handleStartOver}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Start Over
          </button>
        )}
      </div>

      {/* Progress bar */}
      <ProgressBar step={step} />

      {/* Step content */}
      {strategyMutation.isPending ? (
        <GeneratingOverlay />
      ) : step === 3 && result ? (
        <Step4Results strategy={result} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Step title */}
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{STEP_LABELS[step]}</h2>

          {step === 0 && <Step1BusinessInfo form={form} setForm={setForm} />}
          {step === 1 && <Step2PlatformsTone form={form} setForm={setForm} />}
          {step === 2 && <Step3ContentPillars form={form} setForm={setForm} />}

          {/* Error state */}
          {strategyMutation.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Something went wrong generating your strategy. Please try again.
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-0 disabled:pointer-events-none transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext() || strategyMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {step === 2 ? (
                <>
                  <Sparkles size={16} />
                  Generate Strategy
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
