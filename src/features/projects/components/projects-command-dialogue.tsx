import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import {
  AlertCircleIcon,
  GlobeIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  useProjects,
  useDeleteProject,
  useRenameProject,
} from "../hooks/use-projects";
import { Doc } from "../../../../convex/_generated/dataModel";
import { Id } from "../../../../convex/_generated/dataModel";

const getProjectIcon = (project: Doc<"projects">) => {
  if (project.importStatus === "completed") {
    return <FaGithub className="size-4 text-muted-foreground" />;
  }

  if (project.importStatus === "failed") {
    return <AlertCircleIcon className="size-4 text-muted-foreground" />;
  }

  if (project.importStatus === "importing") {
    return (
      <Loader2Icon className="size-4 text-muted-foreground animate-spin" />
    );
  }

  return <GlobeIcon className="size-4 text-muted-foreground" />;
};

interface ProjectsCommandDialogueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectsCommandDialogue = ({
  open,
  onOpenChange,
}: ProjectsCommandDialogueProps) => {
  const router = useRouter();
  const projects = useProjects();
  const deleteProject = useDeleteProject();
  const renameProject = useRenameProject();

  const [confirmingDeleteId, setConfirmingDeleteId] =
    useState<Id<"projects"> | null>(null);
  const [renamingId, setRenamingId] = useState<Id<"projects"> | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleSelect = (projectId: string) => {
    if (renamingId) return;
    router.push(`/projects/${projectId}`);
    onOpenChange(false);
  };

  const handleDelete = (
    e: React.MouseEvent,
    projectId: Id<"projects">,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirmingDeleteId === projectId) {
      deleteProject({ id: projectId });
      setConfirmingDeleteId(null);
    } else {
      setConfirmingDeleteId(projectId);
      setRenamingId(null);
    }
  };

  const handleStartRename = (
    e: React.MouseEvent,
    project: Doc<"projects">,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setRenamingId(project._id);
    setRenameValue(project.name);
    setConfirmingDeleteId(null);
  };

  const handleRenameSubmit = (projectId: Id<"projects">) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== "") {
      renameProject({ id: projectId, name: trimmed });
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmingDeleteId(null);
      setRenamingId(null);
      setRenameValue("");
    }
    onOpenChange(newOpen);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="search projects"
      description="search and navigate to your projects"
    >
      <CommandInput placeholder="Search projects" />
      <CommandList>
        <CommandEmpty>No projects found</CommandEmpty>
        <CommandGroup heading="Projects">
          {projects?.map((project) => (
            <CommandItem
              key={project._id}
              value={`${project.name}-${project._id}`}
              onSelect={() => handleSelect(project._id)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getProjectIcon(project)}
                {renamingId === project._id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        handleRenameSubmit(project._id);
                      }
                      if (e.key === "Escape") {
                        handleRenameCancel();
                      }
                    }}
                    onBlur={() => handleRenameSubmit(project._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border border-input rounded-sm px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring w-full"
                  />
                ) : (
                  <span className="truncate">{project.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                  onClick={(e) => handleStartRename(e, project)}
                  className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                  title="Rename project"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, project._id)}
                  className={`p-1 rounded-sm transition-colors ${
                    confirmingDeleteId === project._id
                      ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
                      : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  }`}
                  title={
                    confirmingDeleteId === project._id
                      ? "Click again to confirm delete"
                      : "Delete project"
                  }
                >
                  {confirmingDeleteId === project._id ? (
                    <span className="text-xs font-medium px-1">Delete?</span>
                  ) : (
                    <Trash2Icon className="size-3.5" />
                  )}
                </button>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};