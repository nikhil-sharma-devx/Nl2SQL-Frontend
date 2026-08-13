interface AiOrbProps {
  /** sm = inline "thinking" indicator (chat avatar); lg = ambient hero decoration (Auth page). */
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * The app's signature "the model is here" object — a layered glow sphere with
 * independently-rotating energy rings and a couple of drifting particles.
 * Used sparingly per the design spec: only as the chat "thinking" indicator
 * and as ambient decoration on the Auth page.
 */
const AiOrb = ({ size = 'sm', className = '' }: AiOrbProps) => {
  const isLg = size === 'lg';
  const dim = isLg ? 220 : 28;

  return (
    <div
      className={`ai-orb-scene shrink-0 ${className}`}
      style={{ width: dim, height: dim }}
      aria-hidden="true"
    >
      {isLg && (
        <>
          <div className="ai-orb-ring" />
          <div className="ai-orb-ring r2" />
          <div
            className="ai-orb-particle"
            style={{ width: 4, height: 4, left: '18%', top: '30%' }}
          />
          <div
            className="ai-orb-particle"
            style={{ width: 3, height: 3, left: '72%', top: '62%', animationDelay: '1.5s' }}
          />
        </>
      )}
      <div
        className="ai-orb-core"
        style={{
          width: isLg ? '46%' : '100%',
          height: isLg ? '46%' : '100%',
          boxShadow: isLg
            ? '0 0 90px 30px color-mix(in srgb, var(--primary) 28%, transparent), 0 0 160px 60px color-mix(in srgb, var(--chart-2) 12%, transparent)'
            : '0 0 14px 4px color-mix(in srgb, var(--primary) 40%, transparent)',
        }}
      />
    </div>
  );
};

export default AiOrb;
