import { CmsPage, generateCmsMetadata } from "@/components/public/cms-page";

export const generateMetadata = () => generateCmsMetadata("about");

export default function AboutPage() {
  return <CmsPage slug="about" />;
}
