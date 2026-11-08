/** Remotion's bundler imports audio files as assets; the export is their address. */
declare module "*.wav" {
  const src: string;
  export default src;
}
