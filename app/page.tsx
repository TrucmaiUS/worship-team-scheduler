import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { getSession } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getSession();
  const scheduleHref = session?.role === "ADMIN" ? "/admin" : "/schedule";

  return (
    <>
      <main className="flex-1 flex flex-col items-center">
        {/* HERO SECTION */}
        <section className="w-full max-w-6xl mx-auto px-4 py-12 md:py-20 relative">
          
          <div className="relative border-4 sm:border-8 border-brand-black bg-brand-white shadow-[6px_6px_0_0_#0038FF] sm:shadow-[12px_12px_0_0_#0038FF] transform rotate-1 transition-transform hover:rotate-0">
            <div className="relative w-full border-b-8 border-brand-black bg-brand-cream flex justify-center">
              <Image 
                src="/images/real-cover.png" 
                alt="Music Ministry Cover" 
                width={1200}
                height={800}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
            <div className="p-4 sm:p-8 md:p-12 text-center bg-brand-cream checkerboard-pink">
              <h1 className="editorial-heading text-3xl sm:text-5xl md:text-7xl lg:text-8xl mb-4 sm:mb-6">
                <span className="bg-brand-white text-brand-black px-3 sm:px-6 py-1 sm:py-2 border-4 border-brand-black shadow-[4px_4px_0_0_#0038FF] sm:shadow-[6px_6px_0_0_#0038FF] inline-block -rotate-2">
                  MUSIC MINISTRY
                </span>
              </h1>
              <p className="font-bold text-base sm:text-xl md:text-3xl text-brand-black bg-brand-white inline-block px-3 sm:px-4 py-1 sm:py-2 border-4 border-brand-black rotate-1 mt-2 sm:mt-4">
                Serve together. Worship together.
              </p>
              
              <div className="mt-12 flex flex-col sm:flex-row gap-6 justify-center">
                <Link href={scheduleHref}>
                  <Button variant="primary" size="lg" className="w-full sm:w-auto text-xl rotate-1 hover:rotate-0">
                    View Schedule
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="sticker" size="lg" className="w-full sm:w-auto text-xl -rotate-1 hover:rotate-0">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Roles Section */}
        <section className="py-24 pattern-grid border-t-8 border-b-8 border-brand-black relative">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-20">
              <div className="inline-block bg-brand-cream px-4 sm:px-8 md:px-12 py-4 sm:py-6 border-4 sm:border-8 border-brand-black shadow-[6px_6px_0_0_#0038FF] sm:shadow-[12px_12px_0_0_#0038FF] transform -rotate-2 hover:rotate-0 transition-transform">
                <h2 className="editorial-heading text-3xl sm:text-5xl md:text-7xl text-brand-black">
                  SERVE THROUGH <br className="hidden md:block" />
                  <span className="text-brand-pink whitespace-nowrap">YOUR GIFT</span>
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 w-full">
              <div className="bg-brand-blue text-brand-white p-8 border-8 border-brand-black shadow-[12px_12px_0_0_#111111] transform -rotate-1 hover:rotate-0 hover:-translate-y-2 transition-all flex flex-col h-full justify-between">
                <div>
                  <h3 className="editorial-heading text-4xl mb-4 text-outline-black">SOUND</h3>
                  <p className="font-bold text-lg mb-8">Support the worship experience</p>
                </div>
                <div className="opacity-50">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                </div>
              </div>
              <div className="bg-brand-red text-brand-white p-8 border-8 border-brand-black shadow-[12px_12px_0_0_#111111] transform rotate-1 hover:rotate-0 hover:-translate-y-2 transition-all flex flex-col h-full justify-between">
                <div>
                  <h3 className="editorial-heading text-4xl mb-4 text-outline-black">SINGER</h3>
                  <p className="font-bold text-lg mb-8">Lead people in worship</p>
                </div>
                <div className="opacity-50">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                </div>
              </div>
              <div className="bg-brand-pink text-brand-white p-8 border-8 border-brand-black shadow-[12px_12px_0_0_#111111] transform -rotate-1 hover:rotate-0 hover:-translate-y-2 transition-all flex flex-col h-full justify-between">
                <div>
                  <h3 className="editorial-heading text-4xl mb-4 text-outline-black">MUSICIAN</h3>
                  <p className="font-bold text-lg mb-8">Serve through music</p>
                </div>
                <div className="opacity-50">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 20 8.5 20 22 4 22 4 8.5 12 2"></polygon><line x1="12" y1="22" x2="12" y2="15"></line></svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="w-full py-24 relative overflow-hidden">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="editorial-heading text-3xl sm:text-5xl md:text-7xl text-brand-black mb-8 sm:mb-16 text-center">HOW IT WORKS</h2>
            
            <div className="flex flex-col md:flex-row gap-12 relative mt-12">
              {/* Line connects exactly behind the center of the 80px (h-20) circles */}
              <div className="absolute top-[40px] left-0 w-full h-2 bg-brand-black -translate-y-1/2 hidden md:block z-0"></div>
              
              <div className="flex-1 flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-brand-white border-4 border-brand-black rounded-full flex items-center justify-center text-3xl font-black mb-8 shadow-[4px_4px_0_0_#111111]">
                  01
                </div>
                <h3 className="editorial-heading text-2xl text-brand-blue bg-brand-cream px-6 py-2 border-4 border-brand-black shadow-[6px_6px_0_0_#111111] transform -rotate-2">SIGN IN</h3>
              </div>
              
              <div className="flex-1 flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-brand-white border-4 border-brand-black rounded-full flex items-center justify-center text-3xl font-black mb-8 shadow-[4px_4px_0_0_#111111]">
                  02
                </div>
                <h3 className="editorial-heading text-2xl text-brand-pink bg-brand-cream px-6 py-2 border-4 border-brand-black shadow-[6px_6px_0_0_#111111] transform rotate-1">CHOOSE ROLE</h3>
              </div>
              
              <div className="flex-1 flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-brand-white border-4 border-brand-black rounded-full flex items-center justify-center text-3xl font-black mb-8 shadow-[4px_4px_0_0_#111111]">
                  03
                </div>
                <h3 className="editorial-heading text-2xl text-brand-red bg-brand-cream px-6 py-2 border-4 border-brand-black shadow-[6px_6px_0_0_#111111] transform -rotate-1">SERVE</h3>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full py-32 bg-brand-cream text-center border-t-8 border-brand-black relative overflow-hidden flex flex-col items-center justify-center">
          
          <div className="relative z-10 flex flex-col items-center w-full">
            <div className="relative w-full flex justify-center items-center mb-20">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full opacity-5 pointer-events-none flex justify-center">
                 <h2 className="editorial-heading text-[12vw] leading-none text-brand-black whitespace-nowrap">READY TO SERVE?</h2>
              </div>
              
              <h2 className="editorial-heading text-3xl sm:text-5xl md:text-7xl text-brand-black relative z-10">
                READY TO <span className="bg-brand-blue text-brand-white px-2 sm:px-4 py-1 inline-block rotate-2 border-4 border-brand-black shadow-[4px_4px_0_0_#111111] sm:shadow-[6px_6px_0_0_#111111]">SERVE?</span>
              </h2>
            </div>
            
            <Link href={scheduleHref}>
              <Button size="lg" className="bg-brand-white text-brand-black text-base sm:text-xl md:text-2xl font-bold px-6 sm:px-12 py-4 sm:py-6 border-4 sm:border-8 border-brand-black rounded-none shadow-[6px_6px_0_0_#FFA6C9] sm:shadow-[12px_12px_0_0_#FFA6C9] hover:-translate-y-1 transition-transform -rotate-1">
                VIEW THIS WEEK&apos;S SCHEDULE
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
