export function enhanceCodeBlocks(
  container: HTMLElement,
  onCopy: (message: string) => void
): void {
  container.querySelectorAll("pre code span[style]").forEach((el) => {
    (el as HTMLElement).title = "Click to copy";
  });
  container.querySelectorAll("p code, li code, td code, h1 code, h2 code, h3 code, h4 code, h5 code, h6 code").forEach((el) => {
    (el as HTMLElement).title = "Click to copy";
  });

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    const copyButton = target.closest(".code-copy-button");
    if (copyButton) {
      e.stopPropagation();
      e.preventDefault();
      const pre = copyButton.closest("pre");
      if (pre) {
        const code = pre.querySelector("code");
        if (code) {
          const text = code.textContent ?? "";
          copyToClipboard(text, onCopy);
        }
      }
      return;
    }

    const span = target.closest("pre code span[style]");
    if (span) {
      e.stopPropagation();
      e.preventDefault();
      const text = span.textContent ?? "";
      if (text.trim()) {
        copyToClipboard(text, onCopy);
      }
      return;
    }

    const inlineCode = target.closest("p code, li code, td code, h1 code, h2 code, h3 code, h4 code, h5 code, h6 code");
    if (inlineCode) {
      e.stopPropagation();
      e.preventDefault();
      const text = inlineCode.textContent ?? "";
      if (text.trim()) {
        copyToClipboard(text, onCopy);
      }
      return;
    }
  };

  container.addEventListener("click", handleClick);
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
