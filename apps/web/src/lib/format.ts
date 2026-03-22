export const formatClock = (value: string | null) => {
  if (!value) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
};

export const formatDuration = (ms: number) => {
  if (!ms) {
    return "0s";
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
};

export const truncate = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value;

export const toPlainText = (value: string) =>
  value
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export const formatPercent = (value: number) => `${value}%`;

export const formatDateTime = (value: string | number | null) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
};
