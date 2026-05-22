import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { DriverCTA } from '@/components/DriverCTA';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <HowItWorks />
      <DriverCTA />
      <Footer />
    </main>
  );
}
