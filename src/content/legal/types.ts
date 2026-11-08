/** Frontmatter at the top of a legal document; remark-mdx-frontmatter in next.config.ts exports it as frontmatter. */
export interface LegalFrontmatter {
  title: string;
  description: string;
  eyebrow: string;
  summary: string;
  effective: string;
  updated: string;
  highlights: string[];
}

/** Heading tree exported by rehype-extract-toc; ids come from rehype-slug. Subheadings are in children, so the whole tree has to be walked (see legalSections). */
export interface LegalHeading {
  depth: number;
  id?: string;
  value: string;
  children?: LegalHeading[];
}
