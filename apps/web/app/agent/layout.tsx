import type { ReactNode } from "react";
import { AgentSessionTracker } from "../../components/agent-session-tracker";

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AgentSessionTracker />
      {children}
    </>
  );
}
