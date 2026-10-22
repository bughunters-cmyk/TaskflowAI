'use client';

import React, { useState } from 'react';
import { ConfirmedTask } from '@/types/meeting';
import { MOCK_PARTICIPANTS } from '@/lib/data/mock-meetings';
import { Edit3, X, Check, Calendar, User, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskEditModalProps {
  task: ConfirmedTask | null;
  onClose: () => void;
  onSave: (updated: Partial<ConfirmedTask>) => void;
}

export function TaskEditModal({ task, onClose, onSave }: TaskEditModalProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');

  if (!task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedUser = MOCK_PARTICIPANTS.find((p) => p.id === assigneeId);
    onSave({
      title,
      description,
      assignee_id: assigneeId || null,
      assignee_name: assignedUser ? assignedUser.name : undefined,
      owner_member_id: assignedUser?.trello_member_id || assigneeId || null,
      due_date: dueDate || null,
      priority: priority as ConfirmedTask['priority'],
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-app-border bg-[#15191E] text-app-primary shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-app-border bg-app-elevated/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-app-elevated border border-app-border flex items-center justify-center text-app-primary">
              <Edit3 className="w-4.5 h-4.5 text-app-accent" />
            </div>
            <div>
              <h3 id="edit-task-title" className="text-base sm:text-lg font-semibold text-app-primary">
                Edit Action Item
              </h3>
              <p className="text-xs sm:text-[13px] text-app-secondary">
                Modify title, description, and execution parameters
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-app-border text-app-secondary hover:text-app-primary hover:bg-app-elevated transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-sm">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-[13px] font-medium text-app-secondary">
                Task Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 sm:h-11 px-3.5 py-2 rounded-xl border border-app-border bg-app-elevated/50 text-app-primary focus:outline-hidden focus:border-app-accent text-sm"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-[13px] font-medium text-app-secondary">
                Description / Scope
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-app-border bg-app-elevated/50 text-app-primary focus:outline-hidden focus:border-app-accent text-sm leading-relaxed resize-none"
              />
            </div>

            {/* Two-Column Grid: Assignee & Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-medium text-app-secondary">
                  Assignee
                </label>
                <div className="relative">
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full h-10 sm:h-11 px-3.5 py-2 rounded-xl border border-app-border bg-app-elevated/50 text-app-primary text-sm appearance-none focus:outline-hidden focus:border-app-accent"
                  >
                    <option value="">Unassigned</option>
                    {MOCK_PARTICIPANTS.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-medium text-app-secondary">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3.5 py-2 rounded-xl border border-app-border bg-app-elevated/50 text-app-primary text-sm font-mono focus:outline-hidden focus:border-app-accent"
                />
              </div>
            </div>

            {/* Priority Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-[13px] font-medium text-app-secondary">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'py-2 px-3 rounded-xl border text-center uppercase font-mono text-xs tracking-wider transition-colors font-medium',
                      priority === p
                        ? 'border-app-accent bg-app-accent/15 text-app-accent font-semibold ring-1 ring-app-accent/40'
                        : 'border-app-border bg-app-elevated/30 text-app-secondary hover:text-app-primary hover:bg-app-elevated'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 border-t border-app-border bg-app-elevated/40 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-app-border bg-app-surface text-app-secondary hover:text-app-primary text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-app-accent text-black font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_0_12px_rgba(190,255,83,0.3)] ring-1 ring-app-accent"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
