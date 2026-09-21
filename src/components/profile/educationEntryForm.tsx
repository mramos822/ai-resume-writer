import React from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Save, X } from 'lucide-react';
import { useProfile, EducationEntry } from '@/context/profileContext';

interface EducationEntryFormProps {
  education?: EducationEntry | null;
  onClose: () => void;
}

interface EducationFormData {
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
  current: boolean;
  gpa?: string;
}

const EducationEntryForm: React.FC<EducationEntryFormProps> = ({ education, onClose }) => {
  const { addEducationEntry, updateEducationEntry } = useProfile();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<EducationFormData>({
    defaultValues: {
      school: education?.school || '',
      degree: education?.degree || '',
      startDate: education?.startDate || '',
      endDate: education?.endDate || '',
      current: education?.current || false,
      gpa: education?.gpa || '',
    }
  });

  const isCurrent = watch('current');

  const onSubmit = (data: EducationFormData) => {
    const entry = { ...data, endDate: data.current ? '' : data.endDate };
    if (education) {
      updateEducationEntry(education.id, entry);
    } else {
      addEducationEntry(entry);
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card rounded-lg p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {education ? 'Edit Education Entry' : 'Add New Education'}
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-red-500 hover:text-white hover:bg-red-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            School/Institution Name *
          </label>
          <input
            {...register('school', { required: 'School name is required' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., University of Technology"
          />
          {errors.school && (
            <p className="mt-1 text-sm text-red-600">{errors.school.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white-700 mb-2">
            Degree/Certificate/Program *
          </label>
          <input
            {...register('degree', { required: 'Degree is required' })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Bachelor of Science in Computer Science"
          />
          {errors.degree && (
            <p className="mt-1 text-sm text-red-600">{errors.degree.message}</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white-700 mb-2">
              Start Date *
            </label>
            <input
              {...register('startDate', { required: 'Start date is required' })}
              type="month"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white-700 mb-2">
              End Date {isCurrent ? '' : '*'}
            </label>
            <input
              {...register('endDate', { required: isCurrent ? false : 'End date is required' })}
              type="month"
              disabled={isCurrent}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
            )}
            <label className="mt-2 flex items-center space-x-2 text-sm text-foreground cursor-pointer">
              <input
                {...register('current')}
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
              />
              <span>Currently in</span>
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white-700 mb-2">
              GPA (Optional)
            </label>
            <input
              {...register('gpa')}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 3.8 or 3.8/4.0"
            />
            <p className="mt-1 text-sm text-white-500">
              Only include if 3.5 or higher
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-white border border-gray-300 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>{education ? 'Update Education' : 'Add Education'}</span>
          </button>
        </div>
      </form>

      {/* Examples */}
      <div className="mt-6 bg-muted rounded-lg p-4">
        <h4 className="font-semibold text-foreground mb-2">📚 Examples:</h4>
        <div className="space-y-2 text-sm text-foreground">
          <div>
            <strong>University:</strong> &quot;Bachelor of Science in Computer Science&quot;
          </div>
          <div>
            <strong>Bootcamp:</strong> &quot;Full Stack Web Development Certificate&quot;
          </div>
          <div>
            <strong>Online Course:</strong> &quot;Google Data Analytics Professional Certificate&quot;
          </div>
          <div>
            <strong>Trade School:</strong> &quot;Associate Degree in Automotive Technology&quot;
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EducationEntryForm;