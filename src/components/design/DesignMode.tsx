import { useMemo } from "react";
import { runDesignPipelineCached } from "@/parser/design";
import { DesignCatalog } from "./DesignCatalog";
import "./DesignCatalog.css";

interface DesignModeProps {
  content: string;
}

export function DesignMode({ content }: DesignModeProps) {
  const doc = useMemo(() => runDesignPipelineCached(content), [content]);

  return (
    <div className="design-mode-scroll">
      <div className="design-mode-content">
        <DesignCatalog doc={doc} />
      </div>
    </div>
  );
}
