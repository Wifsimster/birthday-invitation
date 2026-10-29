import { appVersion, buildTime } from '../build-info.js';

function formatBuild(value) {
  if (!value) return 'dev';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export default function BuildFooter() {
  return (
    <footer className="pointer-events-none flex justify-center px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <span className="pointer-events-auto rounded-full bg-black/25 px-3 py-[5px] text-[0.72rem] leading-none tracking-[0.02em] text-white backdrop-blur-[4px] select-all">
        v{appVersion} · build {formatBuild(buildTime)}
      </span>
    </footer>
  );
}
