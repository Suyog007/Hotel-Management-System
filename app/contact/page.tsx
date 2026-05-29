import { CmsPage, generateCmsMetadata } from "@/components/public/cms-page";

export const generateMetadata = () => generateCmsMetadata("contact");

export default function ContactPage() {
  return <CmsPage slug="contact" />;
}
