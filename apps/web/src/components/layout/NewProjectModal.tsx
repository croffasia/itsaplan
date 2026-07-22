import { useState } from 'react';
import { type Project } from '@/lib/api';
import { useCreateProject } from '@/services/projects.service';
import { normalizeKey, suggestKey } from '@/utils/projectKey';
import type { PresetKey } from '@/utils/projectPresets';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import CopyProjectForm from '@/components/layout/CopyProjectForm';
import NewProjectForm from '@/components/layout/NewProjectForm';
import { allSelected, type CopyInclude } from '@/components/layout/CopyProjectOptions';

// Creates a project, or — when `copyFrom` is set — copies that project's structure
// (states, issue types, labels, custom fields) into a new project without its
// issues.
export default function NewProjectModal({
  onClose,
  onCreated,
  copyFrom,
}: {
  onClose: () => void;
  onCreated: (projectKey: string) => void;
  copyFrom?: Project;
}) {
  const initialName = copyFrom ? `${copyFrom.name} copy` : '';
  const [key, setKey] = useState(() => suggestKey(initialName));
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(copyFrom?.description ?? '');
  // Once the user edits the key, stop deriving it from the name. Clearing the
  // key field resumes auto-generation.
  const [keyEdited, setKeyEdited] = useState(false);
  // Which parts of the source project to copy. Defaults to everything; the user
  // clears what they don't want.
  const [include, setInclude] = useState<CopyInclude>(allSelected);
  // Which issue types the new project starts with. A copy takes its types from the
  // source project, so the preset applies only when creating from scratch.
  const [preset, setPreset] = useState<PresetKey>('general');
  const createProject = useCreateProject();

  function onNameChange(value: string) {
    setName(value);
    if (!keyEdited) setKey(suggestKey(value));
  }

  function onKeyChange(value: string) {
    const next = normalizeKey(value);
    setKey(next);
    setKeyEdited(next !== '');
  }

  function submit() {
    const input = {
      key: key.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      ...(copyFrom ? { include } : { preset }),
    };
    createProject.mutate(
      { copyFromKey: copyFrom?.key, input },
      { onSuccess: (project) => onCreated(project.key) },
    );
  }

  return (
    <Modal
      title={copyFrom ? `Copy project "${copyFrom.name}"` : 'New project'}
      onClose={onClose}
      wide="xl"
    >
      <div className="space-y-4">
        {/* On a short viewport the form scrolls on its own so the submit button
            stays in place instead of sitting below the fold. */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {copyFrom ? (
            <CopyProjectForm
              name={name}
              projectKey={key}
              description={description}
              include={include}
              onNameChange={onNameChange}
              onKeyChange={onKeyChange}
              onDescriptionChange={setDescription}
              onIncludeChange={setInclude}
            />
          ) : (
            <NewProjectForm
              name={name}
              projectKey={key}
              description={description}
              preset={preset}
              onNameChange={onNameChange}
              onKeyChange={onKeyChange}
              onDescriptionChange={setDescription}
              onPresetChange={setPreset}
            />
          )}
        </div>
        <Button
          className="w-full"
          disabled={createProject.isPending || !key.trim() || !name.trim()}
          onClick={submit}
        >
          {copyFrom ? 'Copy project' : 'Create project'}
        </Button>
      </div>
    </Modal>
  );
}
