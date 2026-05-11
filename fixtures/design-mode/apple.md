---
colors:
  color-primary: "#007AFF"
  color-secondary: "#5856D6"
  color-tertiary: "#FF9500"
  color-quaternary: "#34C759"
  color-on-surface: "#1C1C1E"
  color-on-surface-secondary: "#8E8E93"
  color-link: "#007AFF"
  color-surface: "#FFFFFF"
  color-surface-secondary: "#F2F2F7"
  color-surface-elevated: "#FFFFFF"
  color-surface-muted: "#F9F9F9"
  color-surface-overlay: "rgba(0, 0, 0, 0.4)"
  color-border: "#C6C6C8"
  color-border-subtle: "#E5E5EA"
  color-divider: "#C6C6C8"
  color-error: "#FF3B30"
  color-warning: "#FF9500"
  color-success: "#34C759"
  color-info: "#007AFF"
  color-text-primary: "#1C1C1E"
  color-text-secondary: "#8E8E93"
  color-text-tertiary: "#AEAEB2"
  color-accent: "#007AFF"

typography:
  hero-display:
    font-family: '"SF Pro Display", system-ui, -apple-system, sans-serif'
    font-size: 34px
    font-weight: "700"
    line-height: "1.2"
    letter-spacing: "-0.02em"
  headline:
    font-family: '"SF Pro Display", system-ui, -apple-system, sans-serif'
    font-size: 28px
    font-weight: "700"
    line-height: "1.25"
    letter-spacing: "-0.01em"
  title-large:
    font-family: '"SF Pro Display", system-ui, -apple-system, sans-serif'
    font-size: 22px
    font-weight: "600"
    line-height: "1.3"
    letter-spacing: "0em"
  title:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 17px
    font-weight: "600"
    line-height: "1.4"
    letter-spacing: "0em"
  body:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 17px
    font-weight: "400"
    line-height: "1.6"
    letter-spacing: "0em"
  body-large:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 20px
    font-weight: "400"
    line-height: "1.55"
    letter-spacing: "0em"
  callout:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 16px
    font-weight: "400"
    line-height: "1.4"
    letter-spacing: "0em"
  subheadline:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 15px
    font-weight: "400"
    line-height: "1.45"
    letter-spacing: "0em"
  footnote:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 13px
    font-weight: "400"
    line-height: "1.38"
    letter-spacing: "-0.01em"
  caption:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 12px
    font-weight: "400"
    line-height: "1.33"
    letter-spacing: "0em"
  caption-semibold:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 12px
    font-weight: "600"
    line-height: "1.33"
    letter-spacing: "0em"
  caption-medium:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 12px
    font-weight: "500"
    line-height: "1.33"
    letter-spacing: "0em"
  label:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 11px
    font-weight: "500"
    line-height: "1.18"
    letter-spacing: "0.07em"
  label-semibold:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 11px
    font-weight: "600"
    line-height: "1.18"
    letter-spacing: "0.07em"
  label-medium:
    font-family: '"SF Pro Text", system-ui, -apple-system, sans-serif'
    font-size: 11px
    font-weight: "500"
    line-height: "1.18"
    letter-spacing: "0.04em"
  monospace:
    font-family: '"SF Mono", "Menlo", monospace'
    font-size: 15px
    font-weight: "400"
    line-height: "1.45"
    letter-spacing: "0em"

radii:
  radius-xs: 4px
  radius-sm: 8px
  radius-md: 12px
  radius-lg: 16px
  radius-xl: 20px
  radius-2xl: 24px
  radius-full: 9999px
  radius-none: 0px

spacing:
  space-xxxs: 2px
  space-xxs: 4px
  space-xs: 8px
  space-sm: 12px
  space-md: 16px
  space-lg: 24px
  space-xl: 32px
  space-xxl: 48px

components:
  button-primary:
    background: "{colors.primary}"
    foreground: "#FFFFFF"
    radius: "{radii.md}"
    padding: "{spacing.sm} {spacing.lg}"
  button-secondary:
    background: "{colors.surface-secondary}"
    foreground: "{colors.primary}"
    radius: "{radii.md}"
    padding: "{spacing.sm} {spacing.lg}"
  button-text:
    background: "transparent"
    foreground: "{colors.primary}"
    radius: "{radii.sm}"
    padding: "{spacing.xs} {spacing.sm}"
  card:
    background: "{colors.surface}"
    foreground: "{colors.on-surface}"
    radius: "{radii.lg}"
    shadow: "0 2px 8px rgba(0,0,0,0.08)"
    padding: "{spacing.lg}"
  card-elevated:
    background: "{colors.surface-elevated}"
    foreground: "{colors.on-surface}"
    radius: "{radii.lg}"
    shadow: "0 4px 16px rgba(0,0,0,0.12)"
    padding: "{spacing.lg}"
  chip:
    background: "{colors.surface-secondary}"
    foreground: "{colors.on-surface-secondary}"
    radius: "{radii.full}"
    padding: "{spacing.xxs} {spacing.sm}"
  badge:
    background: "{colors.error}"
    foreground: "#FFFFFF"
    radius: "{radii.full}"
    padding: "{spacing.xxs} {spacing.xs}"
  input:
    background: "{colors.surface-secondary}"
    foreground: "{colors.on-surface}"
    radius: "{radii.md}"
    border: "1px solid {colors.border}"
    padding: "{spacing.sm} {spacing.md}"
  divider:
    background: "{colors.divider}"
    height: "1px"
    margin: "{spacing.sm} 0"
  nav-bar:
    background: "{colors.surface}"
    foreground: "{colors.primary}"
    height: "44px"
    padding: "0 {spacing.md}"
  tab-bar:
    background: "{colors.surface}"
    foreground: "{colors.on-surface-secondary}"
    active-foreground: "{colors.primary}"
    height: "49px"
  toolbar:
    background: "{colors.surface}"
    foreground: "{colors.on-surface}"
    padding: "{spacing.sm}"
  modal:
    background: "{colors.surface}"
    radius: "{radii.xl}"
    shadow: "0 16px 48px rgba(0,0,0,0.2)"
  alert:
    background: "{colors.surface}"
    radius: "{radii.xl}"
    shadow: "0 8px 32px rgba(0,0,0,0.16)"
  toast:
    background: "{colors.on-surface}"
    foreground: "{colors.surface}"
    radius: "{radii.md}"
    padding: "{spacing.sm} {spacing.lg}"
  avatar:
    radius: "{radii.full}"
    size: "40px"
  icon-button:
    radius: "{radii.md}"
    size: "44px"
  search-bar:
    background: "{colors.surface-secondary}"
    foreground: "{colors.on-surface}"
    radius: "{radii.md}"
    padding: "{spacing.sm} {spacing.md}"
  skeleton:
    background: "{colors.surface-muted}"
    radius: "{radii.sm}"
  progress-bar:
    background: "{colors.surface-secondary}"
    fill: "{colors.primary}"
    height: "4px"
    radius: "{radii.full}"
  switch-track:
    background: "{colors.border}"
    active-background: "{colors.success}"
    radius: "{radii.full}"
    width: "51px"
    height: "31px"
  slider:
    track-height: "4px"
    thumb-size: "28px"
    track-color: "{colors.surface-secondary}"
    fill-color: "{colors.primary}"

---
# Apple Design Reference

This document defines the Apple-style design tokens for kmd.
