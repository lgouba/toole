import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { BenefitsStrip } from '@/components/BenefitsStrip';
import { Features } from '@/components/Features';
import { HowItWorks } from '@/components/HowItWorks';
import { DriverCTA } from '@/components/DriverCTA';
import { Pricing } from '@/components/Pricing';
import { FAQ } from '@/components/FAQ';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <BenefitsStrip />
      <Features />
      <HowItWorks />
      <Pricing />
      <DriverCTA />
      <FAQ />
      <Footer />
    </main>
  );
}
