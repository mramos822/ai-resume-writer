// src/app/home/profile/page.tsx
"use client";

import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';

import { useProfile } from "@/context/profileContext";
import ContactInfoSection from '@/components/profile/contactInfoSection';
import CareerObjectiveSection from '@/components/profile/careerObjectiveSection';
import SkillsSection from '@/components/profile/skillsSection';
import JobHistorySection from '@/components/profile/jobHistorySection';
import EducationSection from '@/components/profile/educationSection';
import InternshipSection from '@/components/profile/internshipSection';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from "@/context/toastContext";
import { usePathname } from 'next/navigation';

const VALID_SECTIONS = ["contact","objective","skills","jobs","education","internships"] as const;
type SectionKey = typeof VALID_SECTIONS[number];

/** 
 * Reads location.hash and updates whenever:
 *  - the hash changes (in-page navigation)
 *  - the pathname changes to /home/profile (cross-page Link→hash)
 */
function useHash(): SectionKey {
  const pathname = usePathname();
  const getHash = (): SectionKey => {
    const h = window.location.hash.slice(1) as SectionKey;
    return VALID_SECTIONS.includes(h) ? h : "contact";
  };

  const [hash, setHash] = useState<SectionKey>(() => {
    // on first mount, pick up any existing fragment
    if (typeof window !== "undefined") return getHash();
    return "contact";
  });

  React.useEffect(() => {
    // in-page hash changes
    const onHashChange = () => setHash(getHash());
    window.addEventListener("hashchange", onHashChange);

    // cross-page nav: if we just landed on /home/profile, re-read the hash
    if (pathname === "/home/profile") {
      setHash(getHash());
    }

    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  return hash;
}

function ResumeAdviceSection() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeProfile } = useProfile();

  const handleRequestAdvice = async () => {
    setLoading(true);
    setAdvice(null);
    setError(null);
    try {
      const res = await fetch('/api/job-ads/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: activeProfile }),
      });
      if (!res.ok) throw new Error('Failed to get advice');
      const data = await res.json();
      setAdvice(data.advice || data.text || 'No advice returned.');
    } catch (err: unknown) {
      let message = 'Unknown error';
      if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-8 p-6 bg-neutral-800 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2 text-neutral-100">Resume Advice</h2>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        onClick={handleRequestAdvice}
        disabled={loading}
      >
        {loading ? 'Requesting Advice…' : 'Get Resume Advice'}
      </button>
      {loading && <div className="mt-4 text-blue-400">Loading advice…</div>}
      {error && <div className="mt-4 text-red-500">{error}</div>}
      {advice && !loading && (
        <div className="mt-4 p-4 bg-neutral-900 rounded text-neutral-100 whitespace-pre-line">
          {advice}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { hasUnsavedChanges, saveChanges } = useProfile();
  const [isReParsing, setIsReParsing] = useState(false);
  const toast = useToast();

  // read + update from URL hash
  const activeTab = useHash();

  // when user clicks the in-page tab buttons:
  const onTabChange = useCallback((val: string) => {
    window.location.hash = val;            // triggers hashchange → our hook updates
  }, []);

  const handleSave = async () => {
    await saveChanges();
    toast.success('Profile saved successfully!');
  };

  const handleReParse = async () => {
    setIsReParsing(true);
    // simulate a re-parse (or you could re-fetch & re-call parseAndUpdate here)
    await new Promise((r) => setTimeout(r, 2000));
    setIsReParsing(false);
    toast.success('Profile re-parsed successfully!');
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Your Profile
              </h1>
              <p className="text-muted-foreground">
                Review and edit your structured professional information
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleReParse}
                disabled={isReParsing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    isReParsing ? 'animate-spin' : ''
                  }`}
                />
                Re-parse History
              </Button>

              <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          {hasUnsavedChanges && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4" color='black' />
              <AlertDescription className="text-amber-800">
                You have unsaved changes
              </AlertDescription>
            </Alert>
          )}
        </motion.div>

        {/* Sections Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  {VALID_SECTIONS.map((key) => (
                    <TabsTrigger key={key} value={key} className="flex items-center space-x-2">
                      {{
                        contact: "👤",
                        objective: "🎯",
                        skills: "⚡",
                        jobs: "💼",
                        education: "🎓",
                        internships: "🌟", // New icon for internships
                      }[key]}
                      <span className="hidden sm:inline capitalize">{key}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="contact" className="mt-6">
                  <ContactInfoSection />
                </TabsContent>
                <TabsContent value="objective" className="mt-6">
                  <CareerObjectiveSection />
                </TabsContent>
                <TabsContent value="skills" className="mt-6">
                  <SkillsSection />
                </TabsContent>
                <TabsContent value="jobs" className="mt-6">
                  <JobHistorySection />
                </TabsContent>
                <TabsContent value="education" className="mt-6">
                  <EducationSection />
                </TabsContent>
                <TabsContent value="internships" className="mt-6">
                  <InternshipSection />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
        <ResumeAdviceSection />
      </div>
    </div>
  );
}
