import React from 'react';

const CanadianLeafLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-96 h-96 flex items-center justify-center">
        {/* Soft Depth Shadow - The "Halo" */}
        <div className="absolute w-56 h-56 bg-red-600/5 rounded-full blur-[80px] animate-pulse" />

        {/* The Realistic Maple Leaf SVG */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-40 h-40 drop-shadow-[0_20px_35px_rgba(216,6,33,0.15)] z-10 animate-float"
          style={{ overflow: 'visible' }}
        >
          {/* Realistic Silhouette Path based on the Acer Saccharum (Sugar Maple) */}
          <path
            d="M50 88 C50 88 51 80 51 75 L51 72 
               C56 73 63 75 68 68 L64 64 
               C70 65 77 66 82 59 L75 54 
               C80 50 85 45 80 37 L71 42 
               C72 35 73 28 66 25 L61 34 
               C58 25 55 15 50 10 
               C45 15 42 25 39 34 L34 25 
               C27 28 28 35 29 42 L20 37 
               C15 45 20 50 25 54 L18 59 
               C23 66 30 65 36 64 L32 68 
               C37 75 44 73 49 72 L49 75 
               C49 80 50 88 50 88 Z"
            fill="#D80621"
            stroke="#D80621"
            strokeWidth="0.7"
            strokeLinejoin="round"
            className="realistic-leaf-animation"
          />
          
          {/* Internal Veins - Adding the "FAANG" level of detail */}
          <path 
            d="M50 72 L50 25 M50 68 L32 45 M50 68 L68 45 M50 60 L25 50 M50 60 L75 50" 
            fill="none" 
            stroke="white" 
            strokeWidth="0.3" 
            strokeOpacity="0.4"
            className="vein-animation"
          />
        </svg>
      </div>
      <div className="text-2xl font-semibold text-slate-900 text-center">
        Welcome back!
      </div>
      <style>{`
        .realistic-leaf-animation {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          fill-opacity: 0;
          transform-origin: center bottom;
          animation: assemble-leaf 4s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        .vein-animation {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: draw-veins 4s cubic-bezier(0.65, 0, 0.35, 1) forwards;
        }

        @keyframes assemble-leaf {
          0% { stroke-dashoffset: 300; fill-opacity: 0; transform: scale(0.9) rotate(-2deg); }
          20% { stroke-dashoffset: 0; fill-opacity: 0; }
          40%, 80% { stroke-dashoffset: 0; fill-opacity: 1; transform: scale(1) rotate(0deg); }
          100% { stroke-dashoffset: 0; fill-opacity: 0; transform: scale(1.05); }
        }

        @keyframes draw-veins {
          0%, 30% { stroke-dashoffset: 100; opacity: 0; }
          50%, 80% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }

        .animate-float {
          animation: float-natural 4s ease-in-out forwards;
        }

        @keyframes float-natural {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }

        .animate-shadow-breath {
          animation: shadow-natural 4s ease-in-out forwards;
        }

        @keyframes shadow-natural {
          0%, 100% { transform: scaleX(1); opacity: 0.1; filter: blur(4px); }
          50% { transform: scaleX(0.7); opacity: 0.03; filter: blur(6px); }
        }

        .animate-progress-line {
          width: 40%;
          animation: slide-line 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes slide-line {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default CanadianLeafLoader;