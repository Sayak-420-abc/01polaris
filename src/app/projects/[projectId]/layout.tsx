

import { ProjectIdLayout } from "@/features/projects/components/project-id-layout";

import { Id } from "../../../../convex/_generated/dataModel";

const Layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  
  params: Promise<{ projectId: Id<"projects"> }>;
}) => {
  const { projectId } = await params;

  return <ProjectIdLayout projectId={projectId}>{children}</ProjectIdLayout>;
};

export default Layout;

/*
import { ProjectIdLayout } from "@/features/projects/components/project-id-layout";
import { Id } from "../../../../convex/_generated/dataModel";

const Layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string }; // ✅ string, not Promise
}) => {
  const projectId = params.projectId as Id<"projects">; // ✅ cast

  return <ProjectIdLayout projectId={projectId}>{children}</ProjectIdLayout>;
};

export default Layout;


import { ProjectIdLayout } from "@/features/projects/components/project-id-layout";
import { Id } from "../../../../convex/_generated/dataModel";

const Layout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>; // ✅ Promise + string
}) => {
  const { projectId } = await params; // ✅ await

  const convexProjectId = projectId as Id<"projects">; // ✅ cast

  return (
    <ProjectIdLayout projectId={convexProjectId}>{children}</ProjectIdLayout>
  );
};

export default Layout;


*/
