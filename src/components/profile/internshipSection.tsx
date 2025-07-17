"use client";

import React, { useState } from 'react';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import { useProfile, JobEntry } from "@/context/profileContext";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface InternshipFormProps {
  initialData?: JobEntry;
  onSave: (data: Omit<JobEntry, 'id'>, id?: string) => void;
  onCancel: () => void;
}

const InternshipForm: React.FC<InternshipFormProps> = ({ initialData, onSave, onCancel }) => {
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
        <Label htmlFor="company">Company</Label>
        <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="e.g., May 2023" required />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="e.g., Aug 2023 or Present" required />
        </div>
      </div>
      <div>
        <Label htmlFor="accomplishments">Accomplishments (one per line)</Label>
        <Textarea
          id="accomplishments"
          value={accomplishments}
          onChange={(e) => setAccomplishments(e.target.value)}
          rows={5}
          placeholder="List key achievements, one per line."
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Internship</Button>
      </DialogFooter>
    </form>
  );
};

export default function InternshipSection() {
  const { activeProfile, addInternshipEntry, updateInternshipEntry, deleteInternshipEntry } = useProfile();
  const [isFormOpen, setIsFormOpen] = useState(false);
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

  const handleDeleteInternship = (id: string) => {
    if (window.confirm('Are you sure you want to delete this internship entry?')) {
      deleteInternshipEntry(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Internship History
          <Button onClick={handleAddClick} size="sm">
            <PlusCircle className="h-4 w-4 mr-2" /> Add Internship
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeProfile.internships.length === 0 ? (
          <p className="text-muted-foreground">No internship entries yet. Click "Add Internship" to get started.</p>
        ) : (
          <div className="space-y-4">
            {activeProfile.internships.map((internship) => (
              <div key={internship.id} className="border rounded-md p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{internship.title} at {internship.company}</h4>
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
              <DialogTitle>{editingInternship ? 'Edit Internship' : 'Add New Internship'}</DialogTitle>
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
