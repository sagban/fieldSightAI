import { CloudRain, Thermometer, Droplets, Wind } from 'lucide-react';

interface Weather {
  temp: number;
  humidity: number;
  swell: number;
}

interface EnvironmentalContextProps {
  weather: Weather;
}

export function EnvironmentalContext({ weather }: EnvironmentalContextProps) {
  return (
    <section className="border border-[#141414] p-6 rounded-sm bg-white/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <CloudRain size={18} className="text-[#141414]" />
        <h2 className="font-serif italic text-lg">Environmental Context</h2>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex justify-center mb-1 opacity-50"><Thermometer size={14} /></div>
          <p className="font-mono text-[8px] uppercase opacity-50">Temp</p>
          <p className="text-xl font-light">{weather.temp}°C</p>
        </div>
        <div className="text-center border-x border-[#141414]/10">
          <div className="flex justify-center mb-1 opacity-50"><Droplets size={14} /></div>
          <p className="font-mono text-[8px] uppercase opacity-50">Humidity</p>
          <p className="text-xl font-light">{weather.humidity}%</p>
        </div>
        <div className="text-center">
          <div className="flex justify-center mb-1 opacity-50"><Wind size={14} /></div>
          <p className="font-mono text-[8px] uppercase opacity-50">Swell</p>
          <p className="text-xl font-light">{weather.swell}m</p>
        </div>
      </div>
    </section>
  );
}
