/**
 * Banner Action Buttons Component - Quioscos
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { posthogUtils } from "@/lib/posthogClient";

export function BannerButtons() {
  const [isHoveringSecond, setIsHoveringSecond] = useState(false);

  const handleButtonClick = (product: string, action: string) => {
    posthogUtils.capture("showcase_banner_click", {
      product,
      action,
      source: "showcase_banner",
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-center">
      {/* Electrodomésticos Button - Underlined Style */}
      <Link
        href="/productos/electrodomesticos"
        className="group relative inline-block"
        onClick={() => handleButtonClick("Electrodomésticos", "conoce_mas")}
      >
        <button className="pb-2 text-xs md:text-sm font-semibold text-black transition-all duration-300 relative inline-block active:scale-95">
          <span style={{ fontFamily: "'Samsung Sharp Sans', sans-serif", fontWeight: 700 }}>
            Conoce más Bespoke AI
          </span>
          {/* Animated Underline */}
          <span
            className="absolute bottom-0 left-0 h-px bg-black w-full transition-all duration-500 ease-out"
          />
        </button>
      </Link>

      {/* TV Button - Border with Hover Effect */}
      <Link
        href="/productos/televisores-y-av"
        className="group inline-block"
        onClick={() => handleButtonClick("Neo QLED", "conoce_mas")}
        onMouseEnter={() => setIsHoveringSecond(true)}
        onMouseLeave={() => setIsHoveringSecond(false)}
      >
        <button
          className={`
            px-4 md:px-6 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-semibold
            transition-all duration-300
            border border-black/40
            ${
              isHoveringSecond
                ? "bg-black text-white border-black"
                : "bg-transparent text-black"
            }
          `}
        >
          <span style={{ fontFamily: "'Samsung Sharp Sans', sans-serif", fontWeight: 700 }}>
            Conoce más Neo QLED
          </span>
        </button>
      </Link>
    </div>
  );
}
