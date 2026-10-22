export function LiquidDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <filter id="liquid-glass" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="turbulence" baseFrequency="0.012 0.02" numOctaves="2" seed="3" result="turb" />
        <feGaussianBlur in="turb" stdDeviation="0.6" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="14" xChannelSelector="R" yChannelSelector="G" />
        <feSpecularLighting surfaceScale="2" specularConstant="0.4" specularExponent="18" lightingColor="#ffffff" result="spec">
          <fePointLight x="80" y="20" z="120" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceGraphic" operator="arithmetic" k1="0" k2="1" k3="0.25" k4="0" />
      </filter>
    </svg>
  );
}
