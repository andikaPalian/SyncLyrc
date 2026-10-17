import type { SVGProps } from "react";

const paths = {
  music: "M9 18V5l12-2v13M9 8l12-2M9 18c0 1.7-1.8 3-4 3s-3-1-3-2.5S3.8 16 6 16c1.2 0 2.2.4 3 1M21 16c0 1.7-1.8 3-4 3s-3-1-3-2.5 1.8-2.5 4-2.5c1.2 0 2.2.4 3 1",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6",
  play: "m8 5 11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4",
  copy: "M9 9h12v12H9ZM15 9V3H3v12h6",
  close: "m6 6 12 12M6 18 18 6",
  refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2",
} as const;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]} /></svg>;
}
