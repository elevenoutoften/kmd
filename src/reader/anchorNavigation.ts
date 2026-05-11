const SCROLL_OFFSET_PX = 12;

export function getReaderScrollTopForTarget(
  containerScrollTop: number,
  containerTop: number,
  targetTop: number,
): number {
  return Math.max(0, containerScrollTop + targetTop - containerTop - SCROLL_OFFSET_PX);
}

export function findAnchorTarget(root: ParentNode, fragmentId: string): HTMLElement | null {
  const candidateIds = [fragmentId, `user-content-${fragmentId}`];

  for (const element of root.querySelectorAll<HTMLElement>("[id], a[name]")) {
    const name = element.getAttribute("name");
    if (candidateIds.includes(element.id) || (name !== null && candidateIds.includes(name))) {
      return element;
    }
  }

  return null;
}

export function scrollContainerToTarget(
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior = "smooth",
): void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  container.scrollTo({
    top: getReaderScrollTopForTarget(container.scrollTop, containerRect.top, targetRect.top),
    behavior,
  });
}
