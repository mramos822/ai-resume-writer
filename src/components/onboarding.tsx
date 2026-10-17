// src/components/onboarding.tsx
"use client";

import { dndAccessibility } from "@/i18n/dnd";
import LanguageSwitch from "@/components/languageSwitch";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { createPortal } from "react-dom";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileUp,
  Loader2,
  Plus,
  Briefcase,
  Eye,
  GraduationCap,
  GripVertical,
  Layers,
  Target,
  UserRound,
  Wrench,
  ChevronsDownUp,
  Download,
  ChevronsUpDown,
  Palette,
  PenLine,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/context/authContext";
import { useProfile } from "@/context/profileContext";
import { useTheme } from "@/context/themeContext";
import { useToast } from "@/context/toastContext";
import { db } from "@/lib/firebase";
import { authFetch } from "@/lib/authFetch";
import { getProfileProgress } from "@/lib/profileProgress";
import TemplateSelector from "@/components/templateSelector";
import ResumePreviewModal from "@/components/resumePreviewModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PickSelect from "@/components/pickSelect";
import { loadGeo, regionLabel, type Geo } from "@/lib/geo";
import "flag-icons/css/flag-icons.min.css";
import JobTitleInput from "@/components/jobTitleInput";
import SuggestInput from "@/components/suggestInput";
import { DEGREES } from "@/lib/schools";
import { allSchools, countryOfSchool, placeOfSchool, schoolsOf } from "@/lib/worldSchools";
import { schoolTerms } from "@/lib/schoolTerms";
import SkillInput from "@/components/skillInput";
import ExtrasEditor from "@/components/extrasEditor";
import SkillLevelPicker from "@/components/skillLevelPicker";
import Link from "@/i18n/navigation";
import { loadTemplates } from "@/lib/templatePreload";
import { ThemeSwitch } from "@/components/themeSwitch";
import { previewFromProfile, realName } from "@/lib/previewData";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { US_STATES, fullState, placeLine } from "@/lib/place";
import ResumeReview, { forgetReview } from "@/components/resumeReview";
import { dedupeProfile } from "@/lib/resumeReview";
import { normalizeBullets } from "@/lib/bullets";
import type { SkillLevels } from "@/lib/skillLevels";
import { cleanSkillGroups, type SkillGroups } from "@/lib/skillGroups";
import SkillGroupsEditor from "@/components/skillGroupsEditor";
import AccentPicker from "@/components/accentPicker";
import type { LanguageEntry } from "@/lib/languages";
import MonthPicker from "@/components/monthPicker";
import { useTranslationOffer } from "@/components/useTranslationOffer";
import JobDescriptionEditor from "@/components/jobDescriptionEditor";
import { toBullets } from "@/lib/bullets";
import { formatPeriod } from "@/lib/dateFormat";
import PhotoPicker from "@/components/photoPicker";
import KaizoLogo from "@/components/kaizoLogo";
import { isTemplateId } from "@/lib/templates";
import SignupGate from "@/components/signupGate";
import { formatPhoneInput, phoneExample } from "@/lib/phone";
import LivePreview, { type PreviewData, type PreviewSection } from "@/components/livePreview";
import { useT, useLocale } from "@/i18n/provider";
import PageLengthPicker from "@/components/pageLengthPicker";
import { asPageGoal, type PageGoal } from "@/lib/pageGoal";
import { countryNamer } from "@/i18n/places";


export const ONBOARDING_KEY = "kaizo_onboarding_done";
export const TEMPLATE_KEY = "kaizo_template";
export const ACCENT_KEY = "kaizo_accent";
const TOUR_KEY = "kaizo_tour_done";
export const DRAFT_KEY = "kaizo_onboarding_draft";

interface JobDraft {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

const blankJob = (): JobDraft => ({
  id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
});

interface EduDraft {
  id: string;
  school: string;
  /** country the school suggestions come from: an ISO code, "ALL" for every country, "" = the country of the person */
  schoolCountry: string;
  degree: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  gpa: string;
  honors: string;
  coursework: string;
}

/** Countries where degrees are written in English. */
const ENGLISH_COUNTRIES = ["US", "GB", "IE", "CA", "AU", "NZ", "SG", "IN", "ZA", "NG", "KE", "GH", "PH"];

const blankEdu = (): EduDraft => ({
  id: `edu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  school: "",
  schoolCountry: "",
  degree: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  gpa: "",
  honors: "",
  coursework: "",
});

/** Everything typed in the wizard, so a reload doesn't lose progress. */
interface Draft {
  /** when it was last written (shown when the person comes back) */
  savedAt?: number;
  step: Step;
  flow: "scratch" | "upload";
  customize: boolean;
  name: string;
  photo: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  jobTitle: string;
  objective: string;
  skills: string[];
  languages?: LanguageEntry[];
  skillLevels?: SkillLevels;
  skillGroups?: SkillGroups;
  accent?: string;
  skillDraft: string;
  jobs: JobDraft[];
  /** older drafts stored a single job */
  job?: Omit<JobDraft, "id">;
  edus: EduDraft[];
  /** older drafts stored a single school */
  edu?: Omit<EduDraft, "id">;
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

type Step = "template" | "length" | "path" | "upload" | "found" | "contact" | "about" | "skills" | "job" | "education" | "extras" | "finish";

// Order of the "from scratch" path, used for the progress bar
const SCRATCH: Step[] = ["template", "length", "path", "contact", "about", "skills", "job", "education", "extras", "finish"];
const UPLOAD: Step[] = ["template", "length", "path", "upload", "found", "contact", "about", "skills", "job", "education", "extras", "finish"];

function remember(key: string, value = "1") {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const { tr } = useT();
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{tr(label)}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{tr(hint)}</span>}
    </label>
  );
}

/** Main action button: ink pill with a blue arrow chip that floods the whole button on hover. */
function ContinueButton({ onClick, disabled, label = "Continue" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  const { tr } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex h-14 items-center overflow-hidden rounded-full bg-foreground pl-8 pr-2 text-base font-semibold text-background shadow-[0_8px_0_-4px_rgba(37,99,235,0.55)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:pointer-events-none disabled:opacity-40"
    >
      <span
        aria-hidden
        className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-blue-600 transition-transform duration-500 ease-out group-hover:scale-[9]"
      />
      <span className="relative z-10 pr-7 transition-colors duration-300 group-hover:text-white">{tr(label)}</span>
      <span className="relative z-10 flex h-10 w-10 items-center justify-center text-white">
        <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </button>
  );
}

/** iPhone-style light / dark switch. */

/** On the final screen each step form is shown in full, all at once, under its own title; in the normal steps it adds nothing. */
/** Which sections of the final screen are folded away, shared by every Block and the expand / collapse buttons. */
const BlocksContext = React.createContext<{ closed: string[]; toggle: (title: string) => void }>({ closed: [], toggle: () => {} });
const SECTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  contact: { icon: UserRound, hint: "Name, photo, email, phone and address" },
  about: { icon: Target, hint: "The job you want and your summary" },
  skills: { icon: Wrench, hint: "What you are good at" },
  job: { icon: Briefcase, hint: "Your work history, newest first" },
  education: { icon: GraduationCap, hint: "Schools, degrees and studies" },
  extras: { icon: Layers, hint: "Links, projects, certifications and languages" },
};
const BLOCK_TITLES = ["Contact info and photo", "Job you want and summary", "Skills", "Professional experience", "Education", "More to add (optional)"];

function Block({ reviewing, title, children, id }: { reviewing: boolean; title: string; children: React.ReactNode; id: string }) {
  if (!reviewing) return <>{children}</>;
  // "Contact info and photo" and "Job you want and summary" always stay at the top; the others can be moved
  if (FIXED_SECTIONS.includes(id)) return <SectionView id={id} title={title}>{children}</SectionView>;
  return <SortableSection id={id} title={title}>{children}</SortableSection>;
}

const FIXED_SECTIONS = ["contact", "about"];

/** A section of the final screen that can be dragged by its handle to a new place in the list. */
function SortableSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { tr } = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <SectionView
      id={id}
      title={title}
      sectionRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
      dragging={isDragging}
      grip={
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={tr("Move {title}", { title })}
          title={tr("Drag to move this section")}
          className="flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      }
    >
      {children}
    </SectionView>
  );
}

/** The look of a section of the final screen: icon, title, hint and a fold button; `grip` is the drag handle when it can move. */
function SectionView({
  id,
  title,
  children,
  grip,
  sectionRef,
  style,
  dragging,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  grip?: React.ReactNode;
  sectionRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragging?: boolean;
}) {
  const { tr } = useT();
  const { closed, toggle } = React.useContext(BlocksContext);
  const isOpen = !closed.includes(title);
  const meta = SECTION_META[id] ?? SECTION_META.extras;
  const Icon = meta.icon;
  return (
    <section
      ref={sectionRef}
      data-block={title}
      style={style}
      className={`rounded-xl border bg-card lg:col-start-1 ${dragging ? "shadow-2xl ring-2 ring-blue-500/40" : ""}`}
    >
      <div className={`flex items-center gap-1 rounded-xl border-l-4 ${grip ? "pl-1.5" : "pl-4"} pr-4 transition-colors duration-300 ${isOpen ? "border-blue-600" : "border-transparent"}`}>
        {grip}
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggle(title)}
          className="group flex min-w-0 flex-1 items-center gap-3.5 py-3.5 pl-1 text-left"
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
              isOpen ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" : "bg-blue-600/10 text-blue-600 group-hover:bg-blue-600/20"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-tight">{tr(title)}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{tr(meta.hint)}</span>
          </span>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-hover:border-blue-500/50 ${
              isOpen ? "rotate-180 bg-muted" : ""
            }`}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5 [&>h1]:hidden [&>h1+p]:hidden [&>h1+p+*]:mt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function Onboarding({ embedded = false }: { embedded?: boolean } = {}) {
  const { tr, trd } = useT();
  const router = useRouter();
  // "Make a resume" (the Resumes section) uses the same builder: every detail on the left, the live preview on the right
  const pathname = usePathname();
  const buildMode = embedded;
  // the layout's full-screen wizard stays closed on that page: the embedded one is shown there instead
  const onBuildPath = pathname === "/home/resumes/new" && !embedded;
  const buildOpened = useRef(false);
  // warm up the "Pick a look" sheets as soon as the builder exists
  useEffect(() => {
    loadTemplates().catch(() => {});
  }, []);
  const { setTheme } = useTheme();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const { user } = useAuth();
  // Guests (no account yet) only get the resume builder: the dashboard stays locked until they have an account
  const isGuest = Boolean(user?.uid.startsWith("guest-"));
  const [gateOpen, setGateOpen] = useState(false);
  const [gateQuick, setGateQuick] = useState(false); // opened from "this email already has an account": only a log in
  const [loggedInHere, setLoggedInHere] = useState(false); // logged in from the builder: downloading takes them to their resumes
  const toast = useToast();
  const offerTranslation = useTranslationOffer();
  const {
    profiles,
    activeProfileId,
    activeProfile: profile,
    parseFile,
    applyProfileData,
    saveChanges,
    setActiveProfileId,
    updateName,
    updateJobTitle,
    updatePhoto,
    updateContactInfo,
    updateCareerObjective,
    updateSkills,
    updateLanguages,
    updateSkillLevels,
    updateSkillGroups,
    updateAccentColor,
    updateFillPage,
    updatePageGoal,
    updateSectionOrder,
    setJobHistory,
    deleteJobEntry,
    setEducation,
    deleteEducationEntry,
  } = useProfile();

  const [open, setOpen] = useState(false);
  const [closedBlocks, setClosedBlocks] = useState<string[]>([]); // folded sections of the final screen
  // the order of the sections on the final screen, chosen by the person and remembered
  const [blockOrder, setBlockOrder] = useState<string[]>(["contact", "about", "skills", "job", "education", "extras"]);
  const [orderTouched, setOrderTouched] = useState(false); // false = every look keeps its own default order of sections
  const sectionSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onSectionDrag = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(blockOrder, blockOrder.indexOf(String(active.id)), blockOrder.indexOf(String(over.id)));
    setBlockOrder(next);
    setOrderTouched(true);
    // the resume (preview and PDF) follows this order: it is saved with the profile
    updateSectionOrder(["about", ...next.filter((x) => !FIXED_SECTIONS.includes(x))]);
    setSaveTick((t) => t + 1);
  };
  // Embedded in the dashboard: its two modes and the main button live in the middle of the top bar
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!embedded) return;
    setTopSlot(document.getElementById("topbar-center"));
  }, [embedded, open]);
  const [showPreview, setShowPreview] = useState(false); // the right side shows the big live preview instead of the AI review
  // The entrance (after opening or reloading the page): the wizard fades in, the form's pieces rise one after another and
  // the live preview slides in from the side. It only plays once; moving between steps keeps the quick pop.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setIntro(false), 1500);
    return () => clearTimeout(t);
  }, [open]);
  const [step, setStep] = useState<Step>("template");
  const [flow, setFlow] = useState<"scratch" | "upload">("scratch");
  const [template, setTemplate] = useState("");
  const [accent, setAccent] = useState(""); // id of the color of the look ("" = the look's own)
  const [fillPage, setFillPage] = useState(false); // grow the text to fill the page when there is little content
  const [pageGoal, setPageGoal] = useState<PageGoal>("one"); // how long the person wants the resume
  const pageGoalRef = useRef<PageGoal>("one"); // read inside async code (the upload), where the state would be stale
  pageGoalRef.current = pageGoal;
  const [customize, setCustomize] = useState(false);

  // form state for the "from scratch" path
  // The name is written as first and last name; the rest of the app keeps using the full name
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  // a guest typing an email that already has an account is told, so they log in instead of making another account
  const [emailTaken, setEmailTaken] = useState(false);
  const setName = (full: string) => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      setFirstName(parts[0] ?? "");
      setLastName("");
    } else {
      setFirstName(parts.slice(0, -1).join(" "));
      setLastName(parts[parts.length - 1]);
    }
  };
  const [photo, setPhoto] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  // the country decides which regions (states, provinces, departments...) and which phone format apply
  const [country, setCountry] = useState("United States");
  const [countryCode, setCountryCode] = useState("US");
  const [geo, setGeo] = useState<Geo | null>(null);
  const locale = useLocale();
  const countryShown = React.useMemo(() => countryNamer(locale, geo?.countries), [locale, geo]);
  useEffect(() => {
    loadGeo().then(setGeo).catch(() => {});
  }, []);
  const regions = geo ? geo.regionsOf(countryCode) : countryCode === "US" ? US_STATES : [];
  const [jobTitle, setJobTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [skillLevels, setSkillLevels] = useState<SkillLevels>({});
  const [skillGroups, setSkillGroups] = useState<SkillGroups>({});
  const [skillDraft, setSkillDraft] = useState("");
  const [jobs, setJobs] = useState<JobDraft[]>(() => [blankJob()]);
  const [openJobId, setOpenJobId] = useState(""); // "" = the first job, "none" = all collapsed
  const patchJob = (id: string, patch: Partial<JobDraft>) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const [edus, setEdus] = useState<EduDraft[]>(() => [blankEdu()]);
  const [openEduId, setOpenEduId] = useState(""); // "" = the first school, "none" = all collapsed
  const [eduClosed, setEduClosed] = useState<string[]>([]); // on the final screen every school is open unless it was folded
  const [extrasOpen, setExtrasOpen] = useState<Record<string, boolean>>({});
  // a school of the catalog brings its place ("Newark, NJ", "Lima, Peru"): it replaces whatever the location said, because the
  // school was just changed. A school that is not in the catalog leaves the location alone.
  // the country whose universities are suggested for a school (the person's own country until they say another)
  const ALL_COUNTRIES = "All countries";
  const eduCountryName = (sc: string) => (sc === "ALL" ? ALL_COUNTRIES : geo?.countries.find((x) => x.isoCode === (sc || countryCode))?.name ?? country);
  const schoolOptions = (sc: string) => (sc === "ALL" ? allSchools() : schoolsOf(sc || countryCode));
  // a school of an English-speaking country gives its degree in English, even when the site is in Spanish (it can be changed by hand)
  const englishSchool = (e: EduDraft) => ENGLISH_COUNTRIES.includes(countryOfSchool(e.school) || (e.schoolCountry === "ALL" ? "" : e.schoolCountry || countryCode));
  const patchEdu = (id: string, patch: Partial<EduDraft>) =>
    setEdus((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        if (patch.school !== undefined && patch.school !== e.school) {
          const place = placeOfSchool(patch.school);
          if (place) {
            next.location = place;
            // a school of another country than the filter moves the filter to its country
            const c = countryOfSchool(patch.school);
            if (c && next.schoolCountry !== "ALL" && c !== (next.schoolCountry || countryCode)) next.schoolCountry = c;
          }
        }
        return next;
      })
    );

  const [working, setWorking] = useState(false);
  const [fileName, setFileName] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null);
  const [reviewReady, setReviewReady] = useState(false);
  const rehydrate = useRef(false);
  const syncing = useRef(false);
  // What the forms looked like right after loading from the profile. Nothing is written back until they differ from it.
  const baseline = useRef<string | null>(null);

  // Build mode: opens straight on the details + live preview screen, and closes when the person leaves that page
  useEffect(() => {
    if (buildMode) {
      if (buildOpened.current || profiles.length === 0 || !activeProfileId) return;
      buildOpened.current = true;
      setFlow("scratch");
      setCustomize(false);
      setStep("finish");
      setShowPreview(true);
      try {
        const t = localStorage.getItem("kaizo_template");
        if (isTemplateId(t)) setTemplate(t);
        setAccent(localStorage.getItem(ACCENT_KEY) ?? "");
      } catch {
        /* ignore */
      }
      setOpen(true);
    } else if (buildOpened.current) {
      buildOpened.current = false;
      setOpen(false);
      setStep("template");
      setReviewReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildMode, profiles.length, activeProfileId]);

  // Show only to people who haven't set anything up yet
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current || profiles.length === 0 || !activeProfileId) return;
    decided.current = true;
    if (buildMode || onBuildPath) return;
    const restore = () => {
      const d = readDraft();
      if (!d) return;
      setStep(d.step);
      setFlow(d.flow);
      setCustomize(Boolean(d.customize));
      setName(d.name);
      setPhoto(d.photo);
      setEmail(d.email);
      setPhone(d.phone);
      setAddress(d.address);
      setCity(d.city ?? "");
      setState(d.state ?? "");
      setCountry(d.country || "United States");
      setCountryCode(d.countryCode || "US");
      setJobTitle(d.jobTitle);
      setObjective(d.objective);
      setSkills(d.skills ?? []);
      setLanguages(d.languages ?? []);
      setSkillLevels(d.skillLevels ?? {});
      setSkillGroups(d.skillGroups ?? {});
      setAccent(d.accent ?? "");
      setSkillDraft(d.skillDraft ?? "");
      const restored = d.jobs?.length ? d.jobs.map((j) => ({ ...blankJob(), ...j })) : d.job ? [{ ...blankJob(), ...d.job }] : [blankJob()];
      setJobs(restored);
      setOpenJobId(restored[0].id);
      const restoredEdus = d.edus?.length ? d.edus.map((e) => ({ ...blankEdu(), ...e })) : d.edu ? [{ ...blankEdu(), ...d.edu }] : [blankEdu()];
      setEdus(restoredEdus);
      setOpenEduId(restoredEdus[0].id);
    };
    // /home?onboarding=1 reopens the wizard on demand
    if (new URLSearchParams(window.location.search).get("onboarding") === "1") {
      restore();
      setOpen(true);
      return;
    }
    if (isGuest) {
      // a guest always lands in the step-by-step builder, as if it were new (or resumes their saved draft)
      if (readDraft()) restore();
      setOpen(true);
      return;
    }
    try {
      if (localStorage.getItem(ONBOARDING_KEY)) return;
    } catch {
      return;
    }
    // a saved draft means the person was in the middle of it, even if the profile already has some data
    if (readDraft()) {
      restore();
      setOpen(true);
    } else if (getProfileProgress(profile).doneCount === 0) setOpen(true);
    else remember(ONBOARDING_KEY);
  }, [profiles.length, activeProfileId, profile, isGuest, buildMode, onBuildPath]);

  /** Loads everything saved in the profile into the wizard forms. */
  const hydrate = (src: typeof profile) => {
    baseline.current = null; // the next render holds the loaded values: take them as the baseline
    setName(realName(src.name));
    if (src.sectionOrder?.length) {
      const base = ["skills", "job", "education", "extras"];
      setBlockOrder(["contact", "about", ...src.sectionOrder.filter((x) => base.includes(x)), ...base.filter((x) => !src.sectionOrder!.includes(x))]);
      setOrderTouched(true);
    }
    setPhoto(src.photo || "");
    setEmail(src.contactInfo?.email || "");
    setPhone(src.contactInfo?.phone || "");
    setAddress(src.contactInfo?.address || "");
    setCity(src.contactInfo?.city || "");
    const cc = src.contactInfo?.countryCode || "US";
    setCountry(src.contactInfo?.country || "United States");
    setCountryCode(cc);
    setState(cc === "US" ? fullState(src.contactInfo?.state || "") : src.contactInfo?.state || "");
    setJobTitle(src.jobTitle || "");
    setObjective(src.careerObjective || "");
    setSkills(src.skills || []);
    setSkillLevels(src.skillLevels || {});
    setSkillGroups(src.skillGroups || {});
    if (src.accentColor) setAccent(src.accentColor);
    setFillPage(Boolean(src.fillPage));
    setPageGoal(asPageGoal(src.pageGoal));
    setLanguages(src.languages || []);
    const jobDrafts: JobDraft[] = (src.jobHistory || []).map((j) => ({
      id: j.id,
      company: j.company || "",
      title: j.title || "",
      location: j.location || "",
      startDate: j.startDate || "",
      endDate: j.endDate || "",
      current: Boolean(j.current),
      description: normalizeBullets([j.description?.trim(), ...(j.accomplishments || [])].filter(Boolean).join("\n")),
    }));
    setJobs(jobDrafts.length ? jobDrafts : [blankJob()]);
    setOpenJobId("none");
    const eduDrafts: EduDraft[] = (src.education || []).map((e) => ({
      id: e.id,
      school: e.school || "",
      schoolCountry: countryOfSchool(e.school) || "",
      degree: e.degree || "",
      location: e.location || "",
      startDate: e.startDate || "",
      endDate: e.endDate || "",
      current: Boolean(e.current),
      gpa: e.gpa || "",
      honors: e.honors || "",
      coursework: e.coursework || "",
    }));
    setEdus(eduDrafts.length ? eduDrafts : [blankEdu()]);
    setOpenEduId("none");
  };

  const syncSnap = JSON.stringify([name, photo, email, phone, address, city, state, country, countryCode, jobTitle, objective, skills, languages, skillLevels, skillGroups, accent, jobs, edus]);
  // (declared before the effect that loads the forms, so it only ever sees values that were really loaded)
  useEffect(() => {
    if (step === "finish" && syncing.current && baseline.current === null) baseline.current = syncSnap;
  });

  // entering the final screen: remove repeated entries, load the details into the forms, then let the review start
  useEffect(() => {
    if (!open) return;
    if (step !== "finish") {
      syncing.current = false;
      setReviewReady(false);
      return;
    }
    const { patch, removed } = dedupeProfile(profile);
    if (removed > 0) {
      if (patch.jobHistory) setJobHistory(patch.jobHistory);
      if (patch.education) setEducation(patch.education);
      if (patch.skills) updateSkills(patch.skills);
      if (patch.languages) updateLanguages(patch.languages);
      setSaveTick((t) => t + 1);
      toast.info(tr("Removed {removed} repeated {v1} from your resume.", { removed, v1: removed === 1 ? "entry" : "entries" }));
    }
    hydrate({ ...profile, ...patch });
    syncing.current = true;
    setReviewReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open]);

  useEffect(() => {
    const mail = email.trim().toLowerCase();
    if (!isGuest || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setEmailTaken(false);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await authFetch("/api/account-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: mail }) });
        const data = await res.json().catch(() => ({}));
        if (alive) setEmailTaken(Boolean(data.exists));
      } catch {
        if (alive) setEmailTaken(false);
      }
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [email, isGuest]);

  // leaving the final screen (to edit earlier steps) makes the kept review outdated
  useEffect(() => {
    if (step !== "finish") forgetReview();
  }, [step]);

  // the review can change the profile (its "Fix it" buttons): reload the forms from it afterwards
  useEffect(() => {
    if (step === "finish" && rehydrate.current) {
      rehydrate.current = false;
      hydrate(profile);
    }
  });

  // edits made in the forms on the final screen go straight to the profile
  useEffect(() => {
    // never write anything while the forms still match what was loaded: only real edits are saved
    if (step !== "finish" || !syncing.current || baseline.current === null || syncSnap === baseline.current) return;
    const t = setTimeout(() => {
      if (rehydrate.current) return;
      baseline.current = syncSnap;
      updateName(name.trim());
      updateContactInfo({ email: email.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), state: (countryCode === "US" ? fullState(state) : state).trim(), country, countryCode });
      updatePhoto(photo);
      updateJobTitle(jobTitle.trim());
      updateCareerObjective(objective.trim());
      updateSkills(skills);
      updateLanguages(languages);
      updateSkillLevels(Object.fromEntries(Object.entries(skillLevels).filter(([k]) => skills.includes(k))));
      updateSkillGroups(cleanSkillGroups(skills, skillGroups));
      if (accent) updateAccentColor(accent);
      setJobHistory(
        jobs
          .filter((j) => j.title.trim() || j.company.trim())
          .map((j) => ({
            id: j.id,
            title: j.title.trim(),
            company: j.company.trim(),
            location: j.location.trim(),
            description: "",
            startDate: j.startDate,
            endDate: j.current ? "" : j.endDate,
            current: j.current,
            accomplishments: toBullets(j.description),
          }))
      );
      setEducation(
        edus
          .filter((e) => e.school.trim())
          .map((e) => ({
            id: e.id,
            school: e.school.trim(),
            degree: e.degree.trim(),
            location: e.location.trim(),
            startDate: e.startDate,
            endDate: e.current ? "" : e.endDate,
            current: e.current,
            gpa: e.gpa.trim(),
            honors: e.honors.trim(),
            coursework: e.coursework.trim(),
          }))
      );
      setSaveTick((n) => n + 1);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, name, photo, email, phone, address, city, state, country, countryCode, jobTitle, objective, skills, languages, skillLevels, skillGroups, accent, jobs, edus]);

  const extrasSig = JSON.stringify([profile.projects, profile.internships, profile.links, profile.certifications]);
  const extrasBase = useRef<string | null>(null);
  useEffect(() => {
    if (!open || (step !== "extras" && step !== "finish")) {
      extrasBase.current = null;
      return;
    }
    if (extrasBase.current === null) {
      extrasBase.current = extrasSig; // what is already saved: nothing to write
      return;
    }
    if (extrasSig === extrasBase.current) return;
    const t = setTimeout(() => {
      extrasBase.current = extrasSig;
      setSaveTick((n) => n + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [open, step, extrasSig]);

  // saveChanges reads the latest profile, so call it after React applied our updates
  const [saveTick, setSaveTick] = useState(0);
  const saveRef = useRef(saveChanges);
  saveRef.current = saveChanges;
  useEffect(() => {
    if (saveTick > 0) saveRef.current().catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTick]);

  // The page behind must not scroll while the wizard is open, and each new step starts at the top
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || embedded) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open, embedded]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [step, customize]);
  // the two panes of the final screen start at their top (a focused field must not leave the left one scrolled)
  useEffect(() => {
    if (step !== "finish" || !reviewReady) return;
    const t = window.setTimeout(() => scroller.current?.querySelectorAll<HTMLElement>(".no-scrollbar").forEach((el) => (el.scrollTop = 0)), 80);
    return () => window.clearTimeout(t);
  }, [step, reviewReady]);

  useEffect(() => {
    if (!open || buildMode) return;
    const draft: Draft = { savedAt: Date.now(), step, flow, customize, name, photo, email, phone, address, city, state, country, countryCode, jobTitle, objective, skills, languages, skillLevels, skillGroups, accent, skillDraft, jobs, edus };
    // written after a short pause (it includes the photo), so a click or a key never waits for the storage
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* storage full or unavailable: progress just won't survive a reload */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [open, buildMode, step, flow, customize, name, photo, email, phone, address, city, state, country, countryCode, jobTitle, objective, skills, languages, skillLevels, skillGroups, accent, skillDraft, jobs, edus]);

  const close = useCallback(() => {
    remember(ONBOARDING_KEY);
    remember(TOUR_KEY);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  const onTemplate = useCallback((id: string) => {
    setTemplate(id);
    remember(TEMPLATE_KEY, id);
  }, []);
  const onAccent = useCallback((id: string) => {
    setAccent(id);
    remember(ACCENT_KEY, id);
    updateAccentColor(id);
  }, [updateAccentColor]);

  const onGoal = useCallback((goal: PageGoal) => {
    setPageGoal(goal);
    updatePageGoal(goal);
  }, [updatePageGoal]);

  const onFill = useCallback((on: boolean) => {
    setFillPage(on);
    updateFillPage(on);
  }, [updateFillPage]);

  const order = flow === "upload" ? UPLOAD : SCRATCH;
  const pct = Math.max(4, ((order.indexOf(step) + 1) / order.length) * 100);

  const go = (s: Step) => setStep(s);
  const next = () => setStep(order[Math.min(order.indexOf(step) + 1, order.length - 1)]);
  const back = () => (buildMode && step === "finish" ? router.push("/home") : setStep(order[Math.max(order.indexOf(step) - 1, 0)]));

  /* ---- upload path ---- */
  const onDrop = async (files: File[]) => {
    const file = files[0];
    if (!file || !user) return;
    setFileName(file.name);
    setWorking(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await authFetch("/api/uploads", { method: "POST", body: form });
      if (!up.ok) throw new Error(tr("We couldn't upload that file. Try a PDF or Word document."));
      const { fileId, filename, type } = (await up.json()) as { fileId: string; filename: string; type: string };
      await addDoc(collection(db, "users", user.uid, "uploadedFiles"), {
        fileId,
        filename,
        type,
        createdAt: serverTimestamp(),
      });
      let parsed = await parseFile(fileId);
      // a resume in another language than the one shown: offer to translate it before it fills the forms
      const translated = await offerTranslation(parsed);
      if (translated) {
        parsed = translated;
        await applyProfileData(translated).catch(() => {});
      }
      // the length the person chose before uploading is not in the text of a resume: reading the file must not reset it
      const chosenGoal = asPageGoal((parsed as { pageGoal?: unknown }).pageGoal ?? pageGoalRef.current);
      parsed = { ...parsed, pageGoal: chosenGoal };
      // load what was read from the resume into the forms, so each section can be checked and corrected
      hydrate(parsed as unknown as typeof profile);
      updatePageGoal(chosenGoal);
      setStep("found");
    } catch (err) {
      toast.error((err as Error).message || tr("We couldn't read that file."));
    } finally {
      setWorking(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: working,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  /* ---- scratch path: apply each step to the profile and save ---- */
  const saveStep = (apply: () => void) => {
    apply();
    setSaveTick((t) => t + 1);
    next();
  };

  const addSkill = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setSkills((prev) => [...prev, ...parts.filter((p) => !prev.some((x) => x.toLowerCase() === p.toLowerCase()))]);
    setSkillDraft("");
  };

  /* ---- finish ---- */
  const generate = async () => {
    // a guest needs an account to download: the sign-in window moves the resume to it and sends them to the dashboard
    if (isGuest && !buildMode) {
      setGateQuick(false);
      setGateOpen(true);
      return;
    }
    setWorking(true);
    try {
      const res = await authFetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: activeProfileId, template: template || "classic", format: "pdf", builder: !buildMode && !loggedInHere, create: buildMode || loggedInHere, lang: locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.fileId) throw new Error(trd(data.error) || tr("We couldn't make your resume yet."));
      if (buildMode || loggedInHere) {
        // "Create resume" (or a download after logging in here): it is added to the list of resumes, and that is where the person lands
        toast.success(data.reused ? tr("You already have this exact resume in your list.") : tr("Your resume was created."));
        if (loggedInHere) try { sessionStorage.removeItem("kaizo_claiming"); } catch { /* storage unavailable */ }
        router.push("/home/resumes");
        return;
      }
      setPreviewId(data.fileId);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const finishTo = (href: string) => {
    close();
    router.push(href);
  };

  if (!open) return null;

  const summary = [
    { label: "Name", value: realName(profile.name) },
    { label: "Target job", value: profile.jobTitle },
    { label: "Email", value: profile.contactInfo?.email },
    { label: "Phone", value: profile.contactInfo?.phone },
    { label: "Location", value: [profile.contactInfo?.city, profile.contactInfo?.state].filter(Boolean).join(", ") },
    { label: "Summary", value: profile.careerObjective ? `${profile.careerObjective.trim().length} characters` : "" },
    { label: "Skills", value: profile.skills?.length ? `${profile.skills.length} found` : "" },
    { label: "Languages", value: profile.languages?.length ? `${profile.languages.length} found` : "" },
    { label: "Jobs", value: profile.jobHistory?.length ? `${profile.jobHistory.length} found` : "" },
    { label: "Education", value: profile.education?.length ? `${profile.education.length} found` : "" },
    { label: "Projects", value: profile.projects?.length ? `${profile.projects.length} found` : "" },
  ];

  const showTabs = !["template", "length", "path", "upload"].includes(step);
  const customizing = customize && showTabs;
  const reviewing = step === "finish" && !customizing;
  const on = (id: Step) => step === id || (reviewing && ["contact", "about", "skills", "job", "education", "extras"].includes(id));
  const split = customizing || (flow === "upload" && step === "found") || ["contact", "about", "skills", "job", "education", "extras"].includes(step);
  const fromProfile: PreviewData = {
    ...previewFromProfile(profile, locale === "es" ? "es" : "en"),
    sectionOrder: orderTouched ? ["about", ...blockOrder.filter((x) => !FIXED_SECTIONS.includes(x))] : undefined,
  };
  const extrasPreview = {
    links: fromProfile.links,
    certifications: fromProfile.certifications,
    interests: fromProfile.interests,
    projects: fromProfile.projects,
    internships: fromProfile.internships,
    sectionOrder: fromProfile.sectionOrder,
  };
  const previewData: PreviewData = step === "found" || step === "finish" ? fromProfile : {
    name,
    photo,
    email,
    phone,
    address: placeLine({ address, city, state: countryCode === "US" ? fullState(state) : state, country, countryCode }),
    countryCode,
    jobTitle,
    objective,
    skills: [...skills, ...skillDraft.split(",").map((x) => x.trim()).filter(Boolean)],
    languages,
    skillLevels,
    skillGroups,
    accent,
    fillPage,
    pageGoal,
    ...extrasPreview,
    sectionOrder: orderTouched ? ["about", ...blockOrder.filter((x) => !FIXED_SECTIONS.includes(x))] : undefined,
    jobs: jobs.map((j) => ({ ...j, description: "", bullets: toBullets(j.description) })),
    job: { ...jobs[0], description: "", bullets: toBullets(jobs[0]?.description ?? "") },
    edus,
    edu: edus[0],
  };
  const validJobs = jobs.filter((j) => j.title.trim() && j.company.trim());
  const openId = openJobId === "" ? jobs[0]?.id : openJobId;

  const removeJob = (j: JobDraft) => {
    // if this job was already saved to the profile (e.g. before a reload), remove it there too
    const saved = profile.jobHistory?.find((e) => e.id === j.id) ?? profile.jobHistory?.find((e) => e.title === j.title.trim() && e.company === j.company.trim());
    if (saved) {
      deleteJobEntry(saved.id);
      setSaveTick((t) => t + 1);
    }
    const left = jobs.filter((x) => x.id !== j.id);
    setJobs(left.length ? left : [blankJob()]);
    setOpenJobId("");
  };
  const validEdus = edus.filter((e) => e.school.trim());
  const openEdu = openEduId === "" ? edus[0]?.id : openEduId;
  const removeEdu = (e: EduDraft) => {
    const saved = profile.education?.find((x) => x.id === e.id) ?? profile.education?.find((x) => x.school === e.school.trim() && x.degree === e.degree.trim());
    if (saved) {
      deleteEducationEntry(saved.id);
      setSaveTick((t) => t + 1);
    }
    const left = edus.filter((x) => x.id !== e.id);
    setEdus(left.length ? left : [blankEdu()]);
    setOpenEduId("");
  };
  const addEdu = () => {
    const fresh = blankEdu();
    setEdus((prev) => [...prev, fresh]);
    setOpenEduId(fresh.id);
  };
  const addJob = () => {
    const fresh = blankJob();
    setJobs((prev) => [...prev, fresh]);
    setOpenJobId(fresh.id);
  };

  // Back / Skip / Continue live in a footer pinned to the bottom of the screen, so they never move with the content
  const hasFooter = !customizing && ["found", "contact", "about", "skills", "job", "education", "extras"].includes(step);
  const nav = (opts: { onNext: () => void; disabled?: boolean; label?: string; skip?: boolean; skipLabel?: string; onSkip?: () => void }) =>
    footerEl &&
    createPortal(
    <div className="flex items-center justify-between py-3">
      <Button variant="ghost" onClick={back} disabled={working}>
        <ArrowLeft className="h-4 w-4" />{" "}{tr("Back")}</Button>
      <div className="flex items-center gap-3">
        {opts.skip && (
          <button onClick={opts.onSkip ?? next} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {opts.skipLabel ?? tr("Skip this step")}
          </button>
        )}
        <Button onClick={opts.onNext} disabled={opts.disabled || working} className="h-11 gap-2 px-6">
          {opts.label ?? tr("Continue")} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    footerEl
  );

  // The sections of the details, kept as pieces so the person can put them in the order they like
  const blocks: Record<string, React.ReactNode> = {
    contact: on("contact") && (
          <Block reviewing={reviewing} id="contact" title="Contact info and photo">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Let's start with you")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("So employers know who you are and how to reach you.")}</p>
            <div className="mt-8">
              <PhotoPicker value={photo} onChange={setPhoto} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label={tr("First name")}>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={tr("Alex")} autoFocus name="given-name" autoComplete="given-name" />
              </Field>
              <Field label={tr("Last name")}>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={tr("Johnson")} name="family-name" autoComplete="family-name" />
              </Field>
              <Field label={tr("Email")}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("alex@email.com")} name="email" autoComplete="email" />
                {emailTaken && (
                  <span className="mt-2 block rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-snug">{tr("This email already has an account.")}{" "}
                    <button type="button" onClick={() => { setGateQuick(true); setGateOpen(true); }} className="font-semibold text-blue-500 underline underline-offset-2">{tr("Log in")}</button>
                  </span>
                )}
              </Field>
              <Field label={tr("Phone")}>
                <Input type="tel" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value, countryCode))} placeholder={phoneExample(countryCode)} name="tel" autoComplete="tel" />
              </Field>
              <div className="sm:col-span-2">
                <Field label={tr("Address")}>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={tr("123 Main St")} name="address-line1" autoComplete="address-line1" />
                </Field>
              </div>
              <Field label={tr("City")}>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={tr("Springfield")} name="address-level2" autoComplete="address-level2" />
              </Field>
              {regions.length > 0 ? (
                <div>
                  <span className="mb-1.5 block text-sm font-semibold">{regionLabel(countryCode, tr)}</span>
                  <PickSelect value={state} onChange={setState} options={regions} label={regionLabel(countryCode, tr)} name="address-level1" placeholder={tr("Choose a {v0}", { v0: regionLabel(countryCode, tr).toLowerCase() })} />
                </div>
              ) : (
                <div />
              )}
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold">{tr("Country")}</span>
                <PickSelect
                  value={country}
                  onChange={(name) => {
                    const c = geo?.countries.find((x) => x.name === name);
                    if (!c || c.isoCode === countryCode) return;
                    setCountry(c.name);
                    setCountryCode(c.isoCode);
                    setState(""); // the regions belong to the old country
                    setPhone((ph) => formatPhoneInput(ph.replace(/[^\d+]/g, ""), c.isoCode)); // same digits, the new country's look
                  }}
                  options={geo ? geo.countries.map((x) => x.name) : [country]}
                  display={countryShown}
                  label={tr("Country")}
                  name="country-name"
                  leading={(n) => {
                    const iso = (geo?.countries.find((x) => x.name === n)?.isoCode ?? (n === country ? countryCode : "")).toLowerCase();
                    return iso ? <span className={`fi fi-${iso} h-4 w-6 rounded-[3px] shadow-sm ring-1 ring-black/10`} aria-hidden /> : null;
                  }}
                  placeholder={tr("Choose a country")}
                />
              </div>
            </div>
            {nav({
              disabled: !name.trim() && !email.trim() && !photo,
              onNext: () =>
                saveStep(() => {
                  if (name.trim()) updateName(name.trim());
                  if (photo) updatePhoto(photo);
                  updateContactInfo({ email: email.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), state: (countryCode === "US" ? fullState(state) : state).trim(), country, countryCode });
                }),
              skip: true,
            })}
          </Block>
        ),
    about: on("about") && (
          <Block reviewing={reviewing} id="about" title="Job you want and summary">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("What kind of work do you want?")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("Two short lines are enough.")}</p>
            <div className="mt-5 space-y-4">
              <Field label={tr("Job you are aiming for")} hint="Pick one from the list, or type your own.">
                <JobTitleInput value={jobTitle} onChange={setJobTitle} placeholder={tr("Start typing, e.g. Software Engineer")} autoFocus />
              </Field>
              <Field label={tr("About you")} hint="Example: Computer science student who enjoys building web apps and learning fast.">
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </Field>
            </div>
            {nav({
              disabled: !jobTitle.trim() && !objective.trim(),
              onNext: () =>
                saveStep(() => {
                  if (jobTitle.trim()) updateJobTitle(jobTitle.trim());
                  if (objective.trim()) updateCareerObjective(objective.trim());
                }),
              skip: true,
            })}
          </Block>
        ),
    skills: on("skills") && (
          <Block reviewing={reviewing} id="skills" title="Skills">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("What are you good at?")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("Pick from the list or type your own. Aim for at least three.")}</p>
            <div className="mt-8">
              <SkillInput draft={skillDraft} onDraftChange={setSkillDraft} skills={skills} onAdd={addSkill} autoFocus />
              <ul className="mt-5 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <li key={s} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm">
                    {s}
                    <button
                      aria-label={tr("Remove {s}", { s })}
                      onClick={() => {
                        setSkills((prev) => prev.filter((x) => x !== s));
                        setSkillLevels((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== s)));
                        setSkillGroups((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== s)));
                      }}
                      className="-my-1 -mr-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <SkillLevelPicker skills={skills} levels={skillLevels} onChange={setSkillLevels} template={template} />
            <SkillGroupsEditor skills={skills} groups={skillGroups} onChange={setSkillGroups} />
            {nav({
              disabled: skills.length === 0 && !skillDraft.trim(),
              onNext: () => {
                const extra = skillDraft.split(",").map((s) => s.trim()).filter(Boolean);
                const all = [...skills, ...extra.filter((p) => !skills.some((x) => x.toLowerCase() === p.toLowerCase()))];
                setSkills(all);
                setSkillDraft("");
                saveStep(() => {
                  updateSkills(all);
                  updateSkillLevels(Object.fromEntries(Object.entries(skillLevels).filter(([k]) => all.includes(k))));
                  updateSkillGroups(cleanSkillGroups(all, skillGroups));
                });
              },
              skip: true,
            })}
          </Block>
        ),
    job: on("job") && (
          <Block reviewing={reviewing} id="job" title="Professional experience">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Professional experience")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("Add every job you have had, most recent first. Tap a job to show or hide its details. No experience yet? Skip this step.")}</p>
            <ul className="mt-5 space-y-2.5">
              <AnimatePresence initial={false}>
              {jobs.map((j, idx) => {
                const isOpen = j.id === openId;
                const dates = formatPeriod({ startDate: j.startDate, endDate: j.endDate, current: j.current }, " – ");
                const n = toBullets(j.description).length;
                return (
                  <motion.li
                    key={j.id}
                    layout="position"
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -24, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className={`overflow-hidden rounded-xl border bg-card transition-colors duration-300 ${isOpen ? "border-blue-500/50 shadow-lg shadow-blue-600/5" : "hover:border-blue-500/30"}`}
                  >
                    <div className="flex items-center pr-2">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenJobId(isOpen ? "none" : j.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-blue-600">
                          {idx + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {j.title.trim() || tr("New job")}
                            {j.company.trim() && <span className="font-normal text-muted-foreground"> · {j.company.trim()}</span>}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[dates, j.location.trim(), n ? `${n} bullet${n > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") || tr("Tap to fill in")}
                          </span>
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {(jobs.length > 1 || j.title || j.company || j.description) && (
                        <button
                          type="button"
                          aria-label={tr("Remove {v0}", { v0: j.title || "this job" })}
                          title={tr("Remove this job")}
                          onClick={() => removeJob(j)}
                          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.25, delay: 0.05 } }}
                        style={{ overflow: "hidden" }}
                      >
                      <div className="grid gap-4 border-t px-4 pb-4 pt-4 sm:grid-cols-2">
                        <Field label={tr("Job title")}>
                          <Input value={j.title} onChange={(e) => patchJob(j.id, { title: e.target.value })} placeholder={tr("Barista")} autoFocus={idx === 0} />
                        </Field>
                        <Field label={tr("Company")}>
                          <Input value={j.company} onChange={(e) => patchJob(j.id, { company: e.target.value })} placeholder={tr("Corner Cafe")} />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label={tr("Location")} hint="City and state, or Remote.">
                            <Input value={j.location} onChange={(e) => patchJob(j.id, { location: e.target.value })} placeholder={tr("Austin, TX")} />
                          </Field>
                        </div>
                        <Field label={tr("Started")}>
                          <MonthPicker label={tr("Job {v0} start", { v0: idx + 1 })} value={j.startDate} onChange={(v) => patchJob(j.id, { startDate: v })} />
                        </Field>
                        <Field label={tr("Ended")}>
                          <MonthPicker label={tr("Job {v0} end", { v0: idx + 1 })} value={j.endDate} min={j.startDate} disabled={j.current} onChange={(v) => patchJob(j.id, { endDate: v })} />
                          <span className="mt-2 flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={j.current}
                              onChange={(e) => patchJob(j.id, { current: e.target.checked, endDate: e.target.checked ? "" : j.endDate })}
                            />{tr("I still work here")}</span>
                        </Field>
                        <div className="sm:col-span-2">
                          <JobDescriptionEditor value={j.description} onChange={(v) => patchJob(j.id, { description: v })} jobTitle={j.title} />
                        </div>
                      </div>
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              onClick={addJob}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold text-blue-600 transition-colors hover:border-blue-500 hover:bg-accent"
            >
              <Plus className="h-4 w-4" />{" "}{tr("Add another job")}</button>

            {nav({
              disabled: validJobs.length === 0,
              onNext: () =>
                saveStep(() => {
                  // keep ids of jobs that are already saved (e.g. after a reload) and add the new ones; the list is replaced in one update
                  const existing = profile.jobHistory ?? [];
                  const used = new Set<string>();
                  const built = validJobs.map((j) => {
                    const entry = {
                      title: j.title.trim(),
                      company: j.company.trim(),
                      location: j.location.trim(),
                      description: "",
                      startDate: j.startDate,
                      endDate: j.current ? "" : j.endDate,
                      current: j.current,
                      accomplishments: toBullets(j.description),
                    };
                    const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
                    const match = existing.find((e) => !used.has(e.id) && e.id === j.id) ?? existing.find((e) => !used.has(e.id) && same(e.title, entry.title) && same(e.company, entry.company));
                    if (match) {
                      used.add(match.id);
                      return { ...match, ...entry };
                    }
                    return { ...entry, id: j.id };
                  });
                  setJobHistory([...built, ...existing.filter((e) => !used.has(e.id))]);
                }),
              skip: true,
            })}
          </Block>
        ),
    education: on("education") && (
          <Block reviewing={reviewing} id="education" title="Education">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Where did you study?")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("Add every school, most recent first. Tap one to show or hide its details. GPA, honors and coursework are optional.")}</p>
            <ul className="mt-5 space-y-2.5">
              <AnimatePresence initial={false}>
                {edus.map((e, idx) => {
                  const isOpen = reviewing ? !eduClosed.includes(e.id) : e.id === openEdu;
                  const dates = formatPeriod({ startDate: e.startDate, endDate: e.endDate, current: e.current }, " – ");
                  const showExtras = extrasOpen[e.id] ?? Boolean(e.gpa || e.honors || e.coursework);
                  return (
                    <motion.li
                      key={e.id}
                      layout="position"
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -24, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={`overflow-hidden rounded-xl border bg-card transition-colors duration-300 ${isOpen ? "border-blue-500/50 shadow-lg shadow-blue-600/5" : "hover:border-blue-500/30"}`}
                    >
                      <div className="flex items-center pr-2">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => (reviewing ? setEduClosed((c) => (isOpen ? [...c, e.id] : c.filter((x) => x !== e.id))) : setOpenEduId(isOpen ? "none" : e.id))}
                          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-blue-600">
                            {idx + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{e.school.trim() || tr("New school")}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[e.degree.trim(), dates, e.gpa.trim() ? `GPA ${e.gpa.trim()}` : ""].filter(Boolean).join(" · ") || tr("Tap to fill in")}
                            </span>
                          </span>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {(edus.length > 1 || e.school || e.degree) && (
                          <button
                            type="button"
                            aria-label={tr("Remove {v0}", { v0: e.school || "this school" })}
                            title={tr("Remove this school")}
                            onClick={() => removeEdu(e)}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="body"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.25, delay: 0.05 } }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="grid gap-4 border-t px-4 pb-4 pt-4 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <Field label={tr("Country of the school")} hint="The suggestions below are the main universities of that country. Pick another one if you studied abroad.">
                                  <PickSelect
                                    value={eduCountryName(e.schoolCountry)}
                                    onChange={(n) => {
                                      const next = n === ALL_COUNTRIES ? "ALL" : geo?.countries.find((x) => x.name === n)?.isoCode ?? "";
                                      if (next === (e.schoolCountry || countryCode)) return;
                                      // another country: the school, the degree and the place belonged to the old one, so they start over
                                      patchEdu(e.id, { schoolCountry: next, school: "", degree: "", location: "" });
                                    }}
                                    options={geo ? [ALL_COUNTRIES, ...geo.countries.map((x) => x.name)] : [eduCountryName(e.schoolCountry)]}
                                    display={(n: string) => (n === ALL_COUNTRIES ? tr("All countries") : countryShown(n))}
                                    label={tr("Country of the school")}
                                    name="school-country"
                                    leading={(n: string) => {
                                      const iso = n === ALL_COUNTRIES ? "" : (geo?.countries.find((x) => x.name === n)?.isoCode ?? "").toLowerCase();
                                      return iso ? <span className={`fi fi-${iso} h-4 w-6 rounded-[3px] shadow-sm ring-1 ring-black/10`} aria-hidden /> : null;
                                    }}
                                    placeholder={tr("Choose a country")}
                                  />
                                </Field>
                              </div>
                              <div className="sm:col-span-2">
                                <Field label={tr("School")}>
                                  <SuggestInput value={e.school} onChange={(v) => patchEdu(e.id, { school: v })} options={schoolOptions(e.schoolCountry)} browse terms={schoolTerms} placeholder={tr("Start typing, e.g. State University")} autoFocus={idx === 0} />
                                </Field>
                              </div>
                              <Field label={tr("Degree")}>
                                <SuggestInput value={e.degree} onChange={(v) => patchEdu(e.id, { degree: v })} options={DEGREES} browse translate={!englishSchool(e)} terms={englishSchool(e) ? (o) => [tr(o)] : undefined} placeholder={tr("Start typing, e.g. B.S. Biology")} />
                              </Field>
                              <div className="sm:col-span-2">
                                <Field label={tr("Location")} hint="City and state of the school.">
                                  <Input value={e.location} onChange={(ev) => patchEdu(e.id, { location: ev.target.value })} placeholder={tr("Austin, TX")} />
                                </Field>
                              </div>
                              <Field label={tr("Started")}>
                                <MonthPicker label={tr("School {v0} start", { v0: idx + 1 })} value={e.startDate} onChange={(v) => patchEdu(e.id, { startDate: v })} />
                              </Field>
                              <Field label={tr("Ended")}>
                                <MonthPicker label={tr("School {v0} end", { v0: idx + 1 })} value={e.endDate} min={e.startDate} allowFuture disabled={e.current} onChange={(v) => patchEdu(e.id, { endDate: v })} />
                                <span className="mt-2 flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={e.current}
                                    onChange={(ev) => patchEdu(e.id, { current: ev.target.checked, endDate: ev.target.checked ? "" : e.endDate })}
                                  />{tr("I'm still studying here")}</span>
                              </Field>

                              <div className="sm:col-span-2">
                                <button
                                  type="button"
                                  aria-expanded={showExtras}
                                  onClick={() => setExtrasOpen((prev) => ({ ...prev, [e.id]: !showExtras }))}
                                  className="flex min-h-6 items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
                                >
                                  <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showExtras ? "rotate-180" : ""}`} />{tr("Additional details")}{" "}<span className="font-normal text-muted-foreground">{tr("(optional)")}</span>
                                </button>
                                <AnimatePresence initial={false}>
                                  {showExtras && (
                                    <motion.div
                                      key="extras"
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                      style={{ overflow: "hidden" }}
                                    >
                                      <div className="grid gap-4 pt-4 sm:grid-cols-3">
                                        <Field label={tr("GPA")} hint="Only if it helps you, usually 3.5 or higher.">
                                          <Input value={e.gpa} onChange={(ev) => patchEdu(e.id, { gpa: ev.target.value })} placeholder="3.8 / 4.0" />
                                        </Field>
                                        <div className="sm:col-span-2">
                                          <Field label={tr("Honors and awards")} hint="Dean's List, Magna Cum Laude, scholarships…">
                                            <Input value={e.honors} onChange={(ev) => patchEdu(e.id, { honors: ev.target.value })} placeholder={tr("Dean's List, Merit Scholarship")} />
                                          </Field>
                                        </div>
                                        <div className="sm:col-span-3">
                                          <Field label={tr("Relevant coursework")} hint="Three to six classes that match the jobs you want.">
                                            <Input value={e.coursework} onChange={(ev) => patchEdu(e.id, { coursework: ev.target.value })} placeholder={tr("Data Structures, Algorithms, Databases")} />
                                          </Field>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              onClick={addEdu}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold text-blue-600 transition-colors hover:border-blue-500 hover:bg-accent"
            >
              <Plus className="h-4 w-4" />{" "}{tr("Add another school")}</button>

            {nav({
              disabled: validEdus.length === 0,
              onNext: () =>
                saveStep(() => {
                  // keep ids of schools already saved (e.g. after a reload); the whole list is replaced in one update
                  const existing = profile.education ?? [];
                  const used = new Set<string>();
                  const built = validEdus.map((e) => {
                    const entry = {
                      school: e.school.trim(),
                      degree: e.degree.trim(),
                      location: e.location.trim(),
                      startDate: e.startDate,
                      endDate: e.current ? "" : e.endDate,
                      current: e.current,
                      gpa: e.gpa.trim(),
                      honors: e.honors.trim(),
                      coursework: e.coursework.trim(),
                    };
                    const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
                    const match = existing.find((x) => !used.has(x.id) && x.id === e.id) ?? existing.find((x) => !used.has(x.id) && same(x.school, entry.school) && same(x.degree, entry.degree));
                    if (match) {
                      used.add(match.id);
                      return { ...match, ...entry };
                    }
                    return { ...entry, id: e.id };
                  });
                  setEducation([...built, ...existing.filter((x) => !used.has(x.id))]);
                }),
              skip: true,
            })}
          </Block>
        ),
    extras: on("extras") && (
            <Block reviewing={reviewing} id="extras" title="More to add (optional)">
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Anything else to add?")}</h1>
              <p className="mt-2 text-muted-foreground">{tr("Everything here is optional: links, projects, internships, certifications and, last, the languages you speak.")}</p>
              <div className="mt-5">
                <ExtrasEditor languages={languages} onLanguagesChange={setLanguages} />
              </div>
              {nav({
                onNext: () => saveStep(() => updateLanguages(languages)),
                skip: true,
              })}
            </Block>
          ),
  };

  // (the top bar slot is found above, with the other hooks)
  const topToolbar =
    embedded && topSlot
      ? createPortal(
          <div className="flex items-center justify-center gap-2 sm:flex-wrap sm:gap-3">
            <div className="inline-flex h-9 items-center rounded-full bg-muted p-0.5 text-sm font-semibold" role="tablist">
              {[
                { id: false, label: "Edit", icon: PenLine },
                { id: true, label: "Customize", icon: Palette },
              ].map((t) => (
                <button
                  key={t.label}
                  role="tab"
                  aria-selected={customize === t.id}
                  onClick={() => setCustomize(t.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-4 transition-colors ${customize === t.id ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <t.icon className="h-4 w-4" /> {tr(t.label)}
                </button>
              ))}
            </div>
            <Button onClick={generate} disabled={working} className="h-9 gap-2 rounded-full px-5 font-bold">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {working ? tr("Making your resume…") : tr("Create resume")}
            </Button>
          </div>,
          topSlot
        )
      : null;

  return (
    <div
      ref={scroller}
      className={`${intro ? "animate-wizard-in " : ""}${embedded ? "relative" : "no-scrollbar fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background"}`}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-label={tr("Set up your resume")}
    >
      {!embedded && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(120,130,150,0.22)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
      )}
      <div className="relative flex min-h-full flex-col">
      {topToolbar}
      {!embedded && (
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur">
        <div className="h-0.5 w-full bg-border">
          <div className="h-full bg-blue-600 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div className="mx-auto flex h-[3.75rem] max-w-[1840px] items-center justify-between gap-2 px-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-5 lg:px-10 [&>:last-child]:justify-self-end">
          <Link href="/" aria-label={tr("Back to home")} className="hidden w-fit rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring sm:block"><KaizoLogo width={84} /></Link>
          {showTabs ? (
            <div className="inline-flex rounded-md border bg-card p-0.5 text-sm font-semibold" role="tablist">
              {[
                { id: false, label: "Edit", icon: PenLine },
                { id: true, label: "Customize", icon: Palette },
              ].map((t) => (
                <button
                  key={t.label}
                  role="tab"
                  aria-selected={customize === t.id}
                  onClick={() => setCustomize(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors sm:px-3.5 ${
                    customize === t.id ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" /> {tr(t.label)}
                </button>
              ))}
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">
                {step === "template" ? 1 : 2}
              </span>
              {step === "template" ? tr("Choose a look") : tr("Add your details")}
            </p>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            {step === "finish" && (
              <>
                {!isGuest && (
                  <Button size="sm" variant="outline" onClick={() => finishTo("/home")} disabled={working} className="hidden sm:inline-flex">{tr("Go to my dashboard")}</Button>
                )}
                <Button size="sm" onClick={generate} disabled={working} className="gap-1.5">
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : buildMode ? <Plus className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  {working ? tr("Making your resume…") : buildMode ? tr("Create resume") : tr("Download")}
                </Button>
              </>
            )}
            <LanguageSwitch tone="app" className="hidden sm:inline-flex" />
            <LanguageSwitch tone="app" compact className="sm:hidden" />
            <ThemeSwitch dark={dark} onToggle={() => setTheme(dark ? "light" : "dark")} />
          </div>
        </div>
      </div>
      )}

      <div
        key={step}
        className={`${intro || step === "template" ? "" : "animate-pop-in"} mx-auto w-full flex-1 pt-1 ${embedded ? "" : "px-5 lg:px-10"} ${step === "template" && !customizing ? "pb-4" : "pb-6"} ${reviewing ? (embedded ? "lg:h-[calc(100dvh-7.5rem)] lg:flex-none lg:overflow-hidden lg:pb-0" : "lg:h-[calc(100dvh-4rem-3.75rem)] lg:flex-none lg:overflow-hidden lg:pb-4") : ""} ${
          split ? "grid max-w-[1840px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)]" : step === "template" || reviewing ? "max-w-[1840px]" : "max-w-4xl"
        }`}
      >
        <div className={`${intro && step !== "template" ? "enter-stagger " : ""}${reviewing ? "grid min-w-0 items-start gap-4 lg:h-full lg:grid-cols-[minmax(0,760px)_minmax(0,1fr)] lg:gap-x-10" : "min-w-0"}`}>
        {customizing ? (
          <>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Choose another look")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("Your content stays exactly as it is. Pick one and watch the preview change.")}</p>
            {/* the length is a choice about the look too, so it is here and not only when the resume is first made */}
            <h2 className="mt-6 text-base font-bold">{tr("How long should it be?")}</h2>
            <div className="mt-2">
              <PageLengthPicker compact value={pageGoal} template={template} onChange={onGoal} />
            </div>
            <div className="mt-8">
              {/* choosing a look applies it right away; you stay here until you go back to Edit */}
              <TemplateSelector onTemplateSelect={onTemplate} showcase />
            </div>
          </>
        ) : (
        <>
        {step === "template" && (
          <div className="text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{tr("Pick a look for your resume")}</h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">{tr("You can change it any time. Your content stays put.")}</p>
            <div className="mt-6 text-left">
              <TemplateSelector onTemplateSelect={onTemplate} showcase />
            </div>
            {/* pinned to the bottom of the screen so it is always in reach, however long the list of looks is */}
            <div className="sticky bottom-0 z-20 -mx-5 mt-6 flex justify-center bg-gradient-to-t from-background via-background/90 to-transparent px-5 pb-4 pt-6 lg:-mx-10">
              <ContinueButton onClick={() => go("length")} disabled={!template} />
            </div>
          </div>
        )}

        {step === "length" && (
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{tr("How long should your resume be?")}</h1>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{tr("You decide. Recruiters read one page best, but two pages make sense with a lot of experience. You can change it any time.")}</p>
            <div className="mt-8 text-left">
              <PageLengthPicker value={pageGoal} template={template} onChange={onGoal} />
            </div>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button variant="ghost" onClick={() => go("template")}>
                <ArrowLeft className="h-4 w-4" />{" "}{tr("Back")}</Button>
              <ContinueButton onClick={() => go("path")} />
            </div>
          </div>
        )}

        {step === "path" && (
          <div className="text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{tr("How do you want to start?")}</h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">{tr("Already have a resume? We'll read it so you don't type anything twice.")}</p>
            <div className="mx-auto mt-10 grid max-w-3xl gap-5 text-left sm:grid-cols-2">
              <button
                onClick={() => {
                  setFlow("upload");
                  go("upload");
                }}
                className="group relative overflow-hidden rounded-2xl border text-left bg-gradient-to-br from-blue-600/10 via-card to-card p-7 transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-600/10"
              >
                <ArrowRight className="absolute right-6 top-6 h-5 w-5 -translate-x-2 text-blue-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                  <FileUp className="h-6 w-6" />
                </span>
                <p className="mt-4 text-lg font-bold">{tr("Upload my resume")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{tr("PDF or Word. We fill in your details in a few seconds.")}</p>
                <span className="mt-3 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{tr("Fastest")}</span>
              </button>
              <button
                onClick={() => {
                  setFlow("scratch");
                  go("contact");
                }}
                className="group relative overflow-hidden rounded-2xl border text-left bg-card p-7 transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-600/10"
              >
                <ArrowRight className="absolute right-6 top-6 h-5 w-5 -translate-x-2 text-blue-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-blue-600">
                  <PenLine className="h-6 w-6" />
                </span>
                <p className="mt-4 text-lg font-bold">{tr("Start from scratch")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{tr("Answer a few short questions, one at a time.")}</p>
              </button>
            </div>
            <div className="mt-10">
              <Button variant="ghost" onClick={() => go("length")}>
                <ArrowLeft className="h-4 w-4" />{" "}{tr("Back")}</Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{tr("Upload your resume")}</h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">{tr("We'll read it and fill in your profile. You can fix anything afterwards.")}</p>
            <div
              {...getRootProps()}
              className={`mt-10 cursor-pointer rounded-2xl border-2 border-dashed bg-card/60 p-14 text-center backdrop-blur transition-all ${
                isDragActive ? "scale-[1.01] border-blue-500 bg-accent" : "border-border hover:border-blue-400 hover:bg-card"
              } ${working ? "pointer-events-none" : ""}`}
            >
              <input {...getInputProps()} />
              {working ? (
                <>
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
                  <p className="mt-4 text-lg font-semibold">{tr("Reading")}{" "}{fileName}…</p>
                  <p className="mt-1 text-sm text-muted-foreground">{tr("This takes about 10 to 20 seconds.")}</p>
                </>
              ) : (
                <>
                  <FileUp className="mx-auto h-10 w-10 text-blue-600" />
                  <p className="mt-4 text-lg font-semibold">{isDragActive ? tr("Drop it here") : tr("Drag your resume here, or click to choose")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{tr("PDF, DOCX or TXT, up to 10 MB")}</p>
                </>
              )}
            </div>
            <div className="mt-8 flex items-center justify-between text-left">
              <Button variant="ghost" onClick={back} disabled={working}>
                <ArrowLeft className="h-4 w-4" />{" "}{tr("Back")}</Button>
              <button
                onClick={() => {
                  setFlow("scratch");
                  go("contact");
                }}
                disabled={working}
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
              >{tr("Skip for now")}</button>
            </div>
          </div>
        )}

        {step === "found" && (
          <>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tr("Here's what we found")}</h1>
            <p className="mt-2 text-muted-foreground">{tr("We filled your profile from your resume. Go through each part to check and fix it, or jump straight to the final review.")}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {summary.map((s) => (
                <li key={s.label} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      s.value ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.value ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{tr(s.label)}</p>
                    <p className="truncate text-sm font-semibold">{s.value || tr("Not found")}</p>
                  </div>
                </li>
              ))}
            </ul>
            {nav({ onNext: next, label: "Review each section", skip: true, skipLabel: "Skip to the final review", onSkip: () => go("finish") })}
          </>
        )}

        <DndContext accessibility={dndAccessibility(tr)} sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={onSectionDrag}>
        <BlocksContext.Provider value={{ closed: closedBlocks, toggle: (t) => setClosedBlocks((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t])) }}>
        <div className={reviewing ? "min-w-0 space-y-4 lg:col-start-1 lg:h-full no-scrollbar lg:overflow-y-auto lg:overscroll-contain" : "contents"}>
        {reviewing && (
          <div className="lg:col-start-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold">{tr("Your details")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{tr("Change anything here. It saves by itself, and the review on the right can use it. Drag a section by its handle to reorder it.")}</p>
              </div>
            </div>
          </div>
        )}
        {reviewing && (
          // what the right-hand side shows, and fold / unfold everything: it stays at the top while the sections scroll under it
          <div className="sticky top-[3.75rem] z-20 -mx-2 border-b bg-background/90 px-2 pb-3 pt-3 backdrop-blur lg:top-0 lg:col-start-1">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div role="tablist" aria-label={tr("Right-hand side")} className="inline-flex rounded-full border bg-card p-1 shadow-sm">
                {[
                  { show: false, label: "AI review", icon: Sparkles },
                  { show: true, label: "Live preview", icon: Eye },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    role="tab"
                    aria-selected={showPreview === t.show}
                    onClick={() => setShowPreview(t.show)}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                      showPreview === t.show ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className="h-4 w-4" /> {tr(t.label)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setClosedBlocks(closedBlocks.length === 0 ? BLOCK_TITLES : [])}
                className="inline-flex w-[15.5rem] items-center justify-center gap-2 whitespace-nowrap rounded-full border bg-card px-5 py-3 text-sm font-semibold shadow-sm transition-colors hover:border-blue-500/50 hover:bg-accent"
              >
                {closedBlocks.length === 0 ? <ChevronsDownUp className="h-4 w-4 text-blue-600" /> : <ChevronsUpDown className="h-4 w-4 text-blue-600" />}
                {closedBlocks.length === 0 ? tr("Collapse all sections") : tr("Expand all sections")}
              </button>
            </div>
          </div>
        )}
        {blocks.contact}
        {blocks.about}
        <SortableContext items={blockOrder.filter((x) => !FIXED_SECTIONS.includes(x))} strategy={verticalListSortingStrategy}>
          {blockOrder.filter((x) => !FIXED_SECTIONS.includes(x)).map((id) => <React.Fragment key={id}>{blocks[id]}</React.Fragment>)}
        </SortableContext>
        </div>
        </BlocksContext.Provider>
        </DndContext>

        {step === "finish" && (
          <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:h-full no-scrollbar lg:overflow-y-auto lg:overscroll-contain">
            {/* the review stays mounted (just hidden) so it keeps everything it has; the preview takes its place, big */}
            <div className={showPreview ? "hidden" : ""}>
              <ResumeReview ready={reviewReady} template={template} onTemplateChange={onTemplate} onProfileChanged={() => { rehydrate.current = true; }} />
            </div>
            {showPreview && <LivePreview d={previewData} template={template} active={null} inline large />}
          </div>
        )}
        </>
        )}
        </div>

        {split && (
          <div className="min-w-0">
            <LivePreview d={previewData} template={template} active={customizing ? null : (step as PreviewSection)} sample={customizing} enter={intro} onCustomize={customizing ? undefined : () => setCustomize(true)} overlay={customizing ? <AccentPicker template={template} value={accent} onChange={onAccent} fill={fillPage} onFill={onFill} /> : undefined} />
          </div>
        )}
      </div>

      {/* final screen: Back stays at the bottom left, like in every other step */}
      {reviewing && !embedded && (
        <div className="sticky bottom-0 z-20 border-t bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-[3.75rem] w-full max-w-[1840px] items-center px-5 lg:px-10">
            <Button variant="ghost" onClick={back} disabled={working}>
              <ArrowLeft className="h-4 w-4" />{" "}{tr("Back")}</Button>
          </div>
        </div>
      )}

      {hasFooter && !embedded && (
        <div className={`sticky bottom-0 z-20 ${split ? "pointer-events-none lg:border-0" : "border-t bg-background/90 backdrop-blur"}`}>
          {/* same grid as the content above: the banner only covers the form's side, so the live preview is never under it */}
          <div
            className={`mx-auto w-full px-5 lg:px-10 ${
              split ? "grid max-w-[1840px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)]" : "max-w-4xl"
            }`}
          >
            <div className={`min-w-0 ${split ? "pointer-events-auto -mx-5 border-t bg-background/90 px-5 backdrop-blur lg:mx-0 lg:px-0" : ""}`}>
              <div ref={setFooterEl} className="min-w-0" />
            </div>
          </div>
        </div>
      )}
      </div>

      <SignupGate open={gateOpen} onClose={() => setGateOpen(false)} template={template || "classic"} startMode={gateQuick ? "login" : "register"} quick={gateQuick} onLoggedIn={(id) => { setLoggedInHere(true); if (id) setActiveProfileId(id); toast.success(tr("You are logged in. Keep going: when you download, your resume will be in Resumes.")); }} />

      <ResumePreviewModal
        isOpen={!!previewId}
        // closing the preview just returns to the review: the dashboard is only reached with "Go to my dashboard"
        onClose={() => setPreviewId(null)}
        fileId={previewId}
      />
    </div>
  );
}
