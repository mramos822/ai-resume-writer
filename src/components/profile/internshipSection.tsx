"use client";

import React, { useState } from 'react';
import { PlusCircle, Trash2, Edit, FolderInput } from 'lucide-react';
import { useProfile, JobEntry } from "@/context/profileContext";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDialog } from "@/context/dialogContext";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useT } from "@/i18n/provider";

interface InternshipFormProps {
  initialData?: JobEntry;
  onSave: (data: Omit<JobEntry, 'id'>, id?: string) => void;
  onCancel: () => void;
}

const InternshipForm: React.FC<InternshipFormProps> = ({ initialData, onSave, onCancel }) => {
  const { tr } = useT();
  const [company, setCompany] = useState(initialData?.company || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [accomplishments, setAccomplishments] = useState(initialData?.accomplishments.join('\n') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newInternship: Omit<JobEntry, 'id'> = {
      company,
      title,
      startDate,
      endDate,
      description: '', // Internships might not have a 'description' field in the same way jobs do, or it can be derived from accomplishments. For now, setting it empty.
      accomplishments: accomplishments.split('\n').filter(item => item.trim() !== ''),
    };
    onSave(newInternship, initialData?.id);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="company">{tr("Company")}</Label>
        <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="title">{tr("Title")}</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">{tr("Start Date")}</Label>
          <Input id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder={tr("e.g., May 2023")} required />
        </div>
        <div>
          <Label htmlFor="endDate">{tr("End Date")}</Label>
          <Input id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder={tr("e.g., Aug 2023 or Present")} required />
        </div>
      </div>
      <div>
        <Label htmlFor="accomplishments">{tr("Accomplishments (one per line)")}</Label>
        <Textarea
          id="accomplishments"
          value={accomplishments}
          onChange={(e) => setAccomplishments(e.target.value)}
          rows={5}
          placeholder={tr("List key achievements, one per line.")}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{tr("Cancel")}</Button>
        <Button type="submit">{tr("Save Internship")}</Button>
      </DialogFooter>
    </form>
  );
};

export default function InternshipSection() {
  const { tr } = useT();
  const { activeProfile, addInternshipEntry, updateInternshipEntry, deleteInternshipEntry } = useProfile();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const dialog = useDialog();
  const { addProjectEntry } = useProfile();

  /** For entries the importer put here by mistake: turn them into a project. */
  const moveToProjects = async (internship: JobEntry) => {
    const ok = await dialog.confirm({
      title: tr("Move this to Projects?"),
      description: tr("Use this if it's a personal, school or side project rather than an internship at a company."),
      confirmText: tr("Move to Projects"),
    });
    if (!ok) return;
    addProjectEntry({
      name: internship.title || internship.company,
      description: internship.description || "",
      link: "",
      technologies: [],
      startDate: "",
      endDate: "",
      current: false,
      accomplishments: internship.accomplishments || [],
    });
    deleteInternshipEntry(internship.id);
  };
  const [editingInternship, setEditingInternship] = useState<JobEntry | undefined>(undefined);

  const handleAddClick = () => {
    setEditingInternship(undefined);
    setIsFormOpen(true);
  };

  const handleEditClick = (internship: JobEntry) => {
    setEditingInternship(internship);
    setIsFormOpen(true);
  };

  const handleSaveInternship = (data: Omit<JobEntry, 'id'>, id?: string) => {
    if (id) {
      updateInternshipEntry(id, data);
    } else {
      addInternshipEntry(data);
    }
    setIsFormOpen(false);
  };

  const handleDeleteInternship = async (id: string) => {
    const ok = await dialog.confirm({
      title: tr("Remove this internship?"),
      description: tr("It will disappear from your profile and from resumes you generate next."),
      confirmText: tr("Remove"),
      tone: "danger",
    });
    if (ok) deleteInternshipEntry(id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">{tr("Internship History")}<Button onClick={handleAddClick} size="sm">
            <PlusCircle className="h-4 w-4 mr-2" />{" "}{tr("Add Internship")}</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeProfile.internships.length === 0 ? (
          <p className="text-muted-foreground">{tr("No internship entries yet. Click \"Add Internship\" to get started.")}</p>
        ) : (
          <div className="space-y-4">
            {activeProfile.internships.map((internship) => (
              <div key={internship.id} className="border rounded-md p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{tr(internship.title)}{" "}{tr("at")}{" "}{internship.company}</h4>
                  <p className="text-sm text-muted-foreground">{internship.startDate} - {internship.endDate}</p>
                  {internship.accomplishments && internship.accomplishments.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                      {internship.accomplishments.map((acc, idx) => (
                        <li key={idx}>{acc}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveToProjects(internship)}
                    title={tr("This is a project, not an internship. Move it to Projects")}
                    aria-label={tr("Move to Projects")}
                  >
                    <FolderInput className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(internship)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteInternship(internship.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingInternship ? tr("Edit Internship") : tr("Add New Internship")}</DialogTitle>
            </DialogHeader>
            <InternshipForm
              initialData={editingInternship}
              onSave={handleSaveInternship}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
