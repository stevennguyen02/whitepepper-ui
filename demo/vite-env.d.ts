/// <reference types="vite/client" />

declare module 'virtual:whitepepper-exports' {
  type PortableComponent = {
    id: string;
    slug: string;
    name: string;
    exportName: string;
    entry: string;
    files: Record<string, { content: string; encoding: string }>;
    packages: Record<string, string>;
    props: Record<string, string>;
    spec: Record<string, any>;
    runtime: string | null;
  };
  export const vendorRuntime: {
    runtime: { id: string; manifest: string; packages: Record<string, string>; peers: Record<string, string>; fileCount: number } | null;
    files: Record<string, { content: string; encoding: string }>;
  };
  const catalogue: PortableComponent[] & { vendor: typeof vendorRuntime };
  export default catalogue;
}
