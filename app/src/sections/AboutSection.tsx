import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/language';
import { Download, Shield, Smartphone } from 'lucide-react';

const appInfoRows = [
  { label: 'Boyut', value: '18.5 MB', icon: Download },
  { label: 'Gereksinim', value: 'Android 5.0+', icon: Smartphone },
  { label: 'Güvenlik', value: 'SSL Korumalı', icon: Shield },
];

export default function AboutSection() {
  useLang();
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.unobserve(entry.target); } },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="download" ref={ref} className="relative w-full py-6 md:py-20 bg-[#0f172a] overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div className={`text-center mb-8 md:mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Uygulama <span className="text-gradient">Hakkında</span>
          </h2>
          <p className="text-gray-500 mt-2">Steamix TV uygulaması hakkında detaylı bilgiler</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
          {appInfoRows.map((row, i) => {
            const Icon = row.icon;
            return (
              <div key={i} className="flex items-center gap-4 p-4 md:p-5 rounded-xl bg-white/[0.02] border border-white/5 transition-all duration-300 hover:bg-white/[0.04] hover:border-[#0099ff]/20 hover:-translate-y-1" style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(15px)', transitionDelay: `${i * 100}ms` }}>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{row.label}</p>
                  <p className="text-sm md:text-base font-semibold text-white">{row.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
