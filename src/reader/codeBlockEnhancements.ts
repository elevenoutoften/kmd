export function enhanceCodeBlocks(
  container: HTMLElement,
  onCopy: (message: string) => void
): void {
  console.log(`[kmd:code-enhance] Setting up code block enhancements`);
  
  // Set cursor styles for clickable elements
  const spans = container.querySelectorAll("pre code span[style]");
  spans.forEach((span) => {
    (span as HTMLElement).style.cursor = "pointer";
    (span as HTMLElement).title = "Click to copy";
  });
  
  const inlineCodes = container.querySelectorAll("p code, li code, td code, h1 code, h2 code, h3 code, h4 code, h5 code, h6 code");
  inlineCodes.forEach((code) => {
    (code as HTMLElement).style.cursor = "pointer";
    (code as HTMLElement).title = "Click to copy";
  });
  
  // Add a single click handler on the container for all copy actions
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Copy button click
    const copyButton = target.closest(".code-copy-button");
    if (copyButton) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[kmd:code-copy] Copy button clicked");
      const pre = copyButton.closest("pre");
      if (pre) {
        const code = pre.querySelector("code");
        if (code) {
          const text = code.textContent ?? "";
          console.log(`[kmd:code-copy] Copying ${text.length} characters`);
          copyToClipboard(text, onCopy);
        }
      }
      return;
    }
    
    // Highlighted token click
    const span = target.closest("pre code span[style]");
    if (span) {
      e.stopPropagation();
      e.preventDefault();
      const text = span.textContent ?? "";
      console.log(`[kmd:code-copy] Token clicked: "${text.substring(0, 50)}"`);
      if (text.trim()) {
        copyToClipboard(text, onCopy);
      }
      return;
    }
    
    // Inline code click
    const inlineCode = target.closest("p code, li code, td code, h1 code, h2 code, h3 code, h4 code, h5 code, h6 code");
    if (inlineCode) {
      e.stopPropagation();
      e.preventDefault();
      const text = inlineCode.textContent ?? "";
      console.log(`[kmd:code-copy] Inline code clicked: "${text}"`);
      if (text.trim()) {
        copyToClipboard(text, onCopy);
      }
      return;
    }
  };
  
  container.addEventListener("click", handleClick);
  
  // Store the handler for potential cleanup
  (container as any).__codeClickHandler = handleClick;
}

export function removeCodeBlockEnhancements(container: HTMLElement): void {
  const handler = (container as any).__codeClickHandler;
  if (handler) {
    container.removeEventListener("click", handler);
    delete (container as any).__codeClickHandler;
  }
}

function copyToClipboard(text: string, onCopy: (message: string) => void): void {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        onCopy("Copied to clipboard");
      })
      .catch(() => {
        fallbackCopy(text, onCopy);
      });
  } else {
    fallbackCopy(text, onCopy);
  }
}

function fallbackCopy(text: string, onCopy: (message: string) => void): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand("copy");
    onCopy("Copied to clipboard");
  } catch {
    onCopy("Failed to copy");
  }
  
  document.body.removeChild(textarea);
}
