export function Footer() {
  return (
    <footer className="bg-brand-black text-brand-white py-12 border-t-8 border-brand-black mt-auto">
      <div className="container mx-auto px-4 text-center">
        <h2 className="editorial-heading text-5xl text-brand-white mb-2">SERVE TOGETHER.</h2>
        <p className="font-bold tracking-widest uppercase text-brand-pink mb-8">Worship together.</p>
        <div className="mt-12 flex justify-center gap-6">
          <div className="w-8 h-8 rounded-full bg-brand-blue border-2 border-brand-cream"></div>
          <div className="w-8 h-8 rounded-full bg-brand-red border-2 border-brand-cream"></div>
          <div className="w-8 h-8 rounded-full bg-brand-pink border-2 border-brand-cream"></div>
        </div>
        <p className="mt-16 text-sm opacity-50 font-bold uppercase tracking-widest">© 2026 Music Ministry.</p>
      </div>
    </footer>
  );
}
