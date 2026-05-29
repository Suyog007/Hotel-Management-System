import { CmsPage, generateCmsMetadata } from "@/components/public/cms-page";

export const generateMetadata = () => generateCmsMetadata("terms");

export default function TermsPage() {
  return <CmsPage slug="terms" />;
}
