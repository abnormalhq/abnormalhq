/** Remotion 的打包器把音频文件当资源引入，导出的是地址。 */
declare module "*.wav" {
  const src: string;
  export default src;
}
